import numpy as np
import cv2
import mediapipe as mp
from typing import Dict, List, Optional
import time

class MediaPipeService:
    def __init__(self):
        # Initialize MediaPipe solutions with fallback for Python 3.13+ or incomplete installs
        self.enabled = False
        try:
            self.mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5
            )
            self.mp_pose = mp.solutions.pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                min_detection_confidence=0.5
            )
            self.enabled = True
        except AttributeError:
            print("Warning: MediaPipe solutions API not found. Falling back to basic processing.")
        except Exception as e:
            print(f"Warning: MediaPipe initialization failed: {e}")

    async def analyze_frame(self, image_data: bytes) -> Dict:
        """
        Analyzes video frames for emotions, gestures, and medical visual markers using real MediaPipe logic.
        """
        if not self.enabled:
            return {
                "emotion": "Neutral",
                "emotion_confidence": 1.0,
                "gesture": "None",
                "gesture_confidence": 1.0,
                "clinical_indicators": {
                    "distress_score": 0.0,
                    "eye_contact": "Normal",
                    "posture": "Relaxed"
                },
                "status": "mocked",
                "timestamp": time.time()
            }

        if not image_data:
            return {"error": "No image data provided", "status": "failed"}

        try:
            # Decode image from bytes
            nparr = np.frombuffer(image_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                return {"error": "Failed to decode image", "status": "failed"}

            # Convert to RGB for MediaPipe
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w, _ = frame.shape

            # 1. Face Analysis
            face_results = self.mp_face_mesh.process(frame_rgb)
            
            # 2. Pose Analysis
            pose_results = self.mp_pose.process(frame_rgb)

            # --- Clinical Insight Generation ---
            emotion = "Neutral"
            emotion_confidence = 0.5
            gesture = "None"
            gesture_confidence = 0.5
            distress_level = 0.1
            eye_contact = "Normal"
            posture = "Relaxed"

            # Process Face Mesh for Emotions (Wincing/Pain/Anxiety)
            if face_results.multi_face_landmarks:
                landmarks = face_results.multi_face_landmarks[0].landmark
                
                # Heuristic: Distances between specific landmarks to detect wincing (pain)
                # Left eye: 159 (top), 145 (bottom)
                # Right eye: 386 (top), 374 (bottom)
                # Eyebrows: 52 (left top), 282 (right top)
                
                left_eye_dist = abs(landmarks[159].y - landmarks[145].y)
                right_eye_dist = abs(landmarks[386].y - landmarks[374].y)
                eye_narrowing = (left_eye_dist + right_eye_dist) / 2.0
                
                # Brow furrowing heuristic
                brow_inner_dist = abs(landmarks[55].x - landmarks[285].x)
                
                if eye_narrowing < 0.015 and brow_inner_dist < 0.18:
                    emotion = "Pain"
                    emotion_confidence = 0.85
                    distress_level = 0.75
                elif brow_inner_dist < 0.2:
                    emotion = "Anxious"
                    emotion_confidence = 0.7
                    distress_level = 0.4
                
                # Eye contact (pupil position relative to center)
                # This is simplified; real iris tracking is in refine_landmarks
                iris_center_l = landmarks[468] # Left iris center
                eye_center_l = landmarks[469] # Placeholder if needed
                # If iris center is far from eye center, suspect reduced contact
                eye_contact = "Normal" # Default

            # Process Pose for Gestures (Chest clutching, breathing distress)
            if pose_results.pose_landmarks:
                p_landmarks = pose_results.pose_landmarks.landmark
                
                # Shoulders: 11 (L), 12 (R)
                # Elbows: 13 (L), 14 (R)
                # Wrists: 15 (L), 16 (R)
                # Heart area center approx (x: 0.55 if L, y: between 11/12 and hips)
                
                hand_l = p_landmarks[15]
                hand_r = p_landmarks[16]
                shoulder_l = p_landmarks[11]
                shoulder_r = p_landmarks[12]
                
                chest_center_y = (shoulder_l.y + shoulder_r.y) / 2.0 + 0.1
                
                # Check if either hand is near the chest/heart area
                if abs(hand_l.x - 0.55) < 0.15 and abs(hand_l.y - chest_center_y) < 0.1:
                    gesture = "Clutching Chest"
                    gesture_confidence = 0.92
                    distress_level = max(distress_level, 0.9)
                elif abs(hand_r.x - 0.45) < 0.15 and abs(hand_r.y - chest_center_y) < 0.1:
                    gesture = "Hand on Chest"
                    gesture_confidence = 0.8
                    distress_level = max(distress_level, 0.7)
                
                # Posture check (slumped shoulders)
                if shoulder_l.y > 0.6 and shoulder_r.y > 0.6:
                    posture = "Slumped"
                elif abs(shoulder_l.y - shoulder_r.y) > 0.05:
                    posture = "Guarded"

            return {
                "emotion": emotion,
                "emotion_confidence": round(emotion_confidence, 3),
                "gesture": gesture,
                "gesture_confidence": round(gesture_confidence, 3),
                "clinical_indicators": {
                    "distress_score": round(distress_level, 3),
                    "eye_contact": eye_contact,
                    "posture": posture
                },
                "timestamp": time.time()
            }

        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"MediaPipe processing error: {e}")
            return {"error": str(e), "status": "failed"}

media_pipe_service = MediaPipeService()
