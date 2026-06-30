from flask import request, jsonify
from backend.models.models import Exam, Question, ExamSession, Answer, User, AuditLog
from backend.services.report_service import generate_pdf_report

def create_exam():
    data = request.get_json() or {}
    title = data.get('title')
    description = data.get('description', '')
    duration = data.get('duration_minutes', 60)
    questions_list = data.get('questions', [])
    passing_score = data.get('passing_score', 40)
    is_active = data.get('is_active', 1)

    if not title or not questions_list:
        return jsonify({'message': 'Exam title and questions are required.'}), 400

    try:
        total_questions = len(questions_list)
        exam_id = Exam.create(title, description, duration, total_questions, passing_score, is_active)
        
        for q in questions_list:
            Question.create(
                exam_id,
                q.get('question_text'),
                q.get('option_a'),
                q.get('option_b'),
                q.get('option_c'),
                q.get('option_d'),
                q.get('correct_option'),
                q.get('points', 1)
            )

        AuditLog.log(request.user['id'], 'EXAM_CREATED', f"Created exam: {title}")
        return jsonify({'message': 'Exam created successfully!', 'exam_id': exam_id}), 201
    except Exception as e:
        return jsonify({'message': f'Failed to create exam: {str(e)}'}), 500

def get_exams():
    # If student, only show active exams. If admin, show all.
    active_only = (request.user['role'] == 'student')
    exams = Exam.get_all(active_only)
    return jsonify({'exams': exams}), 200

def get_exam(exam_id):
    exam = Exam.get_by_id(exam_id)
    if not exam:
        return jsonify({'message': 'Exam not found.'}), 404
    return jsonify({'exam': exam}), 200

def update_exam(exam_id):
    data = request.get_json() or {}
    title = data.get('title')
    description = data.get('description', '')
    duration = data.get('duration_minutes', 60)
    questions_list = data.get('questions', [])
    passing_score = data.get('passing_score', 40)
    is_active = data.get('is_active', 1)

    if not title:
        return jsonify({'message': 'Exam title is required.'}), 400

    try:
        total_questions = len(questions_list) if questions_list else Exam.get_by_id(exam_id)['total_questions']
        Exam.update(exam_id, title, description, duration, total_questions, passing_score, is_active)
        
        # If new questions are passed, replace the old ones
        if questions_list:
            Question.delete_by_exam_id(exam_id)
            for q in questions_list:
                Question.create(
                    exam_id,
                    q.get('question_text'),
                    q.get('option_a'),
                    q.get('option_b'),
                    q.get('option_c'),
                    q.get('option_d'),
                    q.get('correct_option'),
                    q.get('points', 1)
                )

        AuditLog.log(request.user['id'], 'EXAM_UPDATED', f"Updated exam ID {exam_id}")
        return jsonify({'message': 'Exam updated successfully!'}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to update exam: {str(e)}'}), 500

def delete_exam(exam_id):
    try:
        Exam.delete(exam_id)
        AuditLog.log(request.user['id'], 'EXAM_DELETED', f"Deleted exam ID {exam_id}")
        return jsonify({'message': 'Exam deleted successfully!'}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to delete exam: {str(e)}'}), 500

def start_session(exam_id):
    student_id = request.user['id']
    
    # Verify student exists and has face registered
    user = User.get_by_id(student_id)
    if not user:
        return jsonify({'message': 'User not found.'}), 404
    
    if not user['face_registered']:
        return jsonify({'message': 'Face verification is required before starting the exam. Please complete face registration first.'}), 400

    exam = Exam.get_by_id(exam_id)
    if not exam or not exam['is_active']:
        return jsonify({'message': 'Exam is either not active or does not exist.'}), 404

    try:
        # Check for existing active session
        active_sess = ExamSession.get_active_session(student_id, exam_id)
        if active_sess:
            questions = Question.get_by_exam_id(exam_id)
            # Strip correct answers before sending questions to student
            student_questions = []
            for q in questions:
                q_dict = dict(q)
                q_dict.pop('correct_option', None)
                student_questions.append(q_dict)

            return jsonify({
                'message': 'Active session resumed!',
                'session_id': active_sess['id'],
                'warning_count': active_sess['warning_count'],
                'cheating_score': active_sess['cheating_score'],
                'questions': student_questions
            }), 200

        # Create new session
        session_id = ExamSession.create(student_id, exam_id)
        questions = Question.get_by_exam_id(exam_id)
        
        # Strip correct answers
        student_questions = []
        for q in questions:
            q_dict = dict(q)
            q_dict.pop('correct_option', None)
            student_questions.append(q_dict)

        AuditLog.log(student_id, 'EXAM_STARTED', f"Started exam ID {exam_id}")
        return jsonify({
            'message': 'Exam started successfully!',
            'session_id': session_id,
            'warning_count': 0,
            'cheating_score': 0,
            'questions': student_questions
        }), 201
    except Exception as e:
        return jsonify({'message': f'Failed to start exam session: {str(e)}'}), 500

def autosave_answer(session_id):
    data = request.get_json() or {}
    question_id = data.get('question_id')
    selected_option = data.get('selected_option')

    if not question_id or not selected_option:
        return jsonify({'message': 'Question ID and selected option are required.'}), 400

    session = ExamSession.get_by_id(session_id)
    if not session or session['status'] != 'active':
        return jsonify({'message': 'Session is not active or not found.'}), 403

    # Check if student is authorized for this session
    if request.user['role'] == 'student' and session['student_id'] != request.user['id']:
        return jsonify({'message': 'Unauthorized to edit this session.'}), 403

    try:
        # Check correctness
        question = Question.get_by_id(question_id)
        is_correct = 1 if (question and question['correct_option'] == selected_option) else 0
        
        Answer.save_answer(session_id, question_id, selected_option, is_correct)
        return jsonify({'message': 'Answer autosaved successfully.'}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to save answer: {str(e)}'}), 500

def submit_session(session_id):
    session = ExamSession.get_by_id(session_id)
    if not session or session['status'] != 'active':
        return jsonify({'message': 'Session is not active or not found.'}), 403

    if request.user['role'] == 'student' and session['student_id'] != request.user['id']:
        return jsonify({'message': 'Unauthorized to submit this session.'}), 403

    try:
        # Save video path if sent
        video_path = request.args.get('video_path', None)
        
        # Calculate final MCQ score
        scored, total = Answer.calculate_score(session_id)
        
        # Mark session as completed
        ExamSession.complete_session(session_id, session['cheating_score'], session['warning_count'], video_path)
        AuditLog.log(session['student_id'], 'EXAM_SUBMITTED', f"Submitted exam session ID {session_id}. Score: {scored}/{total}")

        # Proactively generate PDF Report
        pdf_path = generate_pdf_report(session_id)

        return jsonify({
            'message': 'Exam submitted and graded successfully!',
            'score': scored,
            'total': total,
            'cheating_score': session['cheating_score'],
            'warning_count': session['warning_count'],
            'pdf_report': pdf_path
        }), 200
    except Exception as e:
        return jsonify({'message': f'Failed to submit exam: {str(e)}'}), 500

def terminate_session(session_id):
    try:
        ExamSession.terminate_session(session_id)
        AuditLog.log(request.user['id'], 'EXAM_TERMINATED', f"Admin terminated student exam session ID {session_id}")
        
        # Proactively generate PDF Report for the terminated session
        generate_pdf_report(session_id)

        return jsonify({'message': 'Exam session terminated by Administrator.'}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to terminate exam session: {str(e)}'}), 500

def get_my_sessions():
    student_id = request.user['id']
    sessions = ExamSession.get_sessions_by_student(student_id)
    return jsonify({'sessions': sessions}), 200

def get_all_sessions():
    sessions = ExamSession.get_all_sessions()
    return jsonify({'sessions': sessions}), 200

def get_session_details(session_id):
    details = ExamSession.get_session_details(session_id)
    if not details:
        return jsonify({'message': 'Session details not found.'}), 404
        
    # Check permissions
    if request.user['role'] == 'student' and details['student_id'] != request.user['id']:
        return jsonify({'message': 'Unauthorized to view these details.'}), 403

    answers = Answer.get_answers_by_session(session_id)
    scored, total = Answer.calculate_score(session_id)
    
    return jsonify({
        'details': details,
        'answers': answers,
        'score': {
            'scored': scored,
            'total': total
        }
    }), 200
