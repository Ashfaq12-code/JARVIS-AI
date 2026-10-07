from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict

from backend.computer.app_launcher import launch_application
from backend.computer.browser import google_search_in_chrome, open_browser
from backend.computer.calculator import calculate
from backend.computer.calculator_ui import calculate_in_calculator
from backend.computer.desktop import launch_and_focus, open_and_type
from backend.computer.keyboard import press_key, type_gta6_in_chrome, type_text
from backend.computer.mouse import double_click, left_click, move_mouse, right_click, scroll
from backend.computer.system import get_system_info
from backend.computer.window import focus_window


ToolExecutor = Callable[[Dict[str, Any]], Dict[str, Any]]


@dataclass(frozen=True)
class ComputerTool:
    name: str
    description: str
    category: str
    permission_level: str
    parameters: Dict[str, str]
    execute: ToolExecutor


def _launch(params: Dict[str, Any]) -> Dict[str, Any]:
    return launch_and_focus(str(params.get("app", "")))


def _calculate(params: Dict[str, Any]) -> Dict[str, Any]:
    return calculate(str(params.get("expression", "")))


def _system_info(_: Dict[str, Any]) -> Dict[str, Any]:
    return get_system_info()


def _browser(params: Dict[str, Any]) -> Dict[str, Any]:
    return open_browser(str(params.get("site", "")), str(params.get("query", "")))


def _chrome_keyboard(_: Dict[str, Any]) -> Dict[str, Any]:
    return type_gta6_in_chrome()


def _google_search(params: Dict[str, Any]) -> Dict[str, Any]:
    return google_search_in_chrome(str(params.get("query", "")))


def _desktop_task(params: Dict[str, Any]) -> Dict[str, Any]:
    return open_and_type(str(params.get("app", "")), str(params.get("text", "")))


def _calculator_ui(params: Dict[str, Any]) -> Dict[str, Any]:
    return calculate_in_calculator(str(params.get("expression", "")))


def _move_mouse(params: Dict[str, Any]) -> Dict[str, Any]:
    return move_mouse(int(params.get("x", 0)), int(params.get("y", 0)))


def _scroll(params: Dict[str, Any]) -> Dict[str, Any]:
    return scroll(int(params.get("amount", 0)))


def _focus_window(params: Dict[str, Any]) -> Dict[str, Any]:
    return focus_window(str(params.get("app", "")))


COMPUTER_TOOLS: Dict[str, ComputerTool] = {
    "launch_app": ComputerTool(
        name="launch_app",
        description="Launch an allowlisted Windows application.",
        category="apps",
        permission_level="CONFIRMATION_REQUIRED",
        parameters={"app": "allowlisted application name"},
        execute=_launch,
    ),
    "calculator": ComputerTool(
        name="calculator",
        description="Evaluate a safe mathematical expression.",
        category="utility",
        permission_level="SAFE",
        parameters={"expression": "mathematical expression"},
        execute=_calculate,
    ),
    "system_info": ComputerTool(
        name="system_info",
        description="Read system resource and network information.",
        category="system",
        permission_level="SAFE",
        parameters={},
        execute=_system_info,
    ),
    "browser": ComputerTool(
        name="browser",
        description="Open safe Google or YouTube pages and searches.",
        category="browser",
        permission_level="SAFE",
        parameters={"site": "google or youtube", "query": "optional search terms"},
        execute=_browser,
    ),
    "chrome_keyboard": ComputerTool(
        name="chrome_keyboard",
        description="Focus the launched Chrome window, enter the fixed GTA 6 text, and press Enter.",
        category="keyboard",
        permission_level="CONFIRMATION_REQUIRED",
        parameters={},
        execute=_chrome_keyboard,
    ),
    "google_search": ComputerTool(
        name="google_search",
        description="Use the verified Chrome keyboard control to perform a real Google search.",
        category="browser",
        permission_level="SAFE",
        parameters={"query": "Google search text"},
        execute=_google_search,
    ),
    "desktop_task": ComputerTool(
        name="desktop_task",
        description="Open an allowlisted application and type validated text into its focused window.",
        category="desktop",
        permission_level="CONFIRMATION_REQUIRED",
        parameters={"app": "allowlisted typed application", "text": "text to enter"},
        execute=_desktop_task,
    ),
    "calculator_ui": ComputerTool("calculator_ui", "Calculate through the real Windows Calculator UI Automation controls.", "desktop", "SAFE", {"expression": "mathematical expression"}, _calculator_ui),
    "move_mouse": ComputerTool("move_mouse", "Move the real Windows cursor.", "mouse", "CONFIRMATION_REQUIRED", {"x": "screen x", "y": "screen y"}, _move_mouse),
    "click": ComputerTool("click", "Click the real Windows desktop at the current cursor position.", "mouse", "CONFIRMATION_REQUIRED", {}, lambda _: left_click()),
    "double_click": ComputerTool("double_click", "Double-click the real Windows desktop at the current cursor position.", "mouse", "CONFIRMATION_REQUIRED", {}, lambda _: double_click()),
    "right_click": ComputerTool("right_click", "Right-click the real Windows desktop at the current cursor position.", "mouse", "CONFIRMATION_REQUIRED", {}, lambda _: right_click()),
    "scroll": ComputerTool("scroll", "Scroll the real Windows desktop at the current cursor position.", "mouse", "CONFIRMATION_REQUIRED", {"amount": "wheel clicks"}, _scroll),
    "type_text": ComputerTool("type_text", "Type validated text into the explicitly focused allowlisted application.", "keyboard", "CONFIRMATION_REQUIRED", {"text": "text", "app": "allowlisted application"}, lambda params: type_text(str(params.get("text", "")), str(params.get("app", "")))),
    "press_key": ComputerTool("press_key", "Press one supported key through Win32 input.", "keyboard", "CONFIRMATION_REQUIRED", {"key": "supported key name"}, lambda params: press_key(str(params.get("key", "")))),
    "focus_window": ComputerTool("focus_window", "Find and foreground an allowlisted application window.", "window", "CONFIRMATION_REQUIRED", {"app": "allowlisted application"}, _focus_window),
}


def get_tool(name: str) -> ComputerTool | None:
    return COMPUTER_TOOLS.get((name or "").strip().lower())


def execute_tool(name: str, params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    tool = get_tool(name)
    if not tool:
        return {"success": False, "status": "error", "tool": name, "error": "Tool is not registered."}
    return tool.execute(params or {})