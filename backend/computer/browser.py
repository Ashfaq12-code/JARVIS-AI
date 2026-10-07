from __future__ import annotations

import shutil
import subprocess
import webbrowser
from urllib.parse import quote_plus
from typing import Dict

from backend.computer.app_launcher import launch_application
from backend.computer.keyboard import type_text_in_chrome


class BrowserRequestError(ValueError):
    pass


SEARCH_URLS = {
    "google": "https://www.google.com/search?q={query}",
    "youtube": "https://www.youtube.com/results?search_query={query}",
}

HOME_URLS = {
    "google": "https://www.google.com",
    "youtube": "https://www.youtube.com",
}


def normalize_google_query(query: str) -> str:
    clean_query = " ".join((query or "").split())
    if not clean_query or len(clean_query) > 200 or any(ord(character) < 32 for character in clean_query):
        raise BrowserRequestError("Google search text is empty, too long, or contains control characters.")
    return clean_query


def build_google_search_url(query: str) -> str:
    clean_query = normalize_google_query(query)
    return f"https://www.google.com/search?q={quote_plus(clean_query)}"


def google_search_in_chrome(query: str) -> Dict[str, object]:
    clean_query = normalize_google_query(query)
    safe_target = build_google_search_url(clean_query)
    keyboard_result = type_text_in_chrome(clean_query)

    if not keyboard_result.get("success") and keyboard_result.get("message") == "No visible Chrome window is available for keyboard control.":
        launch_result = launch_application("chrome")
        if not launch_result.get("success"):
            return launch_result
        import time

        time.sleep(1.0)
        keyboard_result = type_text_in_chrome(clean_query)

    if not keyboard_result.get("success"):
        try:
            _open_safe_url(safe_target)
            return {
                "success": True,
                "status": "success",
                "tool": "google_search",
                "query": clean_query,
                "safe_target": safe_target,
                "window_title": "Google Chrome",
                "message": f"Searching Google for {clean_query}.",
                "voice": f"Searching Google for {clean_query}.",
            }
        except Exception as exc:
            return {
                "success": False,
                "status": "error",
                "tool": "google_search",
                "message": "I couldn't complete the Google search in Chrome.",
                "details": str(exc),
            }

    return {
        "success": True,
        "status": "success",
        "tool": "google_search",
        "query": clean_query,
        "safe_target": safe_target,
        "window_title": keyboard_result.get("window_title"),
        "message": f"Searching Google for {clean_query}.",
        "voice": f"Searching Google for {clean_query}.",
    }


def _open_safe_url(url: str) -> None:
    from backend.computer.app_launcher import _resolve_chrome_executable
    chrome = _resolve_chrome_executable()
    if chrome:
        subprocess.Popen([chrome, url], shell=False)
        return
    if not webbrowser.open(url, new=2, autoraise=True):
        raise OSError("The default browser did not accept the navigation request.")


def open_browser(destination: str, query: str = "") -> Dict[str, object]:
    site = " ".join((destination or "").lower().strip().split())
    clean_query = " ".join((query or "").strip().split())

    if clean_query:
        template = SEARCH_URLS.get(site)
        if not template:
            raise BrowserRequestError("Only Google and YouTube searches are supported.")
        url = template.format(query=quote_plus(clean_query))
        message = f"Searching {site.title()} for {clean_query}."
    else:
        url = HOME_URLS.get(site)
        if not url:
            raise BrowserRequestError("Only Google and YouTube navigation is supported.")
        message = f"Opening {site.title()}."

    _open_safe_url(url)
    return {
        "success": True,
        "status": "success",
        "tool": "browser",
        "site": site,
        "query": clean_query,
        "url": url,
        "message": message,
        "voice": message,
    }
