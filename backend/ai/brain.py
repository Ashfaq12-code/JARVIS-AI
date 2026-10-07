from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from google import genai
from openai import OpenAI

from backend.ai.prompts import JARVIS_SYSTEM_PROMPT

load_dotenv()

SUPPORTED_ACTIONS = {
    "volume_up",
    "volume_down",
    "set_volume",
    "volume_mute",
    "launch_app",
    "send_whatsapp_message",
    "calculator",
    "system_info",
    "browser",
    "google_search",
    "desktop_task",
    "calculator_ui",
}


def _local_intent(user_input: str) -> Optional[Dict[str, Any]]:
    command_text = re.sub(r"^\s*(?:jarvis|hey jarvis)[,\s:]*", "", user_input, flags=re.IGNORECASE).strip().rstrip("?.!")
    text = command_text.lower()

    google_search_match = (
        re.search(r"\bsearch\s+google\s+(?:for\s+)?(.+)$", text)
        or re.search(r"\bsearch\s+for\s+(.+?)\s+on\s+google$", text)
        or re.search(r"\bgoogle\s+(.+)$", text)
    )
    if google_search_match:
        query = google_search_match.group(1).strip()
        return {"type": "action", "action": "google_search", "params": {"query": query}, "response": f"Searching Google for {query}."}

    youtube_search_match = (
        re.search(r"\bsearch\s+youtube\s+(?:for\s+)?(.+)$", text)
        or re.search(r"\bsearch\s+for\s+(.+?)\s+on\s+youtube$", text)
        or re.search(r"\byoutube\s+(?:search\s+(?:for\s+)?)?(.+)$", text)
    )
    if youtube_search_match:
        query = youtube_search_match.group(1).strip()
        return {"type": "action", "action": "browser", "params": {"site": "youtube", "query": query}, "response": f"Searching YouTube for {query}."}

    chrome_search_match = re.search(
        r"\b(?:open|launch|start)\s+(?:google\s+)?chrome\s+and\s+search\s+(?:google\s+)?(?:for\s+)?(.+)$",
        command_text,
        flags=re.IGNORECASE,
    )
    if chrome_search_match:
        query = chrome_search_match.group(1).strip()
        return {"type": "action", "action": "google_search", "params": {"query": query}, "response": f"Opening Chrome and searching Google for {query}."}

    typing_match = re.search(r"\b(?:open|launch|start)\s+(notepad)\s+and\s+type\s+(.+)$", command_text, flags=re.IGNORECASE)
    if typing_match:
        app, typed_text = typing_match.groups()
        return {"type": "action", "action": "desktop_task", "params": {"app": app.lower(), "text": typed_text.strip()}, "response": f"Opening {app.title()} and typing your message."}

    calculator_ui_match = re.search(r"\b(?:open|launch|start)\s+(?:the\s+)?calculator\s+and\s+(?:type|calculate)\s+(.+)$", command_text, flags=re.IGNORECASE)
    if calculator_ui_match:
        return {"type": "action", "action": "calculator_ui", "params": {"expression": calculator_ui_match.group(1).strip()}, "response": "Opening Calculator and entering the expression."}

    search_match = re.search(r"\bsearch\s+(google|youtube)\s+(?:for|about)\s+(.+)$", text)
    if search_match:
        site, query = search_match.groups()
        return {"type": "action", "action": "browser", "params": {"site": site, "query": query.strip()}, "response": f"Searching {site.title()} for {query.strip()}."}

    home_match = re.search(r"\b(?:open|launch|start)\s+(google|youtube)\b", text)
    if home_match:
        site = home_match.group(1)
        return {"type": "action", "action": "browser", "params": {"site": site}, "response": f"Opening {site.title()}."}

    app_match = re.search(
        r"\b(?:can you\s+|please\s+)?(?:open|launch|start)\s+(?:the\s+)?(calculator|calc|notepad|paint|file explorer|explorer|command prompt|cmd|chrome|browser|default browser)\b",
        text,
    )
    if app_match:
        return {"type": "action", "action": "launch_app", "params": {"app": app_match.group(1)}, "response": "I can open that application."}

    calculation_markers = ("calculate", "what is", "what's", "how much is", "times", "multiplied", "divided", "plus", "minus", "percent", "percentage")
    has_symbolic_operation = bool(re.search(r"\d\s*[+*/%xX-]\s*-?\d", text))
    if (any(marker in text for marker in calculation_markers) or has_symbolic_operation) and re.search(r"\d", text):
        expression = re.sub(r"^(?:calculate|what is|what's|how much is|can you calculate|please calculate)\s+", "", command_text, flags=re.IGNORECASE).strip()
        return {"type": "action", "action": "calculator_ui", "params": {"expression": expression}, "response": "I will calculate that in Calculator."}

    if re.search(r"\b(cpu|memory|ram|disk|system information|system info|network status)\b", text):
        return {"type": "action", "action": "system_info", "params": {}, "response": "I can read the current system information."}

    if re.search(r"\b(?:turn\s+(?:the\s+)?volume\s+up|increase\s+(?:the\s+)?volume|volume\s+up)\b", text):
        return {"type": "action", "action": "volume_up", "params": {"step": 10}, "response": "Turning the volume up."}

    if re.search(r"\b(?:turn\s+(?:the\s+)?volume\s+down|decrease\s+(?:the\s+)?volume|reduce\s+(?:the\s+)?volume|volume\s+down)\b", text):
        return {"type": "action", "action": "volume_down", "params": {"step": 10}, "response": "Turning the volume down."}

    if re.search(r"\b(?:mute\s+volume|unmute\s+volume|mute|unmute)\b", text):
        return {"type": "action", "action": "volume_mute", "params": {}, "response": "Toggling volume mute."}

    return None


class JARVISBrain:
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini") -> None:
        gemini_key = os.getenv("GEMINI_API_KEY")
        openai_key = api_key or os.getenv("OPENAI_API_KEY")
        self.gemini_client = genai.Client(api_key=gemini_key) if gemini_key else None
        self.client = OpenAI(api_key=openai_key) if openai_key else None
        self.gemini_model = "gemini-3.6-flash"
        self.model = model
        self.missing_api_key = not self.gemini_client and not self.client

    def interpret(self, user_input: str) -> Dict[str, Any]:
        if not user_input or not user_input.strip():
            return {"type": "chat", "response": "I need a command or question to help with."}

        local_intent = _local_intent(user_input)
        if local_intent:
            return local_intent

        if self.missing_api_key:
            return {"type": "chat", "response": "I’m ready to help, but the AI service is not configured yet."}

        try:
            raw_response = (
                self._call_gemini(user_input)
                if self.gemini_client
                else self._call_openai(user_input)
            )
        except Exception as exc:
            import logging
            logging.getLogger("jarvis.brain").warning(f"AI cloud request failed ({exc}). Falling back.")
            err_str = str(exc).lower()
            if "429" in err_str or "quota" in err_str or "too many requests" in err_str:
                return {"type": "chat", "response": "My neural link is experiencing a brief rate limit. Please try again in a few moments, Sir."}
            return {"type": "chat", "response": "I am standing by, Sir, but could not connect to the cloud AI service right now."}

        try:
            parsed = json.loads(raw_response)
        except (TypeError, json.JSONDecodeError):
            return {"type": "chat", "response": str(raw_response).strip() or "I can help with that."}

        if parsed.get("type") == "action":
            action = str(parsed.get("action", "")).strip()
            if not action or action not in SUPPORTED_ACTIONS:
                return {
                    "type": "chat",
                    "response": "That capability is not currently available in this JARVIS setup.",
                }

            params = parsed.get("params", {})
            if not isinstance(params, dict):
                params = {}

            response_text = parsed.get("response") or "I can help with that request."
            return {
                "type": "action",
                "action": action,
                "params": params,
                "response": response_text,
            }

        response_text = parsed.get("response") or "I can help with that."
        return {"type": "chat", "response": str(response_text)}

    def _call_openai(self, user_input: str) -> str:
        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": JARVIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        content = completion.choices[0].message.content
        if not content:
            return '{"type": "chat", "response": "I am ready to help."}'
        return content

    def _call_gemini(self, user_input: str) -> str:
        response = self.gemini_client.interactions.create(
            model=self.gemini_model,
            input=f"{JARVIS_SYSTEM_PROMPT}\n\nUser request:\n{user_input}",
        )

        content = response.output_text
        if not content:
            return '{"type": "chat", "response": "I am ready to help."}'
        return content


def interpret_user_input(user_input: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    try:
        brain = JARVISBrain(api_key=api_key)
        return brain.interpret(user_input)
    except Exception:
        return {"type": "chat", "response": "I couldn't connect to the AI service right now."}
