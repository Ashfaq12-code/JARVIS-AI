from __future__ import annotations

import ctypes
import time
from ctypes import wintypes
from typing import Dict, Optional

from backend.computer.app_launcher import resolve_application
from backend.computer.window import find_visible_window, focus_hwnd, focus_window, verify_foreground


USER32 = ctypes.WinDLL("user32", use_last_error=True) if hasattr(ctypes, "WinDLL") else None
KERNEL32 = ctypes.WinDLL("kernel32", use_last_error=True) if hasattr(ctypes, "WinDLL") else None
SW_RESTORE = 9
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004
VK_CONTROL = 0x11
VK_L = 0x4C
VK_RETURN = 0x0D
VK_ESCAPE = 0x1B
VK_TAB = 0x09
VK_BACK = 0x08
VK_A = 0x41
VK_C = 0x43
VK_V = 0x56
VK_MENU = 0x12


class KeyboardAutomationError(RuntimeError):
    pass


if USER32 is not None:
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    ULONG_PTR = ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_ulong

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [
            ("wVk", wintypes.WORD),
            ("wScan", wintypes.WORD),
            ("dwFlags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", ULONG_PTR),
        ]

    class INPUTUNION(ctypes.Union):
        _fields_ = [
            ("ki", KEYBDINPUT),
            ("_input_size_padding", ctypes.c_byte * 32),
        ]

    class INPUT(ctypes.Structure):
        _anonymous_ = ("union",)
        _fields_ = [
            ("type", wintypes.DWORD),
            ("union", INPUTUNION),
        ]

    USER32.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int]
    USER32.SendInput.restype = wintypes.UINT


def _chrome_window() -> tuple[int, str]:
    if USER32 is None:
        raise KeyboardAutomationError("Windows keyboard control is unavailable on this platform.")

    window = find_visible_window("chrome")
    if not window:
        raise KeyboardAutomationError("No visible Chrome window is available for keyboard control.")
    return int(window["hwnd"]), str(window["title"])


def _send_inputs(inputs: list["INPUT"]) -> None:
    if not inputs:
        return
    input_array = (INPUT * len(inputs))(*inputs)
    sent = USER32.SendInput(len(input_array), input_array, ctypes.sizeof(INPUT))
    if sent != len(input_array):
        raise KeyboardAutomationError(f"Windows accepted {sent} of {len(input_array)} keyboard inputs.")


def _virtual_key_inputs(key: int) -> list["INPUT"]:
    return [
        INPUT(type=1, ki=KEYBDINPUT(wVk=key, wScan=0, dwFlags=0, time=0, dwExtraInfo=0)),
        INPUT(type=1, ki=KEYBDINPUT(wVk=key, wScan=0, dwFlags=KEYEVENTF_KEYUP, time=0, dwExtraInfo=0)),
    ]


def _unicode_inputs(text: str) -> list["INPUT"]:
    inputs: list[INPUT] = []
    for character in text:
        code_unit = ord(character)
        inputs.extend([
            INPUT(type=1, ki=KEYBDINPUT(wVk=0, wScan=code_unit, dwFlags=KEYEVENTF_UNICODE, time=0, dwExtraInfo=0)),
            INPUT(type=1, ki=KEYBDINPUT(wVk=0, wScan=code_unit, dwFlags=KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, time=0, dwExtraInfo=0)),
        ])
    return inputs


def _type_text_in_chrome(text: str, tool_name: str) -> Dict[str, object]:
    if USER32 is None:
        return {"success": False, "status": "error", "tool": "chrome_keyboard", "message": "Windows keyboard control is unavailable on this platform."}

    try:
        hwnd, title = _chrome_window()
        USER32.ShowWindow(hwnd, SW_RESTORE)
        foreground = USER32.GetForegroundWindow()
        current_thread = KERNEL32.GetCurrentThreadId()
        foreground_thread = USER32.GetWindowThreadProcessId(foreground, None) if foreground else 0
        target_thread = USER32.GetWindowThreadProcessId(hwnd, None)
        attached = False
        if foreground_thread and foreground_thread != current_thread and target_thread != current_thread:
            USER32.AttachThreadInput(current_thread, foreground_thread, True)
            USER32.AttachThreadInput(current_thread, target_thread, True)
            attached = True
        if foreground != hwnd:
            USER32.keybd_event(VK_MENU, 0, 0, 0)
            USER32.keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0)
            if not USER32.SetForegroundWindow(hwnd):
                raise KeyboardAutomationError("Windows did not allow Chrome to become the foreground window.")
            USER32.BringWindowToTop(hwnd)
        if attached:
            USER32.AttachThreadInput(current_thread, target_thread, False)
            USER32.AttachThreadInput(current_thread, foreground_thread, False)
        if USER32.GetForegroundWindow() != hwnd:
            raise KeyboardAutomationError("Chrome did not become the foreground window.")
        time.sleep(0.15)

        _send_inputs(_virtual_key_inputs(VK_CONTROL)[:1] + _virtual_key_inputs(VK_L)[:1])
        _send_inputs(_virtual_key_inputs(VK_L)[1:] + _virtual_key_inputs(VK_CONTROL)[1:])
        time.sleep(0.08)
        _send_inputs(_unicode_inputs(text))
        time.sleep(0.05)
        _send_inputs(_virtual_key_inputs(VK_RETURN))
    except (KeyboardAutomationError, OSError) as exc:
        return {"success": False, "status": "error", "tool": "chrome_keyboard", "message": str(exc)}

    return {
        "success": True,
        "status": "success",
        "tool": tool_name,
        "window_title": title,
        "text": text,
        "message": f"Chrome focused, {text} entered, and Enter pressed.",
    }


def type_text_in_chrome(text: str) -> Dict[str, object]:
    if any(ord(character) < 32 for character in (text or "")):
        return {
            "success": False,
            "status": "error",
            "tool": "chrome_keyboard",
            "message": "Chrome keyboard text is empty, too long, or contains control characters.",
        }
    clean_text = " ".join((text or "").split())
    if not clean_text or len(clean_text) > 200:
        return {
            "success": False,
            "status": "error",
            "tool": "chrome_keyboard",
            "message": "Chrome keyboard text is empty, too long, or contains control characters.",
        }
    return _type_text_in_chrome(clean_text, "chrome_keyboard")


def type_gta6_in_chrome() -> Dict[str, object]:
    return _type_text_in_chrome("GTA 6", "chrome_keyboard")


KEY_CODES = {
    "enter": VK_RETURN,
    "return": VK_RETURN,
    "escape": VK_ESCAPE,
    "esc": VK_ESCAPE,
    "tab": VK_TAB,
    "backspace": VK_BACK,
    "ctrl": VK_CONTROL,
    "control": VK_CONTROL,
    "a": VK_A,
    "c": VK_C,
    "v": VK_V,
}


def press_key(key: str) -> Dict[str, object]:
    code = KEY_CODES.get((key or "").strip().lower())
    if code is None:
        return {"success": False, "status": "error", "tool": "keyboard", "message": f"Unsupported key: {key}"}
    try:
        _send_inputs(_virtual_key_inputs(code))
    except KeyboardAutomationError as exc:
        return {"success": False, "status": "error", "tool": "keyboard", "message": str(exc)}
    return {"success": True, "status": "success", "tool": "keyboard", "key": key}


def press_key_to_window(hwnd: int, key: str) -> Dict[str, object]:
    if not verify_foreground(hwnd):
        return {"success": False, "status": "error", "tool": "keyboard", "message": "The target window is not foreground; no keyboard input was sent."}
    return press_key(key)


def hotkey(*keys: str) -> Dict[str, object]:
    codes = [KEY_CODES.get((key or "").strip().lower()) for key in keys]
    if not keys or any(code is None for code in codes):
        return {"success": False, "status": "error", "tool": "keyboard", "message": "Unsupported or empty hotkey."}
    try:
        down = [INPUT(type=1, ki=KEYBDINPUT(wVk=code, wScan=0, dwFlags=0, time=0, dwExtraInfo=0)) for code in codes if code is not None]
        up = [INPUT(type=1, ki=KEYBDINPUT(wVk=code, wScan=0, dwFlags=KEYEVENTF_KEYUP, time=0, dwExtraInfo=0)) for code in reversed(codes) if code is not None]
        _send_inputs(down + up)
    except KeyboardAutomationError as exc:
        return {"success": False, "status": "error", "tool": "keyboard", "message": str(exc)}
    return {"success": True, "status": "success", "tool": "keyboard", "keys": list(keys)}


def type_text(text: str, app_key: str = "") -> Dict[str, object]:
    if any(ord(character) < 32 for character in (text or "")):
        return {"success": False, "status": "error", "tool": "keyboard", "message": "Text is empty, too long, or contains control characters."}
    clean_text = " ".join((text or "").split())
    if not clean_text or len(clean_text) > 500:
        return {"success": False, "status": "error", "tool": "keyboard", "message": "Text is empty, too long, or contains control characters."}
    if app_key:
        focused = focus_window(app_key)
        if not focused.get("success"):
            return focused
        return type_text_to_window(int(focused["hwnd"]), clean_text)
    try:
        _send_inputs(_unicode_inputs(clean_text))
    except KeyboardAutomationError as exc:
        return {"success": False, "status": "error", "tool": "keyboard", "message": str(exc)}
    return {"success": True, "status": "success", "tool": "keyboard", "text": clean_text}


def type_text_to_window(hwnd: int, text: str) -> Dict[str, object]:
    if USER32 is None or not hwnd or not verify_foreground(hwnd):
        return {"success": False, "status": "error", "tool": "keyboard", "message": "The target window is not foreground; no keyboard input was sent."}
    try:
        _send_inputs(_unicode_inputs(text))
    except KeyboardAutomationError as exc:
        return {"success": False, "status": "error", "tool": "keyboard", "message": str(exc)}
    return {"success": True, "status": "success", "tool": "keyboard", "hwnd": hwnd, "text": text}


def press_enter() -> Dict[str, object]:
    return press_key("enter")


def press_escape() -> Dict[str, object]:
    return press_key("escape")


def press_tab() -> Dict[str, object]:
    return press_key("tab")


def press_backspace() -> Dict[str, object]:
    return press_key("backspace")
