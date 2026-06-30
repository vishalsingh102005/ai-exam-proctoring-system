import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socket';
import { 
  ArrowLeft, Eye, ShieldAlert, AlertTriangle, Send, 
  Trash2, MonitorOff, User, BookOpen, AlertCircle
} from 'lucide-react';

const LiveMonitor = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState({}); // sessionId -> sessionData
  const [warningMsg, setWarningMsg] = useState({}); // sessionId -> input string

  useEffect(() => {
    // Connect socket and join admin channel
    const socket = socketService.connect();
    socketService.joinAdmin();

    // Listen to real-time frame stream
    socketService.on('admin_frame_update', (data) => {
      setSessions((prev) => ({
        ...prev,
        [data.session_id]: {
          ...prev[data.session_id],
          ...data,
          last_update: Date.now()
        }
      }));
    });

    // Listen to session status changes (completions/terminations)
    socketService.on('admin_session_update', (data) => {
      setSessions((prev) => {
        const copy = { ...prev };
        if (data.status === 'completed' || data.status === 'terminated') {
          // Remove session from live screen after 5 seconds delay
          setTimeout(() => {
            setSessions((current) => {
              const cleaned = { ...current };
              delete cleaned[data.session_id];
              return cleaned;
            });
          }, 5000);
          
          if (copy[data.session_id]) {
            copy[data.session_id].status = data.status;
            copy[data.session_id].warning_count = data.warning_count || copy[data.session_id].warning_count;
            copy[data.session_id].cheating_score = data.cheating_score || copy[data.session_id].cheating_score;
          }
        } else {
          if (copy[data.session_id]) {
            copy[data.session_id].warning_count = data.warning_count;
            copy[data.session_id].cheating_score = data.cheating_score;
          }
        }
        return copy;
      });
    });

    // Timeout loop to clean up stale sessions (no frame received for 15 seconds)
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setSessions((prev) => {
        const copy = { ...prev };
        let changed = false;
        Object.keys(copy).forEach((sid) => {
          if (now - copy[sid].last_update > 15000) {
            delete copy[sid];
            changed = true;
          }
        });
        return changed ? copy : prev;
      });
    }, 5000);

    return () => {
      clearInterval(cleanupInterval);
      socketService.off('admin_frame_update');
      socketService.off('admin_session_update');
    };
  }, []);

  const handleSendWarning = (sessionId) => {
    const msg = warningMsg[sessionId];
    if (!msg) return;
    
    socketService.sendAdminCommand(sessionId, 'warn', msg);
    
    // Clear warning input
    setWarningMsg(prev => ({
      ...prev,
      [sessionId]: ''
    }));
  };

  const handleTerminateSession = (sessionId) => {
    if (!confirm('Are you sure you want to TERMINATE this examination session? The candidate will be kicked out immediately.')) return;
    socketService.sendAdminCommand(sessionId, 'terminate');
  };

  const getCheatingScoreColor = (score) => {
    if (score < 30) return 'text-brand-emerald';
    if (score < 70) return 'text-brand-amber';
    return 'text-brand-crimson';
  };

  const getCheatingBorderColor = (score) => {
    if (score < 30) return 'border-brand-emerald/40 hover:border-brand-emerald';
    if (score < 70) return 'border-brand-amber/40 hover:border-brand-amber';
    return 'border-brand-crimson/50 hover:border-brand-crimson neon-glow-crimson';
  };

  const sessionList = Object.values(sessions);

  return (
    <div className="min-h-screen pb-12">
      
      {/* Header bar */}
      <header className="glass-panel border-x-0 border-t-0 py-4 px-6 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin')}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-1.5">
              <Eye className="w-5 h-5 text-brand-purple" />
              Live Proctoring Classroom
            </h2>
            <p className="text-xs text-slate-400">Real-time candidate webcams, cheating indices, and actions logs</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-brand-purple/10 border border-brand-purple/20">
          <span className="h-2 w-2 rounded-full bg-brand-purple animate-ping"></span>
          <span className="text-xs text-brand-purple font-bold">Active Candidates: {sessionList.length}</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4">
        
        {sessionList.length === 0 ? (
          <div className="glass-panel rounded-2xl p-16 flex flex-col items-center justify-center text-center max-w-lg mx-auto mt-12 border-dashed">
            <MonitorOff className="w-16 h-16 text-slate-600 mb-4 animate-pulse-slow" />
            <h3 className="text-xl font-bold text-white mb-2">No Active Examinations</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Waiting for students to initiate face matching checks and begin their tests. Webcam frame feeds will display here instantly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessionList.map((sess) => (
              <div 
                key={sess.session_id} 
                className={`glass-panel rounded-xl overflow-hidden flex flex-col justify-between border-t-2 border transition-all duration-300 ${getCheatingBorderColor(sess.cheating_score)}`}
              >
                
                {/* Webcam Box */}
                <div className="relative aspect-video bg-black/80 flex items-center justify-center">
                  {sess.frame ? (
                    <img 
                      src={sess.frame} 
                      className="w-full h-full object-cover" 
                      alt="Student Stream" 
                    />
                  ) : (
                    <div className="text-slate-500 text-xs flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-t border-brand-purple"></div>
                      Awaiting video feed...
                    </div>
                  )}

                  {/* Header overlay */}
                  <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
                    <span className="bg-slate-950/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                      <User className="w-3 h-3 text-brand-purple" />
                      {sess.student_name}
                    </span>
                    
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      sess.status === 'completed' || sess.status === 'terminated'
                        ? 'bg-slate-900 text-slate-400'
                        : 'bg-brand-purple text-white shadow-sm'
                    }`}>
                      {sess.status === 'completed' || sess.status === 'terminated' 
                        ? sess.status.toUpperCase() 
                        : 'LIVE'}
                    </span>
                  </div>

                  {/* Bottom overlay: active violation */}
                  {sess.violations && sess.violations.length > 0 && (
                    <div className="absolute bottom-2 left-2 right-2 p-1.5 rounded bg-brand-crimson/90 backdrop-blur-xs text-[10px] text-white font-bold flex items-center gap-1 shadow">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span className="line-clamp-1">{sess.violations[0]}</span>
                    </div>
                  )}
                </div>

                {/* Info and stats Panel */}
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="font-bold text-white text-sm line-clamp-1 flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-brand-purple" />
                      {sess.exam_title}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">SESSION INDEX: #{sess.session_id}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-y border-white/5 py-3">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Cheating Index</span>
                      <span className={`text-base font-extrabold ${getCheatingScoreColor(sess.cheating_score)}`}>
                        {sess.cheating_score}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Warnings Count</span>
                      <span className={`text-base font-extrabold ${sess.warning_count >= 4 ? 'text-brand-crimson' : 'text-slate-200'}`}>
                        {sess.warning_count} / 5
                      </span>
                    </div>
                  </div>

                  {/* Remote Actions Form */}
                  {(!sess.status || sess.status === 'active') && (
                    <div className="space-y-3 pt-1">
                      {/* Send Warnings */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 glass-input py-1 px-3 text-xs"
                          placeholder="Warn message..."
                          value={warningMsg[sess.session_id] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWarningMsg(prev => ({
                              ...prev,
                              [sess.session_id]: val
                            }));
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSendWarning(sess.session_id)}
                          className="p-2 bg-brand-purple hover:bg-brand-purple/95 rounded-lg text-white shadow-sm transition-all"
                          title="Send Warning"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Terminate Session */}
                      <button
                        type="button"
                        onClick={() => handleTerminateSession(sess.session_id)}
                        className="w-full py-2 bg-brand-crimson/10 border border-brand-crimson/30 hover:bg-brand-crimson text-brand-crimson hover:text-white font-bold rounded-lg transition-all text-[11px] flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Terminate Candidate Exam
                      </button>
                    </div>
                  )}

                  {(sess.status === 'completed' || sess.status === 'terminated') && (
                    <div className="p-2.5 rounded bg-white/5 border border-white/5 text-slate-500 text-center text-xs font-semibold">
                      Session Terminated. Awaiting Report Compilation.
                    </div>
                  )}

                </div>

              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
};

export default LiveMonitor;
