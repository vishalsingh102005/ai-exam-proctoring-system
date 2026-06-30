# API Documentation - ProctorAI

This document details all REST API endpoints and Socket.IO real-time event interfaces for the Online Exam Proctoring System.

---

## Authentication Endpoints

### 1. Student / Admin Registration
* **Endpoint**: `POST /api/auth/register`
* **Access**: Public
* **Request Body**:
```json
{
  "name": "Vishal Singh",
  "email": "student@college.edu",
  "password": "studentpassword",
  "role": "student"
}
```
* **Response (201 Created)**:
```json
{
  "message": "User registered successfully!",
  "user_id": 2
}
```

### 2. Login (Password Mode)
* **Endpoint**: `POST /api/auth/login`
* **Access**: Public
* **Request Body**:
```json
{
  "email": "student@college.edu",
  "password": "studentpassword"
}
```
* **Response (200 OK)**:
```json
{
  "message": "Login successful!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "name": "Vishal Singh",
    "email": "student@college.edu",
    "role": "student",
    "face_registered": false
  }
}
```

### 3. Login (OTP Mode)
* **Endpoint**: `POST /api/auth/otp-login`
* **Access**: Public
* **Request Body**:
```json
{
  "email": "student@college.edu",
  "otp": "123456"
}
```
* **Response (200 OK)**:
```json
{
  "message": "OTP Login successful!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### 4. Forgot Password (Simulated Email Send)
* **Endpoint**: `POST /api/auth/forgot-password`
* **Access**: Public
* **Request Body**:
```json
{
  "email": "student@college.edu"
}
```
* **Response (200 OK)**:
```json
{
  "message": "A password reset OTP has been sent to your email. (Use 123456 to verify)",
  "success": true
}
```

### 5. Fetch Profile Information
* **Endpoint**: `GET /api/auth/profile`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
```json
{
  "user": {
    "id": 2,
    "name": "Vishal Singh",
    "email": "student@college.edu",
    "role": "student",
    "face_registered": true,
    "created_at": "2026-06-30 14:40:00"
  }
}
```

---

## Biometric Face Registration Endpoints

### 1. Register Student Face
* **Endpoint**: `POST /api/auth/register-face`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**:
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD..."
}
```
* **Response (200 OK)**:
```json
{
  "message": "Face registered successfully!",
  "face_registered": true,
  "image_path": "uploads/faces/face_student_2.jpg"
}
```

### 2. Verify Face Match (Pre-Exam Identity Check)
* **Endpoint**: `POST /api/auth/verify-face`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**:
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD..."
}
```
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Face identity verified successfully!"
}
```

---

## Exams & Sessions Endpoints

### 1. Create Exam Paper (MCQs)
* **Endpoint**: `POST /api/exams`
* **Headers**: `Authorization: Bearer <token>` (Admin Only)
* **Request Body**:
```json
{
  "title": "Vite React Assessment",
  "description": "Vite bundler structure, state hooks, and routing practices.",
  "duration_minutes": 45,
  "questions": [
    {
      "question_text": "What hook handles component local state in React?",
      "option_a": "useContext",
      "option_b": "useState",
      "option_c": "useEffect",
      "option_d": "useReducer",
      "correct_option": "B",
      "points": 1
    }
  ]
}
```
* **Response (211 Created)**:
```json
{
  "message": "Exam created successfully!",
  "exam_id": 4
}
```

### 2. Fetch Exams List
* **Endpoint**: `GET /api/exams`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
```json
{
  "exams": [
    {
      "id": 1,
      "title": "Introduction to Artificial Intelligence",
      "description": "Assessment covering neural nets.",
      "duration_minutes": 30,
      "total_questions": 5,
      "passing_score": 40,
      "is_active": 1,
      "created_at": "2026-06-30 14:40:00"
    }
  ]
}
```

### 3. Start/Resume Exam Session
* **Endpoint**: `POST /api/exams/<exam_id>/start`
* **Headers**: `Authorization: Bearer <token>` (Student Only)
* **Response (201 Created / 200 OK)**:
```json
{
  "message": "Exam started successfully!",
  "session_id": 12,
  "warning_count": 0,
  "cheating_score": 0,
  "questions": [
    {
      "id": 1,
      "question_text": "What does CNN stand for in Deep Learning?",
      "option_a": "Computer Network Node",
      "option_b": "Convolutional Neural Network",
      "option_c": "Core Neural Network",
      "option_d": "Cognitive Neural Net",
      "points": 20
    }
  ]
}
```

### 4. Autosave MCQ Answer
* **Endpoint**: `POST /api/exams/sessions/<session_id>/answer`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**:
```json
{
  "question_id": 1,
  "selected_option": "B"
}
```
* **Response (200 OK)**:
```json
{
  "message": "Answer autosaved successfully."
}
```

### 5. Submit Completed Exam
* **Endpoint**: `POST /api/exams/sessions/<session_id>/submit`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
```json
{
  "message": "Exam submitted and graded successfully!",
  "score": 80,
  "total": 100,
  "cheating_score": 5,
  "warning_count": 0,
  "pdf_report": "uploads/reports/report_session_12.pdf"
}
```

### 6. Upload Complete Video Recording
* **Endpoint**: `POST /api/exams/sessions/<session_id>/upload-video`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**: Multi-part Form Data with file element named `video`.
* **Response (200 OK)**:
```json
{
  "message": "Video uploaded successfully.",
  "path": "uploads/recordings/session_12.webm"
}
```

---

## PDF Reports Endpoint

### 1. Download Proctoring Report PDF
* **Endpoint**: `GET /api/reports/session/<session_id>`
* **Query Params**: `token=<jwt_token>` (Alternative to Authorization Header to support direct browser link open)
* **Headers**: `Authorization: Bearer <token>` (Alternative)
* **Response**: Binary PDF file attachment `Proctoring_Report_Session_<id>.pdf`.

---

## Socket.IO Events Reference

### 1. Student Client Events
* `join_exam` (Payload: `{ "session_id": 12 }`): Join Socket room for active proctoring feedback.
* `video_frame` (Payload: `{ "session_id": 12, "frame": "data:image/jpeg;base64,..." }`): Sends web camera frame snapshots on interval for AI scanning.
* `student_action` (Payload: `{ "session_id": 12, "action": "Tab Switching" }`): Notifies the server of tab visibility changes, copy-paste block overrides, or exit fullscreens.

### 2. Administrator Client Events
* `join_admin`: Joins Socket room to listen to all live proctoring feeds from all running student sessions.
* `admin_command` (Payload: `{ "session_id": 12, "command": "warn", "message": "Stay in frame" }`): Triggers a custom text alert popup on the candidate's browser.
* `admin_command` (Payload: `{ "session_id": 12, "command": "terminate" }`): Remotely logs out candidate and forces immediate exam submit.

### 3. Server Broadcast Events
* `proctor_feedback` (Room: `session_<id>`): Emitted back to student with updated warnings counts and current cheating scores: `{ "warning_count": 1, "cheating_score": 10, "violations": ["Looking Left"] }`.
* `admin_frame_update` (Room: `admin_dashboard`): Emits real-time video snapshots with bounding boxes, current violations list, warning metric scores, and student profiles for live classroom grid.
* `admin_session_update` (Room: `admin_dashboard`): Emits general status changes (active, completed, terminated) to update admin monitor cards list.
* `auto_submit` (Room: `session_<id>`): Emitted to student when warnings threshold > 5, forcing client auto-submit and redirect.
