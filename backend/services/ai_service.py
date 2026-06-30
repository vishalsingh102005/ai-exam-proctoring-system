import cv2
import numpy as np
import time
import os
from ultralytics import YOLO
import mediapipe as mp
from backend.config import Config

# Initialize MediaPipe solutions
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

class AIProctoringService:
    def __init__(self):
        # Load YOLOv8n (nano) model - light weight (~6MB), downloads automatically
        try:
            self.yolo_model = YOLO('yolov8n.pt')
            print("[AI SYSTEM] YOLOv8 model loaded successfully.")
        except Exception as e:
            print(f"[AI SYSTEM] Warning: Failed to load YOLOv8 model: {e}. Object detection will run in mock mode.")
            self.yolo_model = None
            
        # Initialize MediaPipe Face Mesh
        self.face_mesh = mp_face_mesh.FaceMesh(
            max_num_faces=3,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Track eye-closure state for sleeping alert (consecutive frames)
        self.eye_closed_start_time = None
        self.talking_start_time = None

    def analyze_frame(self, frame):
        """
        Analyzes a single video frame (numpy BGR image).
        Returns:
            violations (list): List of detected violation strings.
            annotated_frame (numpy array): Frame with drawn bounding boxes / landmark overlays.
            metrics (dict): Ratios and calculated metrics for dashboard statistics.
        """
        violations = []
        metrics = {
            'ear': 0.0,
            'mar': 0.0,
            'gaze_x': 0.5,
            'gaze_y': 0.5,
            'brightness': 0.0,
            'persons_count': 0,
            'phone_detected': False,
            'book_detected': False,
        }

        if frame is None:
            return violations, frame, metrics

        h, w, _ = frame.shape
        annotated_frame = frame.copy()

        # 1. Environment Checks: Low Light & Camera Covered
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray))
        metrics['brightness'] = brightness
        
        std_dev = float(np.std(gray))

        if brightness < 10 and std_dev < 5:
            violations.append("Camera Covered Detection")
            cv2.putText(annotated_frame, "WARNING: CAMERA COVERED", (30, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        elif brightness < 40:
            violations.append("Low Light Detection")
            cv2.putText(annotated_frame, "WARNING: LOW LIGHT", (30, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        # 2. YOLOv8 Object Detection (Cell phones, Books, Multiple people)
        phone_found = False
        book_found = False
        person_count = 0
        unauthorized_object = False

        if self.yolo_model is not None:
            try:
                results = self.yolo_model(frame, verbose=False)
                # Results contains boxes
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        cls_idx = int(box.cls[0])
                        conf = float(box.conf[0])
                        label = self.yolo_model.names[cls_idx]
                        
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        # We only track with confidence > 0.4
                        if conf > 0.4:
                            if label == "cell phone":
                                phone_found = True
                                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                                cv2.putText(annotated_frame, "Cell Phone", (x1, y1 - 10), 
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                            elif label == "book":
                                book_found = True
                                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 165, 255), 2)
                                cv2.putText(annotated_frame, "Book", (x1, y1 - 10), 
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 2)
                            elif label == "person":
                                person_count += 1
                                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (255, 0, 0), 1)
                            elif label in ["laptop", "tv", "remote"]:
                                unauthorized_object = True
                                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                                cv2.putText(annotated_frame, "Unauthorized Object", (x1, y1 - 10), 
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
            except Exception as e:
                print(f"[AI SYSTEM] YOLO prediction error: {e}")

        metrics['persons_count'] = person_count
        metrics['phone_detected'] = phone_found
        metrics['book_detected'] = book_found

        if phone_found:
            violations.append("Mobile Phone Detection using YOLOv8")
        if book_found:
            violations.append("Book Detection")
        if person_count > 1:
            violations.append("Person Behind Candidate")
        if unauthorized_object:
            violations.append("Unauthorized Object Detection")

        # 3. MediaPipe Face Mesh: Face counts, Sleeping, Talking, Gaze/Head pose
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)

        if not results.multi_face_landmarks:
            # If no face is detected by MediaPipe, check if YOLO saw a person.
            # If person is present but no face landmarks, it might be covered or turned away
            if person_count > 0:
                violations.append("Face Covered")
                cv2.putText(annotated_frame, "WARNING: FACE COVERED", (30, 80), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            else:
                violations.append("Face Not Found")
                cv2.putText(annotated_frame, "WARNING: FACE MISSING", (30, 80), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        else:
            face_count = len(results.multi_face_landmarks)
            if face_count > 1:
                violations.append("Multiple Faces")
                cv2.putText(annotated_frame, f"WARNING: {face_count} FACES DETECTED", (30, 80), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            
            # Analyze primary face landmarks
            landmarks = results.multi_face_landmarks[0].landmark
            
            # Draw Face Mesh contours
            mp_drawing.draw_landmarks(
                image=annotated_frame,
                landmark_list=results.multi_face_landmarks[0],
                connections=mp_face_mesh.FACEMESH_CONTOURS,
                landmark_drawing_spec=None,
                connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style()
            )

            # --- Head Turn / Gaze Tracking ---
            # Landmarks: Left boundary (234), Right boundary (454), Nose Tip (1)
            # Top boundary (10), Bottom boundary (152)
            left_x = landmarks[234].x
            right_x = landmarks[454].x
            nose_x = landmarks[1].x
            
            top_y = landmarks[10].y
            bottom_y = landmarks[152].y
            nose_y = landmarks[1].y

            # Ratios
            h_ratio = (nose_x - left_x) / (right_x - left_x + 1e-6)
            v_ratio = (nose_y - top_y) / (bottom_y - top_y + 1e-6)
            
            metrics['gaze_x'] = float(h_ratio)
            metrics['gaze_y'] = float(v_ratio)

            # Gaze violations
            if h_ratio < 0.38:
                violations.append("Looking Right")
                cv2.putText(annotated_frame, "LOOKING RIGHT", (30, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
            elif h_ratio > 0.62:
                violations.append("Looking Left")
                cv2.putText(annotated_frame, "LOOKING LEFT", (30, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
            
            if v_ratio < 0.38:
                violations.append("Looking Up")
                cv2.putText(annotated_frame, "LOOKING UP", (30, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
            elif v_ratio > 0.62:
                violations.append("Looking Down")
                cv2.putText(annotated_frame, "LOOKING DOWN", (30, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)

            # Calculate head turning (broad angle warning)
            if h_ratio < 0.35 or h_ratio > 0.65 or v_ratio < 0.35 or v_ratio > 0.65:
                violations.append("Head Turning")

            # --- Eye Closed / Sleeping Detection ---
            # EAR formula: vertical distances / horizontal distance
            # Left Eye: upper (159), lower (145), left (33), right (133)
            # Right Eye: upper (386), lower (374), left (362), right (263)
            def eye_aspect_ratio(p_upper, p_lower, p_left, p_right):
                # Euclidean distances
                dist_v = np.sqrt((p_upper.x - p_lower.x)**2 + (p_upper.y - p_lower.y)**2)
                dist_h = np.sqrt((p_left.x - p_right.x)**2 + (p_left.y - p_right.y)**2)
                return dist_v / (dist_h + 1e-6)

            ear_left = eye_aspect_ratio(landmarks[159], landmarks[145], landmarks[33], landmarks[133])
            ear_right = eye_aspect_ratio(landmarks[386], landmarks[374], landmarks[362], landmarks[263])
            avg_ear = float((ear_left + ear_right) / 2.0)
            metrics['ear'] = avg_ear

            if avg_ear < 0.14:  # Threshold for closed eyes
                if self.eye_closed_start_time is None:
                    self.eye_closed_start_time = time.time()
                else:
                    duration = time.time() - self.eye_closed_start_time
                    if duration > 2.5: # 2.5 seconds threshold
                        violations.append("Sleeping")
                        violations.append("Eyes Closed")
                        cv2.putText(annotated_frame, "WARNING: SLEEPING / EYES CLOSED", (30, 180), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            else:
                self.eye_closed_start_time = None

            # --- Mouth Open / Talking Detection ---
            # MAR formula: vertical distance between lips (13, 14) / horizontal lip corners (61, 291)
            lip_upper = landmarks[13]
            lip_lower = landmarks[14]
            corner_l = landmarks[61]
            corner_r = landmarks[291]
            
            mar = float(np.sqrt((lip_upper.x - lip_lower.x)**2 + (lip_upper.y - lip_lower.y)**2) / 
                        (np.sqrt((corner_l.x - corner_r.x)**2 + (corner_l.y - corner_r.y)**2) + 1e-6))
            metrics['mar'] = mar

            if mar > 0.40: # Threshold for mouth open
                if self.talking_start_time is None:
                    self.talking_start_time = time.time()
                else:
                    duration = time.time() - self.talking_start_time
                    if duration > 1.5: # Talking continuously for > 1.5s
                        violations.append("Mouth Talking")
                        cv2.putText(annotated_frame, "TALKING DETECTED", (30, 210), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            else:
                self.talking_start_time = None

        return list(set(violations)), annotated_frame, metrics

# Global instance of proctoring service
proctor_service = AIProctoringService()
