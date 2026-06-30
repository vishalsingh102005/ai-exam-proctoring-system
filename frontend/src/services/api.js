import axios from 'axios';

// Create Axios Instance
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor to append JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercept responses to handle 401 unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // If we are not on the login page, redirect
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  otpLogin: async (email, otp) => {
    const res = await api.post('/auth/otp-login', { email, otp });
    return res.data;
  },
  register: async (name, email, password, role = 'student') => {
    const res = await api.post('/auth/register', { name, email, password, role });
    return res.data;
  },
  forgotPassword: async (email) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },
  getProfile: async () => {
    const res = await api.get('/auth/profile');
    return res.data;
  },
  registerFace: async (imageBase64) => {
    const res = await api.post('/auth/register-face', { image: imageBase64 });
    return res.data;
  },
  verifyFace: async (imageBase64) => {
    const res = await api.post('/auth/verify-face', { image: imageBase64 });
    return res.data;
  },
};

export const examAPI = {
  getExams: async () => {
    const res = await api.get('/exams');
    return res.data;
  },
  getExam: async (examId) => {
    const res = await api.get(`/exams/${examId}`);
    return res.data;
  },
  createExam: async (examData) => {
    const res = await api.post('/exams', examData);
    return res.data;
  },
  updateExam: async (examId, examData) => {
    const res = await api.put(`/exams/${examId}`, examData);
    return res.data;
  },
  deleteExam: async (examId) => {
    const res = await api.delete(`/exams/${examId}`);
    return res.data;
  },
  startSession: async (examId) => {
    const res = await api.post(`/exams/${examId}/start`);
    return res.data;
  },
  saveAnswer: async (sessionId, questionId, selectedOption) => {
    const res = await api.post(`/exams/sessions/${sessionId}/answer`, {
      question_id: questionId,
      selected_option: selectedOption,
    });
    return res.data;
  },
  submitSession: async (sessionId, videoPath = null) => {
    const url = videoPath 
      ? `/exams/sessions/${sessionId}/submit?video_path=${encodeURIComponent(videoPath)}`
      : `/exams/sessions/${sessionId}/submit`;
    const res = await api.post(url);
    return res.data;
  },
  terminateSession: async (sessionId) => {
    const res = await api.post(`/exams/sessions/${sessionId}/terminate`);
    return res.data;
  },
  getSessions: async () => {
    const res = await api.get('/exams/sessions');
    return res.data;
  },
  getMySessions: async () => {
    const res = await api.get('/exams/my-sessions');
    return res.data;
  },
  getSessionDetails: async (sessionId) => {
    const res = await api.get(`/exams/sessions/${sessionId}`);
    return res.data;
  },
  uploadVideo: async (sessionId, videoBlob) => {
    const formData = new FormData();
    formData.append('video', videoBlob, 'recording.webm');
    const res = await api.post(`/exams/sessions/${sessionId}/upload-video`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
};

export default api;
