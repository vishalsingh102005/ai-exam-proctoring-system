import os
import base64
import time
import cv2
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from backend.config import Config
from backend.database.db import db
from backend.routes.auth_routes import auth_bp
from backend.routes.exam_routes import exam_bp
from backend.routes.report_routes import report_bp
from backend.models.models import User, ExamSession, Violation, FaceEncoding, AuditLog, Answer
from backend.services.ai_service import proctor_service
from backend.services.face_verify import face_verifier
from backend.services.report_service import generate_pdf_report
from backend.utils.security import token_required

# Initialize Flask App
app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*", max_http_buffer_size=10 * 1024 * 1024) # 10MB limit

# Registers Blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(exam_bp, url_prefix='/api/exams')
app.register_blueprint(report_bp, url_prefix='/api/reports')

# Serve static upload folders
@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory(Config.UPLOAD_FOLDER, filename)

# Face Registration REST Endpoint
@app.route('/api/auth/register-face', methods=['POST'])
@token_required
def register_face():
    student_id = request.user['id']
    data = request.get_json() or {}
    image_base64 = data.get('image')  # base64 encoded image data

    if not image_base64:
        return jsonify({'message': 'Image data is required.'}), 400

    try:
        # Decode base64 image
        if ',' in image_base64:
            image_data = base64.b64decode(image_base64.split(',')[1])
        else:
            image_data = base64.b64decode(image_base64)
            
        # Extract face encoding
        encoding, method = face_verifier.extract_encoding(image_data)
        
        # Save image file
        filename = f"face_student_{student_id}.jpg"
        filepath = os.path.join(Config.FACES_FOLDER, filename)
        with open(filepath, 'wb') as f:
            f.write(image_data)

        # Store in DB
        rel_path = os.path.join('uploads', 'faces', filename).replace('\\', '/')
        
        # Delete old face encoding if it exists
        db.execute_query("DELETE FROM face_encodings WHERE student_id = %s", (student_id,))
        FaceEncoding.create(student_id, encoding, rel_path)
        
        AuditLog.log(student_id, 'FACE_REGISTERED', f"Face registered successfully via {method}")
        return jsonify({
            'message': 'Face registered successfully!',
            'face_registered': True,
            'image_path': rel_path
        }), 200
    except Exception as e:
        return jsonify({'message': f'Face registration failed: {str(e)}'}), 400

# Face Verification REST Endpoint (Before Exam Start)
@app.route('/api/auth/verify-face', methods=['POST'])
@token_required
def verify_face():
    student_id = request.user['id']
    data = request.get_json() or {}
    image_base64 = data.get('image')

    if not image_base64:
        return jsonify({'message': 'Snapshot image data is required.'}), 400

    try:
        # Fetch registered encoding
        reg_enc = FaceEncoding.get_by_student(student_id)
        if not reg_enc:
            return jsonify({'message': 'Face encoding not found. Please register face first.'}), 404

        # Decode snapshot image
        if ',' in image_base64:
            image_data = base64.b64decode(image_base64.split(',')[1])
        else:
            image_data = base64.b64decode(image_base64)
            
        # Verify
        is_match, details = face_verifier.verify_face(reg_enc['encoding_data'], image_data)
        
        if is_match:
            AuditLog.log(student_id, 'FACE_VERIFIED_EXAM', f"Identity verified before exam: {details}")
            return jsonify({'success': True, 'message': 'Face identity verified successfully!'}), 200
        else:
            AuditLog.log(student_id, 'FACE_VERIFICATION_FAILED', f"Failed identity check: {details}")
            return jsonify({'success': False, 'message': 'Verification failed. Face does not match registered student.'}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': f'Verification error: {str(e)}'}), 400


# Upload Video Chunk Endpoint (Video Recording)
@app.route('/api/exams/sessions/<int:session_id>/upload-video', methods=['POST'])
@token_required
def upload_video(session_id):
    if 'video' not in request.files:
        return jsonify({'message': 'No video file found.'}), 400
        
    file = request.files['video']
    if file.filename == '':
        return jsonify({'message': 'Empty file.'}), 400

    session = ExamSession.get_by_id(session_id)
    if not session:
        return jsonify({'message': 'Session not found.'}), 404

    try:
        filename = f"session_{session_id}.webm"
        filepath = os.path.join(Config.RECORDINGS_FOLDER, filename)
        file.save(filepath)
        
        rel_path = os.path.join('uploads', 'recordings', filename).replace('\\', '/')
        # Update session with path
        db.execute_query("UPDATE exam_sessions SET video_path = %s WHERE id = %s", (rel_path, session_id))
        
        AuditLog.log(session['student_id'], 'VIDEO_RECORDING_SAVED', f"Video recording saved: {rel_path}")
        return jsonify({'message': 'Video uploaded successfully.', 'path': rel_path}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to upload video: {str(e)}'}), 500


# =====================================================================
# SOCKET.IO HANDLERS
# =====================================================================

# Keep track of last warning timestamps to throttle warning count increments
# session_id -> { violation_type -> timestamp }
last_warning_times = {}

@socketio.on('connect')
def handle_connect():
    print(f"[SOCKET] Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"[SOCKET] Client disconnected: {request.sid}")

@socketio.on('join_exam')
def on_join_exam(data):
    session_id = data.get('session_id')
    if session_id:
        room = f"session_{session_id}"
        join_room(room)
        print(f"[SOCKET] Student joined room: {room}")

@socketio.on('join_admin')
def on_join_admin():
    join_room('admin_dashboard')
    print("[SOCKET] Admin joined admin_dashboard room")

@socketio.on('leave_exam')
def on_leave_exam(data):
    session_id = data.get('session_id')
    if session_id:
        room = f"session_{session_id}"
        leave_room(room)
        print(f"[SOCKET] Student left room: {room}")

@socketio.on('video_frame')
def handle_video_frame(data):
    session_id = data.get('session_id')
    frame_data = data.get('frame') # Base64 encoded string

    if not session_id or not frame_data:
        return

    session = ExamSession.get_by_id(session_id)
    if not session or session['status'] != 'active':
        return

    try:
        # Decode Base64 string
        if ',' in frame_data:
            img_bytes = base64.b64decode(frame_data.split(',')[1])
        else:
            img_bytes = base64.b64decode(frame_data)
            
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return

        # Run AI proctor analysis
        violations, annotated_frame, metrics = proctor_service.analyze_frame(frame)

        # warning/score variables
        warning_increment = 0
        current_time = time.time()
        
        if session_id not in last_warning_times:
            last_warning_times[session_id] = {}

        # Track new violations to log
        new_violations = []

        # Process violations
        for v in violations:
            # Throttle warnings of the same type to once every 4 seconds
            last_time = last_warning_times[session_id].get(v, 0)
            if current_time - last_time > 4.0:
                last_warning_times[session_id][v] = current_time
                new_violations.append(v)
                
                # Screen missing/looking away accumulates warnings. Cell phones/Multiple faces are critical!
                warning_increment += 1

        # Calculate Cheating Score (0 - 100) dynamically based on metrics
        # Weights: Phone=50, MultFace=30, FaceMissing=20, Speak=15, LookAway=10
        cheating_score = 0
        if metrics['phone_detected']:
            cheating_score += 50
        if metrics['persons_count'] > 1:
            cheating_score += 30
        if "Face Not Found" in violations or "Face Covered" in violations:
            cheating_score += 20
        if "Mouth Talking" in violations:
            cheating_score += 15
        if any(x in violations for x in ["Looking Left", "Looking Right", "Looking Up", "Looking Down", "Head Turning"]):
            cheating_score += 10
            
        cheating_score = min(100, max(0, cheating_score))

        # Decay cheating score if no violations found (smooth decay)
        if not violations:
            decay = int(session['cheating_score'] * 0.1)
            cheating_score = max(0, session['cheating_score'] - max(1, decay))
        else:
            # Blend new score with historical score to avoid jitter
            cheating_score = int(0.6 * cheating_score + 0.4 * session['cheating_score'])

        # Update warning counts
        new_warning_count = session['warning_count'] + warning_increment
        
        # Save screenshot if critical violations occurred
        screenshot_path = None
        critical_infractions = ["Mobile Phone Detection using YOLOv8", "Book Detection", "Multiple Faces", "Mouth Talking", "Face Not Found"]
        
        has_critical = any(inf in new_violations for inf in critical_infractions)
        if has_critical and warning_increment > 0:
            # Compress and save annotated frame
            timestamp = int(time.time())
            filename = f"violation_{session_id}_{timestamp}.jpg"
            save_path = os.path.join(Config.SCREENSHOTS_FOLDER, filename)
            
            cv2.imwrite(save_path, annotated_frame)
            screenshot_path = os.path.join('uploads', 'screenshots', filename).replace('\\', '/')

        # Save new violations to database
        for nv in new_violations:
            Violation.create(session_id, nv, confidence_score=0.9, screenshot_path=screenshot_path)

        # Update Database session metrics
        if warning_increment > 0 or cheating_score != session['cheating_score']:
            ExamSession.update_progress(session_id, cheating_score, new_warning_count)

        # Build annotated frame base64 string to send back to Admin
        _, buffer = cv2.imencode('.jpg', annotated_frame)
        annotated_b64 = base64.b64encode(buffer).decode('utf-8')

        # Check for Auto Submit
        if new_warning_count > 5:
            # Auto Submit
            scored, total = Answer.calculate_score(session_id)
            ExamSession.complete_session(session_id, cheating_score, new_warning_count)
            AuditLog.log(session['student_id'], 'AUTO_SUBMIT_VIOLATION', f"Exam Auto-submitted due to excessive warnings (>5)")
            generate_pdf_report(session_id)
            
            # Emit Auto Submit Command to student
            emit('auto_submit', {
                'message': 'Your exam has been automatically submitted due to exceeding the maximum warning limit.'
            }, room=f"session_{session_id}")
            
            # Update Admin
            emit('admin_session_update', {
                'session_id': session_id,
                'status': 'completed',
                'cheating_score': cheating_score,
                'warning_count': new_warning_count,
                'is_auto_submitted': True
            }, room='admin_dashboard')
            return

        # Emit update to Student
        emit('proctor_feedback', {
            'warning_count': new_warning_count,
            'cheating_score': cheating_score,
            'violations': violations
        }, room=f"session_{session_id}")

        # Emit update to Admin Monitor
        emit('admin_frame_update', {
            'session_id': session_id,
            'student_name': session.get('student_name', 'Student'),
            'exam_title': session.get('exam_title', 'Exam'),
            'frame': f"data:image/jpeg;base64,{annotated_b64}",
            'violations': violations,
            'warning_count': new_warning_count,
            'cheating_score': cheating_score,
            'metrics': metrics
        }, room='admin_dashboard')

    except Exception as e:
        print(f"[SOCKET ERROR] Frame processing failed: {e}")

@socketio.on('student_action')
def handle_student_action(data):
    """
    Handles events emitted by student browser like:
    - tab_switch / window_minimize
    - copy_paste_attempt
    - right_click_attempt
    """
    session_id = data.get('session_id')
    action_type = data.get('action') # e.g. "Tab Switching", "Minimize", "Text Copy"
    
    if not session_id or not action_type:
        return
        
    session = ExamSession.get_by_id(session_id)
    if not session or session['status'] != 'active':
        return

    # Increment warning count
    new_warning_count = session['warning_count'] + 1
    new_cheating_score = min(100, session['cheating_score'] + 10)
    
    Violation.create(session_id, f"Browser Violation: {action_type}", confidence_score=1.0)
    ExamSession.update_progress(session_id, new_cheating_score, new_warning_count)
    
    # Check for Auto Submit
    if new_warning_count > 5:
        ExamSession.complete_session(session_id, new_cheating_score, new_warning_count)
        AuditLog.log(session['student_id'], 'AUTO_SUBMIT_VIOLATION', f"Exam Auto-submitted due to browser warning limit (>5)")
        generate_pdf_report(session_id)
        
        emit('auto_submit', {
            'message': 'Your exam has been automatically submitted due to exceeding the maximum warning limit.'
        }, room=f"session_{session_id}")
        
        emit('admin_session_update', {
            'session_id': session_id,
            'status': 'completed',
            'cheating_score': new_cheating_score,
            'warning_count': new_warning_count,
            'is_auto_submitted': True
        }, room='admin_dashboard')
        return

    # Emit warning feed back to student
    emit('proctor_feedback', {
        'warning_count': new_warning_count,
        'cheating_score': new_cheating_score,
        'alert': f"Browser restriction triggered: {action_type}"
    }, room=f"session_{session_id}")

    # Update Admin
    emit('admin_session_update', {
        'session_id': session_id,
        'warning_count': new_warning_count,
        'cheating_score': new_cheating_score,
        'latest_action': action_type
    }, room='admin_dashboard')

@socketio.on('admin_command')
def handle_admin_command(data):
    """
    Handles commands sent by Admin to student:
    - warn (sends warning message)
    - terminate (instantly submits/ends exam)
    """
    session_id = data.get('session_id')
    command = data.get('command') # "warn" or "terminate"
    message = data.get('message', '')
    
    if not session_id or not command:
        return
        
    session = ExamSession.get_by_id(session_id)
    if not session or session['status'] != 'active':
        return

    if command == "warn":
        # Increment warnings and send warning message
        new_warning_count = session['warning_count'] + 1
        ExamSession.update_progress(session_id, session['cheating_score'], new_warning_count)
        
        Violation.create(session_id, f"Admin Warning: {message}", confidence_score=1.0)
        
        emit('admin_warning', {
            'message': message,
            'warning_count': new_warning_count
        }, room=f"session_{session_id}")
        
        # Update Admin Panel
        emit('admin_session_update', {
            'session_id': session_id,
            'warning_count': new_warning_count,
            'cheating_score': session['cheating_score']
        }, room='admin_dashboard')
        
    elif command == "terminate":
        # Terminate immediately
        ExamSession.terminate_session(session_id)
        AuditLog.log(session['student_id'], 'EXAM_TERMINATED', "Terminated by Administrator")
        generate_pdf_report(session_id)
        
        emit('exam_terminated', {
            'message': 'Your exam session has been terminated by the administrator.'
        }, room=f"session_{session_id}")
        
        emit('admin_session_update', {
            'session_id': session_id,
            'status': 'terminated'
        }, room='admin_dashboard')

# Create tables and startup
if __name__ == '__main__':
    # Initialize DB (creates DB & runs schema.sql migrations)
    # Automatically handles SQLite fallback or MySQL configurations
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
