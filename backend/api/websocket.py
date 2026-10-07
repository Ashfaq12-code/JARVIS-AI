import asyncio
import json
import logging
from typing import Dict, List, Any
from fastapi import WebSocket, WebSocketDisconnect
from backend.computer.system import get_system_stats
from backend.computer.volume import get_volume

logger = logging.getLogger("jarvis.websocket")


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._telemetry_task: asyncio.Task = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Active count: {len(self.active_connections)}")

        stats = get_system_stats()
        stats["volume"] = get_volume()
        await websocket.send_json({"type": "stats", "data": stats})
        await websocket.send_json({"type": "state", "state": "IDLE"})

        if not self._telemetry_task or self._telemetry_task.done():
            self._telemetry_task = asyncio.create_task(self._telemetry_loop())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Active count: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for dead in disconnected:
            self.disconnect(dead)

    async def broadcast_state(self, state: str, extra: Dict[str, Any] = None):
        payload = {"type": "state", "state": state}
        if extra:
            payload.update(extra)
        await self.broadcast(payload)

    async def _telemetry_loop(self):
        while True:
            if not self.active_connections:
                break
            try:
                stats = get_system_stats()
                stats["volume"] = get_volume()
                await self.broadcast({"type": "stats", "data": stats})
            except Exception as e:
                logger.error(f"Telemetry broadcast error: {e}")
            await asyncio.sleep(2.0)


manager = ConnectionManager()
