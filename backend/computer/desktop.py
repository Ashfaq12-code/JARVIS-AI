from __future__ import annotations

from typing import Dict

from backend.computer.app_launcher import launch_application
from backend.computer.calculator import normalize_expression
from backend.computer.keyboard import press_key_to_window, type_text_to_window
from backend.computer.window import find_visible_window, find_visible_windows, resolve_new_application_window, resolve_process_window, focus_hwnd


ALLOWED_TYPED_APPS = {"notepad"}


def launch_and_focus(app: str) -> Dict[str, object]:
    normalized_app = " ".join((app or "").lower().strip().split())
    if normalized_app not in {"notepad", "calculator"}:
        return launch_application(normalized_app)
    existing_hwnds = {int(window["hwnd"]) for window in find_visible_windows(normalized_app)}
    launch_result = launch_application(normalized_app)
    if not launch_result.get("success"):
        return launch_result
    process_id = launch_result.get("pid")
    target_window = resolve_process_window(process_id, timeout=3.0) if isinstance(process_id, int) else None
    if not target_window and normalized_app == "calculator":
        target_window = resolve_new_application_window(normalized_app, existing_hwnds, timeout=3.0)
    if not target_window and normalized_app == "calculator":
        calculator_windows = find_visible_windows(normalized_app)
        for candidate in calculator_windows:
            focused = focus_hwnd(int(candidate["hwnd"]))
            if focused.get("success"):
                target_window = candidate
                break
    if not target_window:
        return {**launch_result, "message": f"{normalized_app.title()} launched successfully."}
    focused = focus_hwnd(int(target_window["hwnd"]))
    if not focused.get("success"):
        return {**launch_result, "hwnd": int(target_window["hwnd"]), "window_title": target_window.get("title"),
                "message": f"{normalized_app.title()} launched successfully."}
    return {**launch_result, "hwnd": int(target_window["hwnd"]), "window_title": target_window.get("title")}


def open_and_type(app: str, text: str) -> Dict[str, object]:
    normalized_app = " ".join((app or "").lower().strip().split())
    clean_text = " ".join((text or "").split())
    if normalized_app not in ALLOWED_TYPED_APPS:
        return {"success": False, "status": "error", "tool": "desktop_task", "message": "Typing is currently limited to allowlisted Notepad tasks."}
    if not clean_text or len(clean_text) > 500 or any(ord(character) < 32 for character in clean_text):
        return {"success": False, "status": "error", "tool": "desktop_task", "message": "Text is empty, too long, or contains control characters."}

    existing_hwnds = {int(window["hwnd"]) for window in find_visible_windows(normalized_app)}
    launch_result = launch_application(normalized_app)
    if not launch_result.get("success"):
        return launch_result
    process_id = launch_result.get("pid")
    if not isinstance(process_id, int):
        return {"success": False, "status": "error", "tool": "desktop_task", "message": "The application process ID was unavailable, so I did not type."}
    target_window = resolve_process_window(process_id, timeout=3.0)
    if not target_window and normalized_app == "calculator":
        target_window = resolve_new_application_window(normalized_app, existing_hwnds, timeout=3.0)
    if not target_window:
        return {"success": False, "status": "error", "tool": "desktop_task", "message": "Notepad opened, but I couldn't safely verify its input window, so I didn't type."}

    focused = focus_hwnd(int(target_window["hwnd"]))
    if not focused.get("success"):
        return {"success": False, "status": "error", "tool": "desktop_task", "message": "Notepad opened, but I couldn't safely verify its input window, so I didn't type."}
    result = type_text_to_window(int(target_window["hwnd"]), clean_text)
    if not result.get("success"):
        return {"success": False, "status": "error", "tool": "desktop_task", "message": "I couldn't type into the requested application.", "details": result.get("message")}
    return {
        "success": True,
        "status": "success",
        "tool": "desktop_task",
        "app": normalized_app,
        "pid": process_id,
        "hwnd": int(target_window["hwnd"]),
        "text": clean_text,
        "message": f"Opened {normalized_app.title()} and typed the requested text.",
    }


def open_and_calculate_in_ui(expression: str) -> Dict[str, object]:
    existing_hwnds = {int(window["hwnd"]) for window in find_visible_windows("calculator")}
    launch_result = launch_application("calculator")
    if not launch_result.get("success"):
        return launch_result
    process_id = launch_result.get("pid")
    target_window = resolve_process_window(process_id, timeout=3.0) if isinstance(process_id, int) else None
    if not target_window:
        target_window = resolve_new_application_window("calculator", existing_hwnds, timeout=3.0)
    if not target_window:
        target_window = find_visible_window("calculator")
    if not target_window:
        return {"success": False, "status": "error", "tool": "calculator_ui", "message": "Calculator is open, but I couldn't safely verify its input window."}
    hwnd = int(target_window["hwnd"])
    focused = focus_hwnd(hwnd)
    if not focused.get("success"):
        return {"success": False, "status": "error", "tool": "calculator_ui", "message": "Calculator is open, but I couldn't safely verify its input window."}
    normalized = normalize_expression(expression)
    typed = type_text_to_window(hwnd, normalized)
    if not typed.get("success"):
        return {"success": False, "status": "error", "tool": "calculator_ui", "message": "Calculator is open, but I couldn't safely verify its input window."}
    entered = press_key_to_window(hwnd, "enter")
    if not entered.get("success"):
        return {"success": False, "status": "error", "tool": "calculator_ui", "message": "Calculator is open, but I couldn't safely verify its input window."}
    return {"success": True, "status": "success", "tool": "calculator_ui", "expression": normalized, "message": "The calculation was entered into Calculator."}
