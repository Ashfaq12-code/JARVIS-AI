from __future__ import annotations

import ctypes
import os
import time
from ctypes import wintypes
from typing import Dict, Optional

from backend.computer.app_launcher import resolve_application


USER32 = ctypes.WinDLL("user32", use_last_error=True) if hasattr(ctypes, "WinDLL") else None
KERNEL32 = ctypes.WinDLL("kernel32", use_last_error=True) if hasattr(ctypes, "WinDLL") else None
SW_RESTORE = 9
SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002
SWP_SHOWWINDOW = 0x0040
HWND_TOP = 0
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000


class WindowControlError(RuntimeError):
    pass


if USER32 is not None:
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    USER32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    USER32.GetWindowThreadProcessId.restype = wintypes.DWORD
    USER32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    USER32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    USER32.IsWindowVisible.argtypes = [wintypes.HWND]
    USER32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
    USER32.SetForegroundWindow.argtypes = [wintypes.HWND]
    USER32.SetForegroundWindow.restype = wintypes.BOOL
    USER32.GetForegroundWindow.restype = wintypes.HWND
    USER32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]
    USER32.SetWindowPos.restype = wintypes.BOOL
    USER32.SwitchToThisWindow.argtypes = [wintypes.HWND, wintypes.BOOL]


def _process_executable(hwnd: int) -> Optional[str]:
    if USER32 is None or KERNEL32 is None:
        return None
    process_id = wintypes.DWORD()
    USER32.GetWindowThreadProcessId(hwnd, ctypes.byref(process_id))
    handle = KERNEL32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, process_id.value)
    if not handle:
        return None
    try:
        buffer = ctypes.create_unicode_buffer(1024)
        size = wintypes.DWORD(len(buffer))
        if not KERNEL32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
            return None
        return buffer.value
    finally:
        KERNEL32.CloseHandle(handle)


def find_visible_window(app_key: str) -> Optional[Dict[str, object]]:
    if USER32 is None:
        return None
    spec = resolve_application(app_key)
    if not spec:
        return None
    matches = find_visible_windows(app_key)
    return matches[0] if matches else None


def find_visible_windows(app_key: str) -> list[Dict[str, object]]:
    if USER32 is None:
        return []
    spec = resolve_application(app_key)
    if not spec:
        return []
    allowed_command = (spec.executable or (spec.command[0] if spec.command else ""))
    allowed_executables = {os.path.normcase(os.path.basename(allowed_command))}
    if spec.name == "calculator":
        allowed_executables.add("calculatorapp.exe")
    matches: list[Dict[str, object]] = []

    @WNDENUMPROC
    def callback(hwnd: int, _: int) -> bool:
        if not USER32.IsWindowVisible(hwnd):
            return True
        title_buffer = ctypes.create_unicode_buffer(512)
        USER32.GetWindowTextW(hwnd, title_buffer, len(title_buffer))
        title = title_buffer.value.strip()
        if not title:
            return True
        executable = _process_executable(hwnd)
        if executable and os.path.normcase(os.path.basename(executable)) in allowed_executables:
            class_buffer = ctypes.create_unicode_buffer(256)
            USER32.GetClassNameW(hwnd, class_buffer, len(class_buffer))
            matches.append({"hwnd": int(hwnd), "title": title, "class_name": class_buffer.value, "executable": executable})
            return True
        return True

    USER32.EnumWindows(callback, 0)
    return matches


def resolve_process_window(process_id: int, timeout: float = 3.0) -> Optional[Dict[str, object]]:
    if USER32 is None or process_id <= 0:
        return None
    deadline = time.monotonic() + max(0.0, timeout)
    while True:
        matches: list[Dict[str, object]] = []

        @WNDENUMPROC
        def callback(hwnd: int, _: int) -> bool:
            if not USER32.IsWindowVisible(hwnd):
                return True
            candidate_pid = wintypes.DWORD()
            USER32.GetWindowThreadProcessId(hwnd, ctypes.byref(candidate_pid))
            if candidate_pid.value != process_id:
                return True
            title_buffer = ctypes.create_unicode_buffer(512)
            USER32.GetWindowTextW(hwnd, title_buffer, len(title_buffer))
            class_buffer = ctypes.create_unicode_buffer(256)
            USER32.GetClassNameW(hwnd, class_buffer, len(class_buffer))
            matches.append({"hwnd": int(hwnd), "title": title_buffer.value.strip(), "class_name": class_buffer.value, "pid": process_id})
            return False

        USER32.EnumWindows(callback, 0)
        if matches:
            return matches[0]
        if time.monotonic() >= deadline:
            return None
        time.sleep(0.05)


def resolve_new_application_window(app_key: str, existing_hwnds: set[int], timeout: float = 3.0) -> Optional[Dict[str, object]]:
    deadline = time.monotonic() + max(0.0, timeout)
    while True:
        for window in find_visible_windows(app_key):
            if int(window["hwnd"]) not in existing_hwnds:
                return window
        if time.monotonic() >= deadline:
            return None
        time.sleep(0.05)


def verify_foreground(hwnd: int) -> bool:
    return bool(USER32 is not None and hwnd and USER32.GetForegroundWindow() == hwnd)


def focus_hwnd(hwnd: int, wait: float = 0.15) -> Dict[str, object]:
    if USER32 is None or KERNEL32 is None or not hwnd:
        return {"success": False, "status": "error", "tool": "focus_window", "message": "The target window is unavailable."}
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
    for _ in range(3):
        if verify_foreground(hwnd):
            break
        USER32.keybd_event(0x12, 0, 0, 0)
        USER32.keybd_event(0x12, 0, 0x0002, 0)
        USER32.ShowWindow(hwnd, SW_RESTORE)
        USER32.SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
        USER32.SetForegroundWindow(hwnd)
        USER32.BringWindowToTop(hwnd)
        USER32.SwitchToThisWindow(hwnd, True)
        time.sleep(0.08)
    if attached:
        USER32.AttachThreadInput(current_thread, target_thread, False)
        USER32.AttachThreadInput(current_thread, foreground_thread, False)
        USER32.SetForegroundWindow(hwnd)
        USER32.BringWindowToTop(hwnd)
    if wait > 0:
        time.sleep(wait)
    if not verify_foreground(hwnd):
        return {"success": False, "status": "error", "tool": "focus_window", "message": "The intended window did not become foreground."}
    return {"success": True, "status": "success", "tool": "focus_window", "hwnd": int(hwnd)}


def focus_window(app_key: str, wait: float = 0.15) -> Dict[str, object]:
    if USER32 is None or KERNEL32 is None:
        return {"success": False, "status": "error", "tool": "focus_window", "message": "Windows window control is unavailable on this platform."}
    window = find_visible_window(app_key)
    if not window:
        return {"success": False, "status": "error", "tool": "focus_window", "message": f"No visible {app_key} window is available."}

    focused = focus_hwnd(int(window["hwnd"]), wait)
    return {**focused, **window} if focused.get("success") else focused
