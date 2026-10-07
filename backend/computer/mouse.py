from __future__ import annotations

import ctypes
from ctypes import wintypes
from typing import Dict


USER32 = ctypes.WinDLL("user32", use_last_error=True) if hasattr(ctypes, "WinDLL") else None
INPUT_MOUSE = 0
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_WHEEL = 0x0800


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_ulong),
    ]


class MOUSEUNION(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT), ("_input_size_padding", ctypes.c_byte * 32)]


class INPUT(ctypes.Structure):
    _anonymous_ = ("union",)
    _fields_ = [("type", wintypes.DWORD), ("union", MOUSEUNION)]


if USER32 is not None:
    USER32.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int]
    USER32.SendInput.restype = wintypes.UINT
    USER32.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
    USER32.SetCursorPos.argtypes = [wintypes.INT, wintypes.INT]


def _send(flags: int, data: int = 0, dx: int = 0, dy: int = 0) -> Dict[str, object]:
    if USER32 is None:
        return {"success": False, "status": "error", "tool": "mouse", "message": "Windows mouse control is unavailable on this platform."}
    event = INPUT(type=INPUT_MOUSE, mi=MOUSEINPUT(dx=dx, dy=dy, mouseData=data, dwFlags=flags, time=0, dwExtraInfo=0))
    sent = USER32.SendInput(1, ctypes.byref(event), ctypes.sizeof(INPUT))
    if sent != 1:
        return {"success": False, "status": "error", "tool": "mouse", "message": f"Windows accepted {sent} of 1 mouse inputs."}
    return {"success": True, "status": "success", "tool": "mouse"}


def move_mouse(x: int, y: int) -> Dict[str, object]:
    if USER32 is None:
        return {"success": False, "status": "error", "tool": "mouse", "message": "Windows mouse control is unavailable on this platform."}
    if not USER32.SetCursorPos(int(x), int(y)):
        return {"success": False, "status": "error", "tool": "mouse", "message": "Windows rejected the cursor move."}
    return {"success": True, "status": "success", "tool": "mouse", "x": int(x), "y": int(y)}


def left_click() -> Dict[str, object]:
    return _send(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP)


def right_click() -> Dict[str, object]:
    return _send(MOUSEEVENTF_RIGHTDOWN | MOUSEEVENTF_RIGHTUP)


def double_click() -> Dict[str, object]:
    first = _send(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP)
    if not first.get("success"):
        return first
    return _send(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP)


def mouse_down(button: str = "left") -> Dict[str, object]:
    flags = MOUSEEVENTF_LEFTDOWN if button == "left" else MOUSEEVENTF_RIGHTDOWN if button == "right" else 0
    if not flags:
        return {"success": False, "status": "error", "tool": "mouse", "message": "Only left and right buttons are supported."}
    return _send(flags)


def mouse_up(button: str = "left") -> Dict[str, object]:
    flags = MOUSEEVENTF_LEFTUP if button == "left" else MOUSEEVENTF_RIGHTUP if button == "right" else 0
    if not flags:
        return {"success": False, "status": "error", "tool": "mouse", "message": "Only left and right buttons are supported."}
    return _send(flags)


def scroll(amount: int) -> Dict[str, object]:
    if not isinstance(amount, int) or amount == 0:
        return {"success": False, "status": "error", "tool": "mouse", "message": "Scroll amount must be a non-zero integer."}
    return _send(MOUSEEVENTF_WHEEL, data=amount * 120)
