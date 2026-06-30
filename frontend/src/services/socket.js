import { io } from 'socket.io-client';

const SOCKET_URL = window.location.origin;

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      
      this.socket.on('connect', () => {
        print(`[SOCKETCONNECTED] Connected to Socket.IO Server: ${this.socket.id}`);
      });
      
      this.socket.on('disconnect', () => {
        print('[SOCKETDISCONNECTED] Disconnected from Socket.IO Server');
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinExam(sessionId) {
    if (this.socket) {
      this.socket.emit('join_exam', { session_id: sessionId });
    }
  }

  leaveExam(sessionId) {
    if (this.socket) {
      this.socket.emit('leave_exam', { session_id: sessionId });
    }
  }

  joinAdmin() {
    if (this.socket) {
      this.socket.emit('join_admin');
    }
  }

  sendVideoFrame(sessionId, base64Frame) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('video_frame', {
        session_id: sessionId,
        frame: base64Frame,
      });
    }
  }

  sendStudentAction(sessionId, actionType) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('student_action', {
        session_id: sessionId,
        action: actionType,
      });
    }
  }

  sendAdminCommand(sessionId, command, message = '') {
    if (this.socket && this.socket.connected) {
      this.socket.emit('admin_command', {
        session_id: sessionId,
        command: command,
        message: message,
      });
    }
  }

  on(eventName, callback) {
    if (this.socket) {
      this.socket.on(eventName, callback);
    }
  }

  off(eventName, callback) {
    if (this.socket) {
      this.socket.off(eventName, callback);
    }
  }
}

// Helpers for printing
function print(msg) {
  console.log(msg);
}

const socketService = new SocketService();
export default socketService;
