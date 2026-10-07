import os
import sys
import json
import asyncio
import ctypes
import subprocess
import webbrowser
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import psutil

app = FastAPI(title="Jarvis AI Core")

app.add_middleware(
    CORSMiddleware,  
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# Windows Native Multimedia Keys
VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
KEYEVENTF_KEYUP = 0x0002

def press_multimedia_key(vk_code: int, times: int = 1):
    try:
        user32 = ctypes.windll.user32
        for _ in range(times):
            user32.keybd_event(vk_code, 0, 0, 0)
            user32.keybd_event(vk_code, 0, KEYEVENTF_KEYUP, 0)
        return True
    except Exception as e:
        print(f"Key error: {e}")
        return False

# Real-time System Actions
def execute_system_action(action: str, params: dict = None):
    params = params or {}
    action = action.lower().strip()

    if action == "volume_up":
        press_multimedia_key(VK_VOLUME_UP, 4)
        return {"status": "success", "message": "Master volume increased"}

    elif action == "volume_down":
        press_multimedia_key(VK_VOLUME_DOWN, 4)
        return {"status": "success", "message": "Master volume decreased"}

    elif action == "volume_mute":
        press_multimedia_key(VK_VOLUME_MUTE, 1)
        return {"status": "success", "message": "Master volume muted / unmuted"}

    elif action == "open_chrome" or action == "open_url":
        url = params.get("url", "https://www.google.com")
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
        webbrowser.open_new_tab(url)
        return {"status": "success", "message": f"Opened {url} in Chrome"}

    elif action == "search_web":
        query = params.get("query", "")
        url = f"https://www.google.com/search?q={query}"
        webbrowser.open_new_tab(url)
        return {"status": "success", "message": f"Searching web for: {query}"}

    elif action == "launch_app":
        app_name = params.get("app", "").lower().strip()
        app_commands = {
            "vscode": "code",
            "code": "code",
            "notepad": "notepad.exe",
            "calculator": "calc.exe",
            "calc": "calc.exe",
            "explorer": "explorer.exe",
            "taskmgr": "taskmgr.exe",
            "terminal": "wt.exe",
            "cmd": "cmd.exe",
            "spotify": "spotify.exe"
        }
        cmd = app_commands.get(app_name, app_name)
        try:
            subprocess.Popen(cmd, shell=True)
            return {"status": "success", "message": f"Launched application: {app_name}"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to launch {app_name}: {str(e)}"}

    elif action == "get_system_stats":
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        return {
            "status": "success",
            "cpu": cpu,
            "ram_used_gb": round(mem.used / (1024**3), 1),
            "ram_total_gb": round(mem.total / (1024**3), 1),
            "ram_percent": mem.percent
        }

    return {"status": "error", "message": f"Unknown action: {action}"}

@app.get("/")
async def root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Jarvis AI Core is running. Place index.html in static/"}

@app.post("/api/action")
async def handle_action(payload: dict):
    action = payload.get("action", "")
    params = payload.get("params", {})
    result = execute_system_action(action, params)
    await manager.broadcast({"type": "action_result", "data": result})
    return result

@app.get("/api/stats")
async def get_stats():
    return execute_system_action("get_system_stats")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial telemetry
        stats = execute_system_action("get_system_stats")
        await websocket.send_json({"type": "stats", "data": stats})

        while True:
            data = await websocket.receive_json()
            event_type = data.get("type", "")

            if event_type == "action":
                action = data.get("action", "")
                params = data.get("params", {})
                result = execute_system_action(action, params)
                await websocket.send_json({"type": "action_result", "data": result})

            elif event_type == "voice_command":
                cmd = data.get("command", "").lower()
                response_text = f"Executing: {cmd}"
                
                # Command router
                if "face" in cmd or "show me your face" in cmd:
                    await manager.broadcast({"type": "morph_face", "step": 5})
                    response_text = "Assembling neural face matrix."
                elif "interface" in cmd or "close face" in cmd or "hud" in cmd or "main" in cmd:
                    await manager.broadcast({"type": "morph_face", "step": 1})
                    response_text = "Returning to main command HUD."
                elif "volume up" in cmd or "increase volume" in cmd:
                    execute_system_action("volume_up")
                    response_text = "Master volume increased."
                elif "volume down" in cmd or "decrease volume" in cmd or "reduce volume" in cmd:
                    execute_system_action("volume_down")
                    response_text = "Master volume decreased."
                elif "mute" in cmd:
                    execute_system_action("volume_mute")
                    response_text = "Master audio toggled."
                elif "chrome" in cmd or "browser" in cmd or "search" in cmd:
                    execute_system_action("open_chrome", {"url": "https://www.google.com"})
                    response_text = "Opening web navigator."
                elif "calculator" in cmd:
                    execute_system_action("launch_app", {"app": "calc"})
                    response_text = "Opening Calculator."
                elif "code" in cmd or "vs code" in cmd:
                    execute_system_action("launch_app", {"app": "code"})
                    response_text = "Opening Visual Studio Code."

                await websocket.send_json({
                    "type": "jarvis_response",
                    "text": response_text
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Background telemetry sender
@app.on_event("startup")
async def start_telemetry_loop():
    async def telemetry_loop():
        while True:
            await asyncio.sleep(2.5)
            if manager.active_connections:
                stats = execute_system_action("get_system_stats")
                await manager.broadcast({"type": "stats", "data": stats})
    asyncio.create_task(telemetry_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
