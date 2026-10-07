from __future__ import annotations

from typing import Any, Dict, Optional

from backend.ai.brain import interpret_user_input


def process_user_text(user_input: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    return interpret_user_input(user_input=user_input, api_key=api_key)
