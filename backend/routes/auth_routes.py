from flask import Blueprint
from backend.controllers.auth_controller import register, login, otp_login, forgot_password, get_profile
from backend.utils.security import token_required

auth_bp = Blueprint('auth', __name__)

auth_bp.route('/register', methods=['POST'])(register)
auth_bp.route('/login', methods=['POST'])(login)
auth_bp.route('/otp-login', methods=['POST'])(otp_login)
auth_bp.route('/forgot-password', methods=['POST'])(forgot_password)
auth_bp.route('/profile', methods=['GET'])(token_required(get_profile))
