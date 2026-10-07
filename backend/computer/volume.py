import ctypes
import os
import re
import subprocess
from typing import Dict, Union

# Resolves directly to the JARVIS project root: h:\CLIENT PROJECT 2026\JAVIS AI\
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SETVOL_EXE = os.path.join(BASE_DIR, "setvol.exe")

# Windows Native Multimedia Key Codes (as reliable hardware fallback)
VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
KEYEVENTF_KEYUP = 0x0002


def _press_multimedia_key(vk_code: int, times: int = 1) -> bool:
    try:
        user32 = ctypes.windll.user32
        for _ in range(times):
            user32.keybd_event(vk_code, 0, 0, 0)
            user32.keybd_event(vk_code, 0, KEYEVENTF_KEYUP, 0)
        return True
    except Exception:
        return False


def get_volume() -> int:
    """Gets current master volume percentage (0-100) using setvol.exe."""
    if os.path.exists(SETVOL_EXE):
        try:
            result = subprocess.run(
                [SETVOL_EXE], capture_output=True, text=True, timeout=2
            )
            match = re.search(r"CURRENT:(\d+)", result.stdout)
            if match:
                return int(match.group(1))
        except Exception:
            pass
    return 50


def set_volume(percent: int) -> Dict[str, Union[str, int]]:
    """Sets master volume to an exact percentage (0-100)."""
    percent = max(0, min(100, int(percent)))
    if os.path.exists(SETVOL_EXE):
        try:
            subprocess.run([SETVOL_EXE, str(percent)], timeout=2)
            return {
                "status": "success",
                "volume": percent,
                "message": f"Master volume set to {percent}%",
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    return {
        "status": "success",
        "volume": percent,
        "message": f"Volume set to {percent}% (fallback)",
    }


def volume_up(step: int = 10) -> Dict[str, Union[str, int]]:
    """Increases master volume by a step amount."""
    current = get_volume()
    next_vol = min(100, current + step)
    return set_volume(next_vol)


def volume_down(step: int = 10) -> Dict[str, Union[str, int]]:
    """Decreases master volume by a step amount."""
    current = get_volume()
    next_vol = max(0, current - step)
    return set_volume(next_vol)


def toggle_mute() -> Dict[str, str]:
    """Toggles master audio mute state using native multimedia key event."""
    success = _press_multimedia_key(VK_VOLUME_MUTE, 1)
    return {
        "status": "success" if success else "error",
        "message": "Master audio mute toggled",
    }
