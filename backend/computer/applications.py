import os
import subprocess
from typing import Dict, Optional

from backend.computer.app_launcher import launch_application as launch_allowlisted_application

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WHATSAPP_SCRIPT = os.path.join(BASE_DIR, "whatsapp_send.ps1")

APP_MAP = {
    "whatsapp": {"cmd": "powershell -NoProfile -Command \"Start-Process whatsapp:\"", "label": "WhatsApp"},
    "calc": {"cmd": "start \"\" \"calc.exe\"", "label": "Calculator"},
    "calculator": {"cmd": "start \"\" \"calc.exe\"", "label": "Calculator"},
    "code": {"cmd": "start \"\" \"code\"", "label": "Visual Studio Code"},
    "vscode": {"cmd": "start \"\" \"code\"", "label": "Visual Studio Code"},
    "chrome": {"cmd": "start \"\" \"chrome.exe\"", "label": "Google Chrome"},
    "browser": {"cmd": "start \"\" \"chrome.exe\"", "label": "Google Chrome"},
    "notepad": {"cmd": "start \"\" \"notepad.exe\"", "label": "Notepad"},
    "explorer": {"cmd": "start \"\" \"explorer.exe\"", "label": "File Explorer"},
    "drive": {"cmd": "start \"\" \"explorer.exe\"", "label": "File Explorer"},
    "taskmgr": {"cmd": "start \"\" \"taskmgr.exe\"", "label": "Task Manager"},
}


def launch_application(app_key: str) -> Dict[str, str]:
    result = launch_allowlisted_application(app_key)
    if result.get("success"):
        return {
            "status": "success",
            "success": True,
            "tool": "launch_app",
            "message": result.get("message", "Application launched."),
            "voice": result.get("message", "Application launched."),
            "app": result.get("target", app_key),
        }
    return {
        "status": "error",
        "success": False,
        "tool": "launch_app",
        "message": str(result.get("error", "Application could not be launched.")),
    }


def send_whatsapp_message(recipient: str, message: str) -> Dict[str, str]:
    clean_recipient = recipient.strip()
    clean_message = message.strip()

    if os.path.exists(WHATSAPP_SCRIPT):
        contact_arg = clean_recipient.replace('"', '`"')
        msg_arg = clean_message.replace('"', '`"')
        cmd = f'powershell -NoProfile -ExecutionPolicy Bypass -File "{WHATSAPP_SCRIPT}" -Contact "{contact_arg}" -Message "{msg_arg}"'
        try:
            subprocess.Popen(cmd, shell=True)
            return {
                "status": "success",
                "message": f"Sir, searching {clean_recipient} in WhatsApp and dispatching message.",
                "voice": f"Sir, searching {clean_recipient} in WhatsApp and sending message now.",
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    else:
        clean_phone = "".join(c for c in clean_recipient if c.isdigit())
        target_url = (
            f"whatsapp://send?phone={clean_phone}&text={clean_message}"
            if clean_phone
            else f"whatsapp://send?text={clean_message}"
        )
        cmd = f'powershell -NoProfile -Command "Start-Process \'{target_url}\'"'
        subprocess.Popen(cmd, shell=True)
        return {
            "status": "success",
            "message": f"Dispatched message to {clean_recipient}",
            "voice": f"Sir, opening WhatsApp to message {clean_recipient}",
        }
