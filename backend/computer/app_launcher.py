from __future__ import annotations

import os
import shutil
import subprocess
import webbrowser
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional


@dataclass(frozen=True)
class ApplicationSpec:
    name: str
    label: str
    command: tuple[str, ...] | None = None
    executable: str | None = None
    default_browser: bool = False


APPLICATION_ALLOWLIST: Dict[str, ApplicationSpec] = {
    "calculator": ApplicationSpec("calculator", "Calculator", ("calc.exe",)),
    "calc": ApplicationSpec("calculator", "Calculator", ("calc.exe",)),
    "notepad": ApplicationSpec("notepad", "Notepad", ("notepad.exe",)),
    "paint": ApplicationSpec("paint", "Paint", ("mspaint.exe",)),
    "explorer": ApplicationSpec("explorer", "File Explorer", ("explorer.exe",)),
    "file explorer": ApplicationSpec("explorer", "File Explorer", ("explorer.exe",)),
    "cmd": ApplicationSpec("cmd", "Command Prompt", ("cmd.exe",)),
    "command prompt": ApplicationSpec("cmd", "Command Prompt", ("cmd.exe",)),
    "chrome": ApplicationSpec("chrome", "Google Chrome", executable="chrome.exe"),
    "browser": ApplicationSpec("browser", "Default browser", default_browser=True),
    "default browser": ApplicationSpec("browser", "Default browser", default_browser=True),
}


def _resolve_chrome_executable() -> Optional[str]:
    path_match = shutil.which("chrome.exe")
    if path_match:
        return path_match

    program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
    program_files_x86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    local_app_data = os.environ.get("LOCALAPPDATA")
    candidates = [
        Path(program_files) / "Google" / "Chrome" / "Application" / "chrome.exe",
        Path(program_files_x86) / "Google" / "Chrome" / "Application" / "chrome.exe",
    ]
    if local_app_data:
        candidates.append(Path(local_app_data) / "Google" / "Chrome" / "Application" / "chrome.exe")

    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return None


def resolve_application(app_key: str) -> Optional[ApplicationSpec]:
    normalized = " ".join((app_key or "").lower().strip().split())
    spec = APPLICATION_ALLOWLIST.get(normalized)
    if not spec:
        return None
    if spec.name == "chrome":
        chrome_executable = _resolve_chrome_executable()
        if not chrome_executable:
            return None
        return ApplicationSpec(
            name=spec.name,
            label=spec.label,
            command=spec.command,
            executable=chrome_executable,
            default_browser=spec.default_browser,
        )
    if spec.executable and not shutil.which(spec.executable):
        return None
    return spec


def launch_application(app_key: str) -> Dict[str, object]:
    spec = resolve_application(app_key)
    if not spec:
        normalized = " ".join((app_key or "").lower().strip().split())
        if normalized in APPLICATION_ALLOWLIST:
            return {"success": False, "status": "error", "tool": "launch_app", "error": f"{APPLICATION_ALLOWLIST[normalized].label} could not be located."}
        return {"success": False, "status": "error", "tool": "launch_app", "error": "Application not allowed"}

    try:
        process_id = None
        if spec.default_browser:
            if not webbrowser.open("about:blank", new=0, autoraise=True):
                raise OSError("Default browser did not accept the launch request.")
        else:
            command = list(spec.command or (spec.executable or "",))
            process = subprocess.Popen(command, shell=False)
            process_id = process.pid
    except (OSError, subprocess.SubprocessError) as exc:
        return {"success": False, "status": "error", "tool": "launch_app", "error": f"{spec.label} could not be launched: {exc}"}

    return {
        "success": True,
        "status": "success",
        "tool": "launch_app",
        "target": spec.name,
        "pid": process_id,
        "message": f"{spec.label} launched.",
    }