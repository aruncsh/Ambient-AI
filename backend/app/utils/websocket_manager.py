from typing import Dict, List
from fastapi import WebSocket

class WebSocketManager:
    def __init__(self):
        # encounter_id -> list of websockets
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = []
        self.rooms[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].remove(websocket)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast(self, room_id: str, message: str):
        if room_id in self.rooms:
            for connection in self.rooms[room_id]:
                await connection.send_text(message)

manager = WebSocketManager()
