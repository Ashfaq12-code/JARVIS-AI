from __future__ import annotations

import re
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Dict

from pywinauto import Desktop

from backend.computer.app_launcher import launch_application
from backend.computer.calculator import calculate, normalize_expression


BUTTON_IDS: Dict[str, str] = {
    "0": "num0Button",
    "1": "num1Button",
    "2": "num2Button",
    "3": "num3Button",
    "4": "num4Button",
    "5": "num5Button",
    "6": "num6Button",
    "7": "num7Button",
    "8": "num8Button",
    "9": "num9Button",
    ".": "decimalSeparatorButton",
    "+": "plusButton",
    "-": "minusButton",
    "*": "multiplyButton",
    "/": "divideButton",
    "%": "percentButton",
    "negate": "negateButton",
    "=": "equalButton",
}

_TOKEN_PATTERN = re.compile(r"\d+(?:\.\d+)?|[()+\-*/%]")
_PERCENT_OF_PATTERN = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*(?:percent|percentage|%)\s+of\s+(-?\d+(?:\.\d+)?)\s*$", re.IGNORECASE)
_DISPLAY_PATTERN = re.compile(r"^Display is\s+(.+?)\s*$", re.IGNORECASE)
_CLEAR_BUTTON_ID = "clearButton"


@dataclass(frozen=True)
class CalculatorUiResult:
    success: bool
    status: str
    message: str
    expression: str = ""
    displayed_result: str = ""
    expected_result: str = ""
    sequence: tuple[str, ...] = ()
    details: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "status": self.status,
            "tool": "calculator_ui",
            "message": self.message,
            "expression": self.expression,
            "displayed_result": self.displayed_result,
            "expected_result": self.expected_result,
            "sequence": list(self.sequence),
            "details": self.details,
        }


def _failure(message: str, expression: str = "", details: str = "") -> Dict[str, Any]:
    return CalculatorUiResult(False, "error", message, expression=expression, details=details).to_dict()


def _normalise_expression(expression: str) -> str:
    raw = " ".join((expression or "").strip().split())
    if _PERCENT_OF_PATTERN.fullmatch(raw):
        return raw
    normalized = raw.lower()
    normalized = re.sub(r"\bmultiplied\s+by\b|\bmultiply\s+by\b|\btimes\b|\bx\b", "*", normalized)
    normalized = re.sub(r"\bdivided\s+by\b|\bdivide\s+by\b", "/", normalized)
    normalized = re.sub(r"\bplus\b|\badd\b", "+", normalized)
    normalized = re.sub(r"\bminus\b|\bsubtract\b", "-", normalized)
    normalized = re.sub(r"\bpercent\s+of\b|\bpercentage\s+of\b", "% of", normalized)
    return " ".join(normalized.split())


def expression_tokens(expression: str) -> tuple[str, ...]:
    clean = _normalise_expression(expression)
    percent_of = _PERCENT_OF_PATTERN.fullmatch(clean)
    if percent_of:
        # Use ordinary UI buttons to avoid version-dependent percent-button semantics.
        clean = f"{percent_of.group(1)} / 100 * {percent_of.group(2)}"

    if not clean or any(character not in "0123456789.()+-*/% " for character in clean):
        raise ValueError("Only numbers, decimals, +, -, *, /, and % are supported.")
    tokens = tuple(_TOKEN_PATTERN.findall(clean))
    if "".join(tokens).replace(".", "") == "" or " ".join(tokens) == "":
        raise ValueError("The calculation is empty.")
    if "".join(tokens).replace(".", "").replace("+", "").replace("-", "").replace("*", "").replace("/", "").replace("%", "").isdigit() is False:
        raise ValueError("The calculation contains unsupported characters.")
    if "(" in tokens or ")" in tokens:
        raise ValueError("Calculator does not expose parenthesis controls in the audited UI.")
    if tokens[0] in {"+", "*", "/", "%"} or tokens[-1] in {"+", "-", "*", "/", "%"}:
        raise ValueError("The calculation has an invalid operator position.")
    expect_number = True
    for token in tokens:
        if expect_number:
            if token in {"+", "-"}:
                continue
            if not re.fullmatch(r"\d+(?:\.\d+)?", token):
                raise ValueError("The calculation has invalid number placement.")
            expect_number = False
        elif token in {"+", "-", "*", "/"}:
            expect_number = True
        elif token == "%":
            expect_number = False
        else:
            raise ValueError("The calculation has invalid operator placement.")
    if expect_number:
        raise ValueError("The calculation ends with an operator.")
    return tokens


def button_sequence(expression: str) -> tuple[str, ...]:
    tokens = expression_tokens(expression)
    sequence: list[str] = []
    expecting_number = True
    for token in tokens:
        if token in BUTTON_IDS:
            if token == "-" and expecting_number:
                sequence.append(BUTTON_IDS["negate"])
            elif token == "+" and expecting_number:
                continue
            else:
                sequence.append(BUTTON_IDS[token])
                expecting_number = token not in {"+", "-", "*", "/", "%"}
        else:
            sequence.extend(BUTTON_IDS[digit] for digit in token)
            expecting_number = False
    sequence.append(BUTTON_IDS["="])
    return tuple(sequence)


def parse_display_result(name: str) -> str:
    match = _DISPLAY_PATTERN.match((name or "").strip())
    if not match:
        raise ValueError("Calculator result display did not have the expected format.")
    displayed = match.group(1).replace(",", "").strip()
    if not re.fullmatch(r"-?\d+(?:\.\d+)?", displayed):
        raise ValueError("Calculator result display was not numeric.")
    return displayed


def _result_matches(displayed: str, expected: object) -> bool:
    try:
        return Decimal(displayed) == Decimal(str(expected))
    except InvalidOperation:
        return False


class CalculatorController:
    def __init__(self, desktop: Any | None = None) -> None:
        self.desktop = desktop or Desktop(backend="uia")
        self.window: Any | None = None

    def find_calculator_window(self) -> Any:
        windows = self.desktop.windows(title="Calculator", class_name="ApplicationFrameWindow")
        if not windows:
            raise RuntimeError("Calculator UI window was not found.")
        active_windows = [window for window in windows if window.is_active()]
        for window in active_windows + windows:
            if getattr(window.element_info, "visible", True):
                return window
        raise RuntimeError("Calculator UI window is not visible.")

    def open_calculator_ui(self) -> Any:
        launch = launch_application("calculator")
        if not launch.get("success"):
            raise RuntimeError(str(launch.get("message") or launch.get("error") or "Calculator could not be launched."))
        deadline = time.monotonic() + 4.0
        while time.monotonic() < deadline:
            try:
                self.window = self.find_calculator_window()
                return self.window
            except RuntimeError:
                time.sleep(0.1)
        raise RuntimeError("Calculator launched, but its UI Automation window was not ready.")

    def _get_window(self) -> Any:
        return self.window or self.find_calculator_window()

    def find_calculator_controls(self) -> Dict[str, Any]:
        window = self._get_window()
        controls: Dict[str, Any] = {}
        descendants = window.descendants()
        for control_id in set(BUTTON_IDS.values()) | {_CLEAR_BUTTON_ID, "CalculatorResults"}:
            matches = [
                control for control in descendants
                if control.element_info.automation_id == control_id
            ]
            if not matches:
                raise RuntimeError(f"Calculator control {control_id} was not found.")
            controls[control_id] = matches[0]
        return controls

    def press_calculator_button(self, button_id: str, controls: Dict[str, Any] | None = None) -> None:
        if button_id not in set(BUTTON_IDS.values()) | {_CLEAR_BUTTON_ID}:
            raise ValueError(f"Unsupported Calculator control: {button_id}")
        control = (controls or self.find_calculator_controls())[button_id]
        if not control.element_info.enabled or getattr(control.element_info, "offscreen", False):
            raise RuntimeError(f"Calculator control {button_id} is unavailable.")
        control.invoke()

    def read_calculator_result(self, controls: Dict[str, Any] | None = None) -> str:
        control = (controls or self.find_calculator_controls())["CalculatorResults"]
        return parse_display_result(control.element_info.name)

    def calculate_expression(self, expression: str) -> Dict[str, Any]:
        clean = _normalise_expression(expression)
        try:
            sequence = button_sequence(clean)
            expected = calculate(clean)
            if not expected.get("success"):
                return _failure("I couldn't complete that calculation in Calculator.", clean, str(expected.get("error", "Invalid expression.")))
            window = self.open_calculator_ui()
            controls = self.find_calculator_controls()
            self.press_calculator_button("clearButton", controls)
            for control_id in sequence:
                self.press_calculator_button(control_id, controls)
            displayed = self.read_calculator_result(controls)
            expected_value = expected["result"]
            if not _result_matches(displayed, expected_value):
                return _failure("I couldn't verify the displayed Calculator result.", clean, f"Displayed {displayed}; expected {expected_value}.")
            return CalculatorUiResult(True, "success", f"The answer is {displayed}.", clean, displayed, str(expected_value), sequence).to_dict()
        except (RuntimeError, ValueError, KeyError) as exc:
            return _failure("I couldn't complete that calculation in Calculator.", clean, str(exc))


def calculate_in_calculator(expression: str) -> Dict[str, Any]:
    return CalculatorController().calculate_expression(expression)