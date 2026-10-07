import os
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
from dotenv import load_dotenv

from backend.computer.system import get_system_stats
from backend.computer.volume import set_volume, volume_up, volume_down, toggle_mute, get_volume
from backend.computer.applications import launch_application, send_whatsapp_message
from backend.computer.registry import execute_tool
from backend.api.websocket import manager
from backend.ai.router import process_user_text
from backend.security.permissions import check_permission
from backend.security.audit import log_action

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jarvis.core")

app = FastAPI(title="JARVIS Core Backend", version="2.0.0")

FUTURE_SENSITIVE_ACTIONS = {
    "create_file",
    "delete_file",
    "modify_file",
    "install_software",
    "run_command",
    "open_external_link",
    "open_webpage",
    "system_credential",
    "security_settings",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ActionRequest(BaseModel):
    action: str
    params: Optional[Dict[str, Any]] = None


class BrainRequest(BaseModel):
    message: str


def _permission_checked_action(action_name: str, target: str, params: Dict[str, Any], executor):
    confirmed = bool(params.get("confirmed", False))
    decision = check_permission(action_name, target, confirmed=confirmed)

    if not decision.allowed:
        log_action(
            action=action_name,
            target=target,
            permission_level=decision.required_level,
            confirmation_status="denied" if not confirmed else "required",
            result="denied",
            user="system",
            details={"reason": decision.message, "prompt": decision.prompt},
        )
        return {
            "status": "confirmation_required",
            "action": action_name,
            "target": target,
            "required_level": decision.required_level.value,
            "message": decision.message,
            "prompt": decision.prompt,
            "params": params,
        }

    try:
        result = executor()
    except Exception as exc:
        log_action(
            action=action_name,
            target=target,
            permission_level=decision.required_level,
            confirmation_status="confirmed" if confirmed else "auto_allowed",
            result="error",
            user="system",
            details={"error": str(exc)},
        )
        return {"status": "error", "message": str(exc)}

    executed_status = result.get("status") if isinstance(result, dict) else "unknown"
    log_action(
        action=action_name,
        target=target,
        permission_level=decision.required_level,
        confirmation_status="confirmed" if confirmed else "auto_allowed",
        result=executed_status,
        user="system",
        details=result if isinstance(result, dict) else {"value": result},
    )
    return result


@app.get("/")
def read_root():
    return {
        "status": "online",
        "system": "JARVIS CORE AI",
        "user": os.getenv("JARVIS_USER_NAME", "Ashfaq"),
        "version": "2.0.0",
    }


@app.get("/api/health")
def health_check():
    stats = get_system_stats()
    stats["volume"] = get_volume()
    return {"status": "healthy", "telemetry": stats}


@app.get("/api/stats")
def fetch_stats():
    stats = get_system_stats()
    stats["volume"] = get_volume()
    return stats


@app.post("/api/action")
def handle_action(req: ActionRequest):
    act = req.action.lower().strip()
    params = req.params or {}

    if act in FUTURE_SENSITIVE_ACTIONS:
        target = params.get("target") or params.get("path") or params.get("app") or act
        return _permission_checked_action(
            act,
            target,
            params,
            lambda: {"status": "not_implemented", "message": f"Action '{act}' is protected and not enabled yet."},
        )

    if act == "volume_up":
        return _permission_checked_action(
            "volume_up",
            "master_volume",
            params,
            lambda: volume_up(int(params.get("step", 10))),
        )
    elif act == "volume_down":
        return _permission_checked_action(
            "volume_down",
            "master_volume",
            params,
            lambda: volume_down(int(params.get("step", 10))),
        )
    elif act == "set_volume":
        percent = int(params.get("percent", params.get("level", 50)))
        return _permission_checked_action(
            "set_volume",
            "master_volume",
            params,
            lambda: set_volume(percent),
        )
    elif act == "volume_mute":
        return _permission_checked_action(
            "volume_mute",
            "master_volume",
            params,
            lambda: toggle_mute(),
        )
    elif act == "launch_app":
        app_name = params.get("app", "")
        return _permission_checked_action(
            "launch_app",
            app_name or "application",
            params,
            lambda: execute_tool("launch_app", params),
        )
    elif act == "calculator":
        return _permission_checked_action(
            "calculator",
            "mathematical expression",
            params,
            lambda: execute_tool("calculator", params),
        )
    elif act in {"system_info", "get_system_info"}:
        return _permission_checked_action(
            "system_info",
            "local system",
            params,
            lambda: execute_tool("system_info", params),
        )
    elif act == "send_whatsapp_message":
        recipient = params.get("recipient", "")
        message = params.get("message", "")
        return _permission_checked_action(
            "send_whatsapp_message",
            recipient or "whatsapp_contact",
            params,
            lambda: send_whatsapp_message(recipient, message),
        )
    elif act == "browser":
        from backend.computer.browser import open_browser

        site = str(params.get("site", ""))
        query = str(params.get("query", ""))
        return _permission_checked_action(
            "browser",
            f"{site}:{query}" if query else site,
            params,
            lambda: open_browser(site, query),
        )
    elif act == "chrome_keyboard":
        return _permission_checked_action(
            "chrome_keyboard",
            "Chrome address bar",
            params,
            lambda: execute_tool("chrome_keyboard", params),
        )
    elif act == "google_search":
        query = str(params.get("query", ""))
        return _permission_checked_action(
            "google_search",
            query or "Google search",
            params,
            lambda: execute_tool("google_search", params),
        )
    elif act == "desktop_task":
        app = str(params.get("app", ""))
        return _permission_checked_action(
            "desktop_task",
            app or "desktop task",
            params,
            lambda: execute_tool("desktop_task", params),
        )
    elif act == "calculator_ui":
        return _permission_checked_action(
            "calculator_ui",
            "Calculator input",
            params,
            lambda: execute_tool("calculator_ui", params),
        )
    elif act in {"move_mouse", "click", "double_click", "right_click", "scroll", "type_text", "press_key", "focus_window"}:
        target = str(params.get("app", params.get("key", act)))
        return _permission_checked_action(
            act,
            target,
            params,
            lambda: execute_tool(act, params),
        )
    else:
        return {"status": "error", "message": f"Unknown action: {act}"}


@app.post("/api/brain")
def brain_action(req: BrainRequest):
    try:
        result = process_user_text(req.message)

        if result.get("type") == "chat":
            return {"status": "chat", "message": result.get("response", "I can help with that.")}

        if result.get("type") == "action":
            action = result.get("action")
            params = result.get("params") or {}
            if not action:
                return {"status": "chat", "message": "I couldn’t determine a valid action from your request."}

            return handle_action(ActionRequest(action=str(action), params=params))

        return {"status": "chat", "message": "I can help with that."}
    except Exception as exc:
        logger.error(f"Error in brain_action: {exc}", exc_info=True)
        return {"status": "error", "message": f"Brain processing failed: {exc}"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
                msg_type = data.get("type", "")

                if msg_type == "action":
                    req = ActionRequest(action=data.get("action", ""), params=data.get("params"))
                    result = handle_action(req)
                    if result.get("status") == "confirmation_required":
                        await websocket.send_json({"type": "permission_required", "data": result})
                    else:
                        await websocket.send_json({"type": "action_result", "data": result})

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

            except Exception as parse_err:
                logger.error(f"Error handling WS message: {parse_err}")
                await websocket.send_json({"type": "error", "message": str(parse_err)})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
