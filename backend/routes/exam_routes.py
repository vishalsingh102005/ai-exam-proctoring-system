from flask import Blueprint
from backend.controllers.exam_controller import (
    create_exam, get_exams, get_exam, update_exam, delete_exam,
    start_session, autosave_answer, submit_session, terminate_session,
    get_my_sessions, get_all_sessions, get_session_details
)
from backend.utils.security import token_required, admin_required

exam_bp = Blueprint('exam', __name__)

# Exam CRUD
exam_bp.route('', methods=['POST'])(admin_required(create_exam))
exam_bp.route('', methods=['GET'])(token_required(get_exams))
exam_bp.route('/<int:exam_id>', methods=['GET'])(token_required(get_exam))
exam_bp.route('/<int:exam_id>', methods=['PUT'])(admin_required(update_exam))
exam_bp.route('/<int:exam_id>', methods=['DELETE'])(admin_required(delete_exam))

# Exam Session Lifecycle
exam_bp.route('/<int:exam_id>/start', methods=['POST'])(token_required(start_session))
exam_bp.route('/sessions/<int:session_id>/answer', methods=['POST'])(token_required(autosave_answer))
exam_bp.route('/sessions/<int:session_id>/submit', methods=['POST'])(token_required(submit_session))
exam_bp.route('/sessions/<int:session_id>/terminate', methods=['POST'])(admin_required(terminate_session))

# Exam Session Queries
exam_bp.route('/sessions', methods=['GET'])(admin_required(get_all_sessions))
exam_bp.route('/my-sessions', methods=['GET'])(token_required(get_my_sessions))
exam_bp.route('/sessions/<int:session_id>', methods=['GET'])(token_required(get_session_details))
