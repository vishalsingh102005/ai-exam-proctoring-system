import os
from flask import Blueprint, send_file, jsonify, request
from backend.models.models import ExamSession, Report
from backend.utils.security import token_required
from backend.services.report_service import generate_pdf_report
from backend.config import Config

report_bp = Blueprint('report', __name__)

@report_bp.route('/session/<int:session_id>', methods=['GET'])
@token_required
def download_report(session_id):
    """
    Generate or get the PDF report for an exam session and return it.
    """
    session = ExamSession.get_session_details(session_id)
    if not session:
        return jsonify({'message': 'Exam session not found.'}), 404

    # Authorization Check
    # Students can only view their own reports. Admins can view any.
    if request.user['role'] == 'student' and session['student_id'] != request.user['id']:
        return jsonify({'message': 'Unauthorized to access this report.'}), 403

    # Check if report already exists in database
    report_record = Report.get_by_session(session_id)
    pdf_rel_path = None
    
    if report_record:
        pdf_rel_path = report_record['pdf_path']
        abs_path = os.path.join(Config.BASE_DIR, pdf_rel_path)
        if not os.path.exists(abs_path):
            pdf_rel_path = None # Regenerate if file missing
            
    if not pdf_rel_path:
        try:
            pdf_rel_path = generate_pdf_report(session_id)
        except Exception as e:
            return jsonify({'message': f'Failed to generate report: {str(e)}'}), 500

    abs_path = os.path.join(Config.BASE_DIR, pdf_rel_path)
    
    try:
        return send_file(
            abs_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"Proctoring_Report_Session_{session_id}.pdf"
        )
    except Exception as e:
        return jsonify({'message': f'Failed to send report file: {str(e)}'}), 500
