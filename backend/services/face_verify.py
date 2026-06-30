import os
import cv2
import json
import numpy as np
from backend.config import Config

# Global indicator of whether face_recognition is available
HAS_FACE_RECOGNITION = False

try:
    import face_recognition
    HAS_FACE_RECOGNITION = True
    print("[AI SYSTEM] face_recognition (dlib) loaded successfully.")
except ImportError:
    print("[AI SYSTEM] face_recognition not installed or failed to load. Falling back to MediaPipe FaceSignature for identity verification.")

# We will use MediaPipe face mesh landmarks to build a signature if face_recognition is not available.
import mediapipe as mp
mp_face_mesh = mp.solutions.face_mesh

class FaceVerificationService:
    def __init__(self):
        # Initialize face mesh model for fallback/general landmark extraction
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )

    def extract_encoding(self, image_path_or_bytes):
        """
        Extracts a face encoding vector from an image.
        Supports both file path and raw bytes.
        """
        # Load image with OpenCV
        if isinstance(image_path_or_bytes, str):
            image = cv2.imread(image_path_or_bytes)
        else:
            nparr = np.frombuffer(image_path_or_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Could not decode image.")

        # Convert to RGB (MediaPipe and face_recognition require RGB)
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        if HAS_FACE_RECOGNITION:
            # face_recognition extraction
            encodings = face_recognition.face_encodings(rgb_image)
            if len(encodings) > 0:
                return encodings[0].tolist(), "face_recognition"
            else:
                raise ValueError("No face detected in the image.")
        else:
            # MediaPipe landmark fallback
            results = self.face_mesh.process(rgb_image)
            if not results.multi_face_landmarks:
                raise ValueError("No face detected in the image via MediaPipe FaceMesh.")

            # Get the first face detected
            face_landmarks = results.multi_face_landmarks[0]
            
            # Build normalized landmarks array:
            # 1. Calculate centroid and bounding box
            xs = [lm.x for lm in face_landmarks.landmark]
            ys = [lm.y for lm in face_landmarks.landmark]
            zs = [lm.z for lm in face_landmarks.landmark]
            
            cx, cy, cz = np.mean(xs), np.mean(ys), np.mean(zs)
            width = max(xs) - min(xs)
            height = max(ys) - min(ys)
            scale = max(width, height)
            
            if scale == 0:
                scale = 1.0

            # 2. Subtract centroid and divide by scale to make signature scale- and translation-invariant
            normalized_landmarks = []
            for lm in face_landmarks.landmark:
                normalized_landmarks.append((lm.x - cx) / scale)
                normalized_landmarks.append((lm.y - cy) / scale)
                normalized_landmarks.append((lm.z - cz) / scale)
                
            return normalized_landmarks, "mediapipe_signature"

    def verify_face(self, registered_encoding, frame_bytes):
        """
        Compares registered encoding with a current camera frame.
        """
        try:
            current_encoding, method = self.extract_encoding(frame_bytes)
        except Exception as e:
            return False, f"Failed to extract encoding from verification frame: {str(e)}"

        if HAS_FACE_RECOGNITION:
            # Compare using face_recognition
            match_results = face_recognition.compare_faces(
                [np.array(registered_encoding)], 
                np.array(current_encoding), 
                tolerance=0.6
            )
            distance = face_recognition.face_distance(
                [np.array(registered_encoding)], 
                np.array(current_encoding)
            )[0]
            is_match = bool(match_results[0])
            confidence = float(1.0 - distance)
            return is_match, f"Face verified (Confidence: {confidence:.2f})"
        else:
            # Compare using MediaPipe Landmark Distance (Cosine/Euclidean Similarity)
            reg_array = np.array(registered_encoding)
            curr_array = np.array(current_encoding)
            
            if len(reg_array) != len(curr_array):
                return False, "Encoding format mismatch. Re-register face."

            # Compute Euclidean distance between normalized landmark coordinates
            dist = np.linalg.norm(reg_array - curr_array)
            # Perfect match is 0. Threshold is around 0.18 for general facial expressions
            is_match = bool(dist < 0.18)
            confidence = float(max(0, 1.0 - (dist / 0.18)))
            
            return is_match, f"Face verified via Landmarks (Similarity: {confidence:.2f})"

# Global instance of verification service
face_verifier = FaceVerificationService()
