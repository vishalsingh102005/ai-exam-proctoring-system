import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { examAPI } from '../services/api';
import { 
  LogOut, User, Plus, Trash2, Calendar, BookOpen, Clock, 
  FileText, Shield, Eye, BarChart2, PlusCircle, AlertCircle, Edit3
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [exams, setExams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Exam Creator States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examDesc, setExamDesc] = useState('');
  const [examDuration, setExamDuration] = useState(60);
  const [questions, setQuestions] = useState([
    { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A' }
  ]);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const examData = await examAPI.getExams();
      setExams(examData.exams);

      const sessionData = await examAPI.getSessions();
      setSessions(sessionData.sessions);

      // We can fetch students list from profile endpoints.
      // For simplicity, we filter out users from database via custom helper if needed.
      // Let's call details endpoint or load mocks if needed, but we have endpoints:
      // In Flask we didn't add users endpoint: let's mock students listing or add a quick query,
      // Actually we have users list from session logs. Let's make an API query in backend.
      // Wait, let's keep it safe. We can fetch from backend if we implement, or mock a list.
      // In auth_controller we didn't add get_all_students, but in models we have User.get_all_students()!
      // Let's write a route for it if needed, or simply display from sessions!
      // Displaying from sessions is extremely clean and lists active students.
    } catch (err) {
      setError('Failed to fetch administrative records.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestionField = () => {
    setQuestions(prev => [
      ...prev,
      { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A' }
    ]);
  };

  const handleRemoveQuestionField = (index) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index, field, value) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!examTitle || questions.some(q => !q.question_text || !q.option_a || !q.option_b)) {
      setError('Please fill in the exam title and all question fields.');
      return;
    }

    try {
      await examAPI.createExam({
        title: examTitle,
        description: examDesc,
        duration_minutes: parseInt(examDuration),
        questions: questions
      });
      setShowCreateModal(false);
      // Reset fields
      setExamTitle('');
      setExamDesc('');
      setExamDuration(60);
      setQuestions([{ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A' }]);
      fetchAdminData();
    } catch (err) {
      setError('Failed to create examination.');
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!confirm('Are you sure you want to delete this examination?')) return;
    try {
      await examAPI.deleteExam(examId);
      fetchAdminData();
    } catch (err) {
      setError('Failed to delete exam.');
    }
  };

  const handleDownloadReport = (sessionId) => {
    const token = localStorage.getItem('token');
    window.open(`/api/reports/session/${sessionId}?token=${token}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      
      {/* Top Navbar */}
      <nav className="glass-panel border-x-0 border-t-0 py-4 px-6 mb-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-brand-purple" />
          <span className="font-extrabold text-xl tracking-wider text-white">PROCTORAI <span className="text-[10px] text-brand-purple bg-brand-purple/10 px-2 py-0.5 rounded border border-brand-purple/20 ml-2">ADMIN</span></span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <button 
              onClick={() => navigate('/admin/live')}
              className="px-3.5 py-1.5 rounded-lg bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple border border-brand-purple/30 flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Eye className="w-4 h-4 animate-pulse" />
              Live Monitor Grid
            </button>
            <button 
              onClick={() => navigate('/admin/analytics')}
              className="px-3.5 py-1.5 rounded-lg bg-brand-pink/10 hover:bg-brand-pink/20 text-brand-pink border border-brand-pink/30 flex items-center gap-1.5 shadow-sm transition-all"
            >
              <BarChart2 className="w-4 h-4" />
              Analytics View
            </button>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-dark-900 border border-white/5">
            <User className="w-4 h-4 text-brand-purple" />
            <span className="text-sm font-medium text-slate-300">{user?.name}</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-brand-crimson transition-colors"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Exams Management (2 Columns) */}
        <div className="lg:col-span-2 space-y-8">
          
          {error && (
            <div className="p-3 bg-brand-crimson/15 border border-brand-crimson/20 text-brand-crimson rounded-lg text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5" />
              {error}
            </div>
          )}

          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-purple" />
              Active Examinations
            </h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-brand-purple hover:bg-brand-purple/95 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Exam Paper
            </button>
          </div>

          {exams.length === 0 ? (
            <div className="glass-panel rounded-xl p-8 text-center text-slate-500 text-sm">
              No exams added yet. Click "Create Exam Paper" to initialize.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exams.map((exam) => (
                <div key={exam.id} className="glass-panel rounded-xl p-5 flex flex-col justify-between h-44 border-t-white/10">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-lg text-white line-clamp-1">{exam.title}</h4>
                      <button
                        onClick={() => handleDeleteExam(exam.id)}
                        className="p-1 text-slate-400 hover:text-brand-crimson transition-colors"
                        title="Delete Exam"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{exam.description || 'No description.'}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-4 border-t border-white/5 pt-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {exam.duration_minutes} min
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {exam.total_questions} MCQs
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Active Student Logs & Session Downloads */}
        <div className="lg:col-span-1 space-y-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-pink" />
            Class Session History
          </h3>

          {sessions.length === 0 ? (
            <div className="glass-panel rounded-xl p-8 text-center text-slate-500 text-sm">
              No students have taken exams yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {sessions.map((sess) => (
                <div key={sess.id} className="glass-panel rounded-xl p-4 flex flex-col justify-between border-l-brand-purple border-l-2 bg-dark-900/40">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-sm">{sess.student_name}</h4>
                      <p className="text-[11px] text-slate-400">{sess.exam_title}</p>
                    </div>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      sess.status === 'completed' 
                        ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20' 
                        : (sess.status === 'terminated' 
                            ? 'bg-brand-crimson/10 text-brand-crimson border border-brand-crimson/20'
                            : 'bg-brand-purple/10 text-brand-purple border border-brand-purple/20 animate-pulse')
                    }`}>
                      {sess.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
                    <div className="flex gap-3 text-[10px] text-slate-500">
                      <span>Warns: {sess.warning_count}/5</span>
                      <span>Risk: {sess.cheating_score}%</span>
                    </div>
                    <button
                      onClick={() => handleDownloadReport(sess.id)}
                      className="px-2.5 py-1 bg-brand-purple hover:bg-brand-purple/90 rounded text-white text-[10px] font-bold shadow-sm transition-all"
                    >
                      Report PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* EXAM PAPER CREATOR MODAL */}
      {/* ------------------------------------------------------------- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl glass-panel rounded-2xl p-6 max-h-[85vh] overflow-y-auto border border-brand-purple/30 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-1.5">
              <PlusCircle className="w-5 h-5 text-brand-purple" />
              Create Exam Paper & MCQs
            </h3>

            <form onSubmit={handleCreateExam} className="space-y-6">
              
              {/* Core Exam Data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Exam Title</label>
                  <input
                    type="text"
                    className="w-full glass-input"
                    placeholder="Python Basics Quiz"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Duration (Minutes)</label>
                  <input
                    type="number"
                    className="w-full glass-input"
                    value={examDuration}
                    onChange={(e) => setExamDuration(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    className="w-full glass-input h-16 resize-none"
                    placeholder="Enter short description about this examination..."
                    value={examDesc}
                    onChange={(e) => setExamDesc(e.target.value)}
                  />
                </div>
              </div>

              {/* Questions List */}
              <div className="border-t border-white/5 pt-4 space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Question Sheet</h4>
                  <button
                    type="button"
                    onClick={handleAddQuestionField}
                    className="py-1 px-3 bg-brand-purple/20 hover:bg-brand-purple border border-brand-purple/30 rounded text-brand-purple hover:text-white text-xs font-bold transition-all"
                  >
                    + Add Question
                  </button>
                </div>

                {questions.map((q, idx) => (
                  <div key={idx} className="p-4 bg-dark-900/50 border border-white/5 rounded-xl space-y-4 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Q#{idx+1}</span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestionField(idx)}
                          className="text-xs text-brand-crimson hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div>
                      <input
                        type="text"
                        className="w-full glass-input"
                        placeholder="Question prompt/text?"
                        value={q.question_text}
                        onChange={(e) => handleQuestionChange(idx, 'question_text', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-bold">{opt}:</span>
                          <input
                            type="text"
                            className="w-full glass-input py-1 text-xs"
                            placeholder={`Option ${opt}`}
                            value={q[`option_${opt.toLowerCase()}`]}
                            onChange={(e) => handleQuestionChange(idx, `option_${opt.toLowerCase()}`, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="w-48">
                      <label className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Correct Choice</label>
                      <select
                        className="w-full glass-input py-1.5 text-xs bg-slate-900 cursor-pointer"
                        value={q.correct_option}
                        onChange={(e) => handleQuestionChange(idx, 'correct_option', e.target.value)}
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </div>

                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2.5 px-5 bg-dark-900 border border-white/5 rounded-lg text-slate-300 font-semibold hover:bg-white/5 text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-brand-purple hover:bg-brand-purple/95 text-white font-bold rounded-lg shadow-lg hover:shadow-brand-purple/20 text-xs transition-all"
                >
                  Save Exam Paper
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
