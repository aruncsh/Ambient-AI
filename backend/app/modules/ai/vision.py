from app.modules.ai.media_pipe import media_pipe_service

class VisionAI:
    def __init__(self):
        self.enabled = media_pipe_service.enabled

    async def analyze_emotions(self, frame_bytes: bytes):
        """Detects patient anxiety or discomfort markers."""
        res = await media_pipe_service.analyze_frame(frame_bytes)
        if "error" in res:
            return {"emotion": "unknown", "status": "failed"}
        return {"emotion": res.get("emotion", "neutral"), "score": res.get("emotion_confidence", 0.0)}

    async def detect_gestures(self, frame_bytes: bytes):
        """Detects gestures like 'clutching chest'."""
        res = await media_pipe_service.analyze_frame(frame_bytes)
        if "error" in res:
            return {"gesture": "unknown", "status": "failed"}
        return {"gesture": res.get("gesture", "none"), "score": res.get("gesture_confidence", 0.0)}

vision_service = VisionAI()
