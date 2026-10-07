from __future__ import annotations

import unittest

from backend.ai.brain import _local_intent
from backend.computer.app_launcher import resolve_application
from backend.computer.browser import build_google_search_url, normalize_google_query
from backend.computer.calculator import calculate
from backend.computer.calculator_ui import BUTTON_IDS, CalculatorController, button_sequence, parse_display_result, expression_tokens
from backend.computer.keyboard import INPUT, press_key, type_text, type_text_to_window
from backend.computer.mouse import INPUT as MOUSE_INPUT
from backend.computer.registry import get_tool
from backend.security.permissions import PermissionLevel, check_permission
from backend.computer.window import resolve_process_window, verify_foreground


class CalculatorTests(unittest.TestCase):
    def test_multiplication(self) -> None:
        self.assertEqual(calculate("25 * 40")["result"], 1000)

    def test_subtraction(self) -> None:
        self.assertEqual(calculate("500 minus 125")["result"], 375)

    def test_division(self) -> None:
        self.assertEqual(calculate("100 / 4")["result"], 25)

    def test_percent_of(self) -> None:
        self.assertEqual(calculate("15 percent of 200")["result"], 30)

    def test_generic_arithmetic_values(self) -> None:
        cases = {
            "25 * 40": 1000,
            "123 + 456": 579,
            "999 - 347": 652,
            "12 * 15": 180,
            "144 / 12": 12,
            "12.5 * 4": 50,
            "75% of 2400": 1800,
            "-25 + 10": -15,
            "100 - -25": 125,
        }
        for expression, expected in cases.items():
            with self.subTest(expression=expression):
                self.assertEqual(calculate(expression)["result"], expected)

    def test_rejects_python_input(self) -> None:
        result = calculate("__import__('os').system('whoami')")
        self.assertFalse(result["success"])


class ApplicationResolverTests(unittest.TestCase):
    def test_calculator_is_allowlisted(self) -> None:
        spec = resolve_application("Calculator")
        self.assertIsNotNone(spec)
        self.assertEqual(spec.label, "Calculator")

    def test_arbitrary_path_is_rejected(self) -> None:
        self.assertIsNone(resolve_application(r"C:\\Windows\\System32\\cmd.exe"))

    def test_chrome_keyboard_tool_is_registered(self) -> None:
        tool = get_tool("chrome_keyboard")
        self.assertIsNotNone(tool)
        self.assertEqual(tool.permission_level, "CONFIRMATION_REQUIRED")

    def test_desktop_tools_are_registered(self) -> None:
        for name in ("move_mouse", "click", "double_click", "right_click", "scroll", "type_text", "press_key", "focus_window", "desktop_task"):
            tool = get_tool(name)
            self.assertIsNotNone(tool, name)
            self.assertEqual(tool.permission_level, "CONFIRMATION_REQUIRED")

    def test_win32_input_structures_have_expected_size(self) -> None:
        self.assertEqual(__import__("ctypes").sizeof(INPUT), 40)
        self.assertEqual(__import__("ctypes").sizeof(MOUSE_INPUT), 40)

    def test_keyboard_validation_rejects_control_text(self) -> None:
        self.assertFalse(type_text("hello\n")['success'])
        self.assertFalse(press_key("unsupported")['success'])
        self.assertFalse(type_text_to_window(1, "hello")['success'])

    def test_invalid_process_window_and_foreground_are_rejected(self) -> None:
        self.assertIsNone(resolve_process_window(-1, timeout=0.01))
        self.assertFalse(verify_foreground(0))


class IntentTests(unittest.TestCase):
    def test_open_calculator_intent(self) -> None:
        intent = _local_intent("Open Calculator")
        self.assertEqual(intent["action"], "launch_app")
        self.assertEqual(intent["params"]["app"], "calculator")

    def test_calculator_intent(self) -> None:
        intent = _local_intent("Calculate 25 times 40")
        self.assertEqual(intent["action"], "calculator_ui")

    def test_system_info_intent(self) -> None:
        intent = _local_intent("How much CPU am I using?")
        self.assertEqual(intent["action"], "system_info")

    def test_natural_calculation_variants(self) -> None:
        self.assertEqual(_local_intent("JARVIS, calculate 25 times 40.")["params"]["expression"], "25 times 40")
        self.assertEqual(_local_intent("What's 500 minus 125?")["params"]["expression"], "500 minus 125")
        self.assertEqual(_local_intent("Calculate 15 percent of 200")["action"], "calculator_ui")

    def test_generic_natural_calculation_variants(self) -> None:
        cases = {
            "Calculate 123 plus 456": "123 plus 456",
            "Calculate 999 minus 347": "999 minus 347",
            "Calculate 12 x 15": "12 x 15",
            "Calculate 144 divided by 12": "144 divided by 12",
            "What is 12.5 times 4?": "12.5 times 4",
            "What's 75 percent of 2400?": "75 percent of 2400",
            "Calculate 50 + 25": "50 + 25",
            "Calculate 50 * 25": "50 * 25",
            "Calculate 50 / 25": "50 / 25",
        }
        for command, expression in cases.items():
            with self.subTest(command=command):
                intent = _local_intent(command)
                self.assertEqual(intent["action"], "calculator_ui")
                self.assertEqual(intent["params"]["expression"], expression)

    def test_application_variants(self) -> None:
        for command in ("Open Calculator", "Launch Calculator", "Please open Calculator"):
            self.assertEqual(_local_intent(command)["params"]["app"], "calculator")
        self.assertEqual(_local_intent("Open Chrome")["params"]["app"], "chrome")

    def test_browser_search_intents(self) -> None:
        google = _local_intent("Search Google for GTA 6")
        youtube = _local_intent("JARVIS, search YouTube for JARVIS AI")
        self.assertEqual(google["action"], "google_search")
        self.assertEqual(google["params"], {"query": "gta 6"})
        self.assertEqual(youtube["params"], {"site": "youtube", "query": "jarvis ai"})

    def test_open_chrome_and_search_intent(self) -> None:
        intent = _local_intent("Open Chrome and search GTA 6")
        self.assertEqual(intent["action"], "google_search")
        self.assertEqual(intent["params"], {"query": "GTA 6"})

    def test_notepad_task_intent(self) -> None:
        intent = _local_intent("Open Notepad and type Hello JARVIS")
        self.assertEqual(intent["action"], "desktop_task")
        self.assertEqual(intent["params"], {"app": "notepad", "text": "Hello JARVIS"})

    def test_calculator_ui_intent_is_explicit(self) -> None:
        intent = _local_intent("Open Calculator and type 25 times 40")
        self.assertEqual(intent["action"], "calculator_ui")
        self.assertEqual(intent["params"]["expression"], "25 times 40")

    def test_calculator_ui_control_mapping_and_sequence(self) -> None:
        self.assertEqual(BUTTON_IDS["2"], "num2Button")
        self.assertEqual(BUTTON_IDS["*"], "multiplyButton")
        self.assertEqual(button_sequence("25 * 40"), ("num2Button", "num5Button", "multiplyButton", "num4Button", "num0Button", "equalButton"))
        self.assertEqual(button_sequence("-25 + 10"), ("negateButton", "num2Button", "num5Button", "plusButton", "num1Button", "num0Button", "equalButton"))

    def test_calculator_ui_expression_validation(self) -> None:
        self.assertEqual(expression_tokens("25 * 40"), ("25", "*", "40"))
        self.assertEqual(expression_tokens("15 percent of 200"), ("15", "/", "100", "*", "200"))
        with self.assertRaises(ValueError):
            expression_tokens("__import__('os')")
        with self.assertRaises(ValueError):
            expression_tokens("(25 + 15) * 4")

    def test_calculator_ui_result_parsing(self) -> None:
        self.assertEqual(parse_display_result("Display is 1,000"), "1000")
        with self.assertRaises(ValueError):
            parse_display_result("Calculator is ready")

    def test_calculator_ui_unavailable_is_reported(self) -> None:
        class EmptyDesktop:
            def windows(self, **_: object) -> list[object]:
                return []

        with self.assertRaises(RuntimeError):
            CalculatorController(desktop=EmptyDesktop()).find_calculator_window()

    def test_google_search_variants_extract_query(self) -> None:
        for command in (
            "Search Google for GTA 6",
            "Google GTA 6",
            "Search for GTA 6 on Google",
            "Search Google GTA 6",
        ):
            intent = _local_intent(command)
            self.assertEqual(intent["action"], "google_search")
            self.assertEqual(intent["params"]["query"], "gta 6")

    def test_google_search_target_is_https_and_encoded(self) -> None:
        self.assertEqual(build_google_search_url("GTA 6"), "https://www.google.com/search?q=GTA+6")
        self.assertEqual(normalize_google_query("  GTA   6 "), "GTA 6")
        with self.assertRaises(ValueError):
            normalize_google_query("\n")

    def test_desktop_actions_require_confirmation(self) -> None:
        decision = check_permission("type_text", "Notepad")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.required_level, PermissionLevel.CONFIRMATION_REQUIRED)
        self.assertTrue(check_permission("type_text", "Notepad", confirmed=True).allowed)
        self.assertTrue(check_permission("calculator_ui").allowed)


if __name__ == "__main__":
    unittest.main()