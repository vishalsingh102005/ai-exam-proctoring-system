import json
from backend.database.db import db

class User:
    @staticmethod
    def create(name, email, password_hash, role='student'):
        query = "INSERT INTO users (name, email, password_hash, role, status, face_registered) VALUES (%s, %s, %s, %s, 'active', 0)"
        return db.execute_query(query, (name, email, password_hash, role))

    @staticmethod
    def get_by_email(email):
        query = "SELECT * FROM users WHERE email = %s"
        return db.fetch_one(query, (email,))

    @staticmethod
    def get_by_id(user_id):
        query = "SELECT * FROM users WHERE id = %s"
        return db.fetch_one(query, (user_id,))

    @staticmethod
    def set_face_registered(user_id, status=True):
        val = 1 if status else 0
        query = "UPDATE users SET face_registered = %s WHERE id = %s"
        return db.execute_query(query, (val, user_id))

    @staticmethod
    def get_all_students():
        query = "SELECT id, name, email, face_registered, created_at FROM users WHERE role = 'student'"
        return db.fetch_all(query)


class Exam:
    @staticmethod
    def create(title, description, duration_minutes, total_questions, passing_score=40, is_active=1):
        query = "INSERT INTO exams (title, description, duration_minutes, total_questions, passing_score, is_active) VALUES (%s, %s, %s, %s, %s, %s)"
        return db.execute_query(query, (title, description, duration_minutes, total_questions, passing_score, is_active))

    @staticmethod
    def get_all(active_only=False):
        if active_only:
            query = "SELECT * FROM exams WHERE is_active = 1 ORDER BY id DESC"
        else:
            query = "SELECT * FROM exams ORDER BY id DESC"
        return db.fetch_all(query)

    @staticmethod
    def get_by_id(exam_id):
        query = "SELECT * FROM exams WHERE id = %s"
        return db.fetch_one(query, (exam_id,))

    @staticmethod
    def update(exam_id, title, description, duration_minutes, total_questions, passing_score, is_active):
        query = "UPDATE exams SET title = %s, description = %s, duration_minutes = %s, total_questions = %s, passing_score = %s, is_active = %s WHERE id = %s"
        return db.execute_query(query, (title, description, duration_minutes, total_questions, passing_score, is_active, exam_id))

    @staticmethod
    def delete(exam_id):
        query = "DELETE FROM exams WHERE id = %s"
        return db.execute_query(query, (exam_id,))


class Question:
    @staticmethod
    def create(exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, points=1):
        query = "INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, points) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
        return db.execute_query(query, (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, points))

    @staticmethod
    def get_by_exam_id(exam_id):
        query = "SELECT * FROM questions WHERE exam_id = %s ORDER BY id ASC"
        return db.fetch_all(query, (exam_id,))

    @staticmethod
    def get_by_id(question_id):
        query = "SELECT * FROM questions WHERE id = %s"
        return db.fetch_one(query, (question_id,))

    @staticmethod
    def delete_by_exam_id(exam_id):
        query = "DELETE FROM questions WHERE exam_id = %s"
        return db.execute_query(query, (exam_id,))


class ExamSession:
    @staticmethod
    def create(student_id, exam_id):
        query = "INSERT INTO exam_sessions (student_id, exam_id, status, started_at, completed_at, cheating_score, warning_count) VALUES (%s, %s, 'active', CURRENT_TIMESTAMP, NULL, 0, 0)"
        return db.execute_query(query, (student_id, exam_id))

    @staticmethod
    def get_by_id(session_id):
        query = "SELECT * FROM exam_sessions WHERE id = %s"
        return db.fetch_one(query, (session_id,))

    @staticmethod
    def get_active_session(student_id, exam_id):
        query = "SELECT * FROM exam_sessions WHERE student_id = %s AND exam_id = %s AND status = 'active' ORDER BY started_at DESC"
        return db.fetch_one(query, (student_id, exam_id))

    @staticmethod
    def update_progress(session_id, cheating_score, warning_count):
        query = "UPDATE exam_sessions SET cheating_score = %s, warning_count = %s WHERE id = %s"
        return db.execute_query(query, (cheating_score, warning_count, session_id))

    @staticmethod
    def complete_session(session_id, cheating_score, warning_count, video_path=None):
        query = "UPDATE exam_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP, cheating_score = %s, warning_count = %s, video_path = %s WHERE id = %s"
        return db.execute_query(query, (cheating_score, warning_count, video_path, session_id))

    @staticmethod
    def terminate_session(session_id):
        query = "UPDATE exam_sessions SET status = 'terminated', completed_at = CURRENT_TIMESTAMP WHERE id = %s"
        return db.execute_query(query, (session_id,))

    @staticmethod
    def get_session_details(session_id):
        query = """
            SELECT es.*, u.name as student_name, u.email as student_email, e.title as exam_title, e.duration_minutes, e.passing_score
            FROM exam_sessions es
            JOIN users u ON es.student_id = u.id
            JOIN exams e ON es.exam_id = e.id
            WHERE es.id = %s
        """
        return db.fetch_one(query, (session_id,))

    @staticmethod
    def get_sessions_by_student(student_id):
        query = """
            SELECT es.*, e.title as exam_title, e.duration_minutes
            FROM exam_sessions es
            JOIN exams e ON es.exam_id = e.id
            WHERE es.student_id = %s
            ORDER BY es.started_at DESC
        """
        return db.fetch_all(query, (student_id,))

    @staticmethod
    def get_all_sessions():
        query = """
            SELECT es.*, u.name as student_name, e.title as exam_title
            FROM exam_sessions es
            JOIN users u ON es.student_id = u.id
            JOIN exams e ON es.exam_id = e.id
            ORDER BY es.started_at DESC
        """
        return db.fetch_all(query)


class Answer:
    @staticmethod
    def save_answer(session_id, question_id, selected_option, is_correct):
        # Check if already answered
        check_query = "SELECT id FROM answers WHERE session_id = %s AND question_id = %s"
        existing = db.fetch_one(check_query, (session_id, question_id))
        
        if existing:
            query = "UPDATE answers SET selected_option = %s, is_correct = %s WHERE id = %s"
            return db.execute_query(query, (selected_option, is_correct, existing['id']))
        else:
            query = "INSERT INTO answers (session_id, question_id, selected_option, is_correct) VALUES (%s, %s, %s, %s)"
            return db.execute_query(query, (session_id, question_id, selected_option, is_correct))

    @staticmethod
    def get_answers_by_session(session_id):
        query = "SELECT * FROM answers WHERE session_id = %s"
        return db.fetch_all(query, (session_id,))

    @staticmethod
    def calculate_score(session_id):
        query = """
            SELECT SUM(q.points) as total_points, 
                   SUM(CASE WHEN a.is_correct = 1 THEN q.points ELSE 0 END) as scored_points
            FROM answers a
            JOIN questions q ON a.question_id = q.id
            WHERE a.session_id = %s
        """
        res = db.fetch_one(query, (session_id,))
        if not res or res['total_points'] is None:
            return 0, 0
        return int(res['scored_points'] or 0), int(res['total_points'] or 0)


class Violation:
    @staticmethod
    def create(session_id, violation_type, confidence_score=1.0, screenshot_path=None):
        query = "INSERT INTO violations (session_id, violation_type, confidence_score, screenshot_path) VALUES (%s, %s, %s, %s)"
        return db.execute_query(query, (session_id, violation_type, confidence_score, screenshot_path))

    @staticmethod
    def get_by_session(session_id):
        query = "SELECT * FROM violations WHERE session_id = %s ORDER BY timestamp ASC"
        return db.fetch_all(query, (session_id,))

    @staticmethod
    def get_recent_count(session_id, minutes=2):
        # SQLite uses datetime('now', '-2 minutes') or similar. MySQL uses NOW() - INTERVAL 2 MINUTE.
        # Since we want it compatible:
        # Let's count in general or handle it on python side. Or a simpler query of last 10 violations.
        query = "SELECT COUNT(*) as count FROM violations WHERE session_id = %s"
        res = db.fetch_one(query, (session_id,))
        return res['count'] if res else 0


class FaceEncoding:
    @staticmethod
    def create(student_id, encoding_data, image_path=None):
        # encoding_data is a list of floats. We store it as JSON string
        encoding_str = json.dumps(encoding_data)
        query = "INSERT INTO face_encodings (student_id, encoding_data, image_path) VALUES (%s, %s, %s)"
        db.execute_query(query, (student_id, encoding_str, image_path))
        # Update user status
        User.set_face_registered(student_id, True)

    @staticmethod
    def get_by_student(student_id):
        query = "SELECT * FROM face_encodings WHERE student_id = %s LIMIT 1"
        res = db.fetch_one(query, (student_id,))
        if res:
            res['encoding_data'] = json.loads(res['encoding_data'])
        return res


class Report:
    @staticmethod
    def create(session_id, pdf_path):
        query = "INSERT INTO reports (session_id, pdf_path) VALUES (%s, %s)"
        return db.execute_query(query, (session_id, pdf_path))

    @staticmethod
    def get_by_session(session_id):
        query = "SELECT * FROM reports WHERE session_id = %s ORDER BY generated_at DESC LIMIT 1"
        return db.fetch_one(query, (session_id,))


class AuditLog:
    @staticmethod
    def log(user_id, action, details=None):
        query = "INSERT INTO audit_logs (user_id, action, details) VALUES (%s, %s, %s)"
        return db.execute_query(query, (user_id, action, details))
