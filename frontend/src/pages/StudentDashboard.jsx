import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { examAPI } from '../services/api';
import { 
  LogOut, User, Calendar, BookOpen, Clock, FileDown, 
  AlertTriangle, ShieldAlert, Sparkles, CheckCircle2, ChevronRight 
} from 'lucide-react';

const StudentDashboard = () => {
  const { user, logout, refreshProfile } = useAuth();
  const [exams, setExams] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    refreshProfile(); // Sync face status
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const examData = await examAPI.getExams();
      setExams(examData.exams);

      const historyData = await examAPI.getMySessions();
      setHistory(historyData.sessions);
    } catch (err) {
      setError('Failed to fetch dashboard data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async (examId) => {
    if (!user.face_registered) {
      setError('You must complete Face Registration before taking an exam.');
      return;
    }
    navigate(`/exam-verify/${examId}`);
  };

  const handleDownloadReport = (sessionId) => {
    // Direct link to download endpoint which responds with file attachment
    const token = localStorage.getItem('token');
    window.open(`/api/reports/session/${sessionId}?token=${token}`, '_blank');
  };

  const getCheatingBadgeColor = (score) => {
    if (score < 25) return 'text-brand-emerald bg-brand-emerald/10 border-brand-emerald/20';
    if (score < 60) return 'text-brand-amber bg-brand-amber/10 border-brand-amber/20';
    return 'text-brand-crimson bg-brand-crimson/10 border-brand-crimson/20';
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
          <Sparkles className="w-6 h-6 text-brand-purple" />
          <span className="font-extrabold text-xl tracking-wider text-white">PROCTORAI</span>
        </div>
        <div className="flex items-center gap-4">
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

      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Profile & Warnings */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Profile Card */}
          <div className="glass-panel rounded-xl p-6 border-l-brand-purple border-l-4">
            <h3 className="text-lg font-bold text-white mb-4">Candidate Profile</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Email</p>
                <p className="text-sm text-slate-300 font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Authentication Status</p>
                {user?.face_registered ? (
                  <div className="flex items-center gap-1.5 text-brand-emerald text-sm mt-1 font-semibold">
                    <CheckCircle2 className="w-4.5 h-4.5" />
                    Face Registered
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-brand-amber text-sm mt-1 font-semibold">
                    <AlertTriangle className="w-4.5 h-4.5" />
                    Face Not Configured
                  </div>
                )}
              </div>
            </div>
            
            {!user?.face_registered && (
              <button
                onClick={() => navigate('/face-register')}
                className="w-full mt-6 bg-brand-purple hover:bg-brand-purple/90 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-brand-purple/20 transition-all flex items-center justify-center gap-1.5 text-sm"
              >
                <Sparkles className="w-4 h-4" />
                Register Face Now
              </button>
            )}
          </div>

          {/* Guidelines / Alerts */}
          <div className="glass-panel rounded-xl p-6 border-l-brand-amber border-l-4">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-brand-amber" />
              Exam Guidelines
            </h3>
            <ul className="space-y-3 text-xs text-slate-400 leading-relaxed list-disc pl-4">
              <li>Webcam & microphone access are mandatory for all examinations.</li>
              <li>You must remain in fullscreen mode. Minimizing or switching tabs is strictly monitored.</li>
              <li>Right-click, text selection, and copy-paste are strictly disabled.</li>
              <li>AI proctor checks for eye movements, speaking, and phones.</li>
              <li>More than 5 warning infractions will result in **immediate auto-submission**.</li>
            </ul>
          </div>
        </div>

        {/* Right column: Exams & History */}
        <div className="lg:col-span-2 space-y-8">
          
          {error && (
            <div className="p-3 bg-brand-crimson/15 border border-brand-crimson/20 text-brand-crimson rounded-lg text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4.5 h-4.5" />
              {error}
            </div>
          )}

          {/* Upcoming Exams */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-purple" />
              Upcoming Active Exams
            </h3>
            
            {exams.length === 0 ? (
              <div className="glass-panel rounded-xl p-8 text-center text-slate-500 text-sm">
                No active exams assigned at this moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exams.map((exam) => (
                  <div key={exam.id} className="glass-panel glass-panel-hover rounded-xl p-5 flex flex-col justify-between h-48 border-t-white/10">
                    <div>
                      <h4 className="font-bold text-lg text-white line-clamp-1">{exam.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{exam.description || 'No description available.'}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {exam.duration_minutes} min
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {exam.total_questions} MCQs
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartExam(exam.id)}
                      className="w-full mt-4 bg-brand-purple/20 hover:bg-brand-purple border border-brand-purple/40 text-brand-purple hover:text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-1 text-sm shadow-sm"
                    >
                      Enter Exam
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FileDown className="w-5 h-5 text-brand-pink" />
              Exam Attempts History
            </h3>

            {history.length === 0 ? (
              <div className="glass-panel rounded-xl p-8 text-center text-slate-500 text-sm">
                You haven't attempted any exams yet.
              </div>
            ) : (
              <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-dark-900 border-b border-white/5 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-4 px-5">Exam</th>
                        <th className="py-4 px-5">Date</th>
                        <th className="py-4 px-5">Warnings</th>
                        <th className="py-4 px-5">Integrity</th>
                        <th className="py-4 px-5 text-right">Report</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300 text-sm">
                      {history.map((session) => (
                        <tr key={session.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 px-5 font-medium text-white">{session.exam_title}</td>
                          <td className="py-4 px-5 text-xs">{new Date(session.started_at).toLocaleDateString()}</td>
                          <td className="py-4 px-5">{session.warning_count} / 5</td>
                          <td className="py-4 px-5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getCheatingBadgeColor(session.cheating_score)}`}>
                              Score: {session.cheating_score}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <button
                              onClick={() => handleDownloadReport(session.id)}
                              className="p-1.5 bg-brand-purple/10 border border-brand-purple/30 rounded-lg text-brand-purple hover:bg-brand-purple hover:text-white transition-all inline-flex items-center gap-1 text-xs"
                              title="Download PDF"
                            >
                              <FileDown className="w-4 h-4" />
                              PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
