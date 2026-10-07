from __future__ import annotations

import ast
import operator
import re
from typing import Any, Dict


class CalculatorError(ValueError):
    """Raised when an expression is outside the calculator grammar."""


_BINARY_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
}


def normalize_expression(expression: str) -> str:
    normalized = expression.lower().strip()
    normalized = re.sub(r"\bwhat\s+is\b", "", normalized)
    normalized = re.sub(r"\bcalculate\b", "", normalized)
    normalized = re.sub(r"\bplease\b", "", normalized)
    percent_match = re.fullmatch(r"\s*(-?[0-9.]+)\s*(?:percent|percentage|%)\s+of\s+(-?[0-9.]+)\s*", normalized)
    if percent_match:
        return f"({percent_match.group(1)} / 100) * {percent_match.group(2)}"
    normalized = re.sub(r"\btimes\b|\bmultiplied by\b|\bmultiplied\b", "*", normalized)
    normalized = re.sub(r"\bdivided by\b|\bdivide\b|\bover\b", "/", normalized)
    normalized = re.sub(r"\bplus\b|\badd\b|\badded to\b", "+", normalized)
    normalized = re.sub(r"\bminus\b|\bsubtract\b|\bsubtracted from\b", "-", normalized)
    normalized = normalized.replace("^", "**")
    normalized = re.sub(r"[^0-9.()+%*/\-\s]", "", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _evaluate(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _evaluate(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        value = _evaluate(node.operand)
        return value if isinstance(node.op, ast.UAdd) else -value
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY_OPERATORS:
        left = _evaluate(node.left)
        right = _evaluate(node.right)
        if isinstance(node.op, ast.Div) and right == 0:
            raise CalculatorError("Division by zero is not allowed.")
        return _BINARY_OPERATORS[type(node.op)](left, right)
    raise CalculatorError("Only numbers, parentheses, +, -, *, /, and % are supported.")


def calculate(expression: str) -> Dict[str, Any]:
    normalized = normalize_expression(expression)
    if not normalized:
        return {"success": False, "status": "error", "tool": "calculator", "error": "Expression is empty."}

    try:
        tree = ast.parse(normalized, mode="eval")
        result = _evaluate(tree)
    except (SyntaxError, CalculatorError, ValueError, ZeroDivisionError) as exc:
        return {"success": False, "status": "error", "tool": "calculator", "expression": normalized, "error": str(exc)}

    if not result.is_integer():
        value: int | float = round(result, 10)
    else:
        value = int(result)
    return {
        "success": True,
        "status": "success",
        "tool": "calculator",
        "expression": normalized,
        "result": value,
        "message": f"The answer is {value:,}.",
    }