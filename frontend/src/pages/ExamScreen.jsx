import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { examAPI } from '../services/api';
import socketService from '../services/socket';
import { 
  Camera, ShieldAlert, Sparkles, CheckCircle2, Shield,
  Volume2, Maximize, AlertCircle, Play, ChevronLeft, ChevronRight, HelpCircle
} from 'lucide-react';

const ExamScreen = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Wizard Steps: 1 = Identity Check, 2 = System Agreement, 3 = Active Exam
  const [step, setStep] = useState(1);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Verification States
  const [stream, setStream] = useState(null);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Step 2: System Check States
  const [fullscreenGranted, setFullscreenGranted] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [audioStream, setAudioStream] = useState(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  // Step 3: Active Exam States
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId -> selectedOption
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes default
  const [warningCount, setWarningCount] = useState(0);
  const [cheatingScore, setCheatingScore] = useState(0);
  const [warningsList, setWarningsList] = useState([]);
  const [isFullscreenActive, setIsFullscreenActive] = useState(true);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningModalMessage, setWarningModalMessage] = useState('');

  // Media Recording & Streaming Intervals
  const frameIntervalRef = useRef(null);
  const audioIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Fetch Exam Details on Mount
  useEffect(() => {
    fetchExamDetails();
    return () => {
      stopVerificationCamera();
      stopAudioAnalyser();
      clearIntervals();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const fetchExamDetails = async () => {
    try {
      setLoading(true);
      const data = await examAPI.getExam(examId);
      setExam(data.exam);
      setTimeLeft(data.exam.duration_minutes * 60);
      startVerificationCamera();
    } catch (err) {
      setError('Failed to fetch exam details.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Camera helpers for verification (Step 1)
  const startVerificationCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'user' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error(err);
      setError('Webcam is required. Please check system configurations.');
    }
  };

  const stopVerificationCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleVerifyFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setVerifyLoading(true);
    setError('');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64Snapshot = canvas.toDataURL('image/jpeg', 0.85);

      const data = await authAPI.verifyFace(base64Snapshot);
      if (data.success) {
        setVerifySuccess(true);
        stopVerificationCamera();
        // Progress to Step 2
        setStep(2);
        startAudioAnalyser();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. The face does not match the registered user.');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Audio Analyser helpers (Step 2)
  const startAudioAnalyser = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setAudioStream(mediaStream);

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        // Normalize volume (0 - 100)
        const average = sum / bufferLength;
        setMicVolume(Math.min(100, Math.round(average * 1.5)));
      }, 100);

    } catch (err) {
      console.error("Audio analyser failed:", err);
      // Let them pass, but log that microphone is disabled/unavailable
    }
  };

  const stopAudioAnalyser = () => {
    clearInterval(audioIntervalRef.current);
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // Request Fullscreen (Step 2)
  const handleRequestFullscreen = async () => {
    try {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      }
      setFullscreenGranted(true);
    } catch (err) {
      console.error(err);
      setError('Fullscreen authorization is required.');
    }
  };

  // Start Exam Session (Step 3)
  const handleBeginExam = async () => {
    if (!fullscreenGranted) {
      setError('You must authorize Fullscreen mode to begin the exam.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      // API call to create or resume session
      const data = await examAPI.startSession(examId);
      setSessionId(data.session_id);
      setQuestions(data.questions);
      setWarningCount(data.warning_count || 0);
      setCheatingScore(data.cheating_score || 0);
      
      // Load pre-existing answers if resumed
      const sessionDetails = await examAPI.getSessionDetails(data.session_id);
      const preAnswers = {};
      sessionDetails.answers.forEach(ans => {
        preAnswers[ans.question_id] = ans.selected_option;
      });
      setAnswers(preAnswers);

      setStep(3);
      
      // Initialize Socket & Video capture
      initSocketConnection(data.session_id);
      initVideoCaptureStream(data.session_id);
      
      // Enable Copy/Paste blocks
      enableAcademicLockdowns();
      
      // Start Countdown Timer
      startCountdown();

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initialize exam session.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Academic Lockdown Blocks
  const enableAcademicLockdowns = () => {
    // Disable right click
    document.addEventListener('contextmenu', preventDefaultAction);
    // Disable text copy/paste/select
    document.addEventListener('copy', preventDefaultAction);
    document.addEventListener('paste', preventDefaultAction);
    document.addEventListener('selectstart', preventDefaultAction);
    
    // Watch tab switches / minimization
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    
    // Watch fullscreen exit
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  };

  const disableAcademicLockdowns = () => {
    document.removeEventListener('contextmenu', preventDefaultAction);
    document.removeEventListener('copy', preventDefaultAction);
    document.removeEventListener('paste', preventDefaultAction);
    document.removeEventListener('selectstart', preventDefaultAction);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleWindowBlur);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
  };

  const preventDefaultAction = (e) => {
    e.preventDefault();
  };

  // Focus violation events
  const handleVisibilityChange = () => {
    if (document.hidden && sessionId) {
      socketService.sendStudentAction(sessionId, 'Tab Switching');
      logLocalWarning('Tab Switching Detected! Please focus on your exam screen.');
    }
  };

  const handleWindowBlur = () => {
    if (sessionId) {
      socketService.sendStudentAction(sessionId, 'Minimize / Window Blur');
      logLocalWarning('Window focus lost! Focus away from exam interface is logged.');
    }
  };

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      setIsFullscreenActive(false);
      if (sessionId) {
        socketService.sendStudentAction(sessionId, 'Fullscreen Exit');
        logLocalWarning('Exited Fullscreen! Fullscreen mode is mandatory.');
      }
    } else {
      setIsFullscreenActive(true);
    }
  };

  const logLocalWarning = (msg) => {
    setWarningModalMessage(msg);
    setShowWarningModal(true);
  };

  // Timer logic
  const startCountdown = () => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Socket setup
  const initSocketConnection = (sessId) => {
    const socket = socketService.connect();
    socketService.joinExam(sessId);

    // Listen to proctor updates
    socketService.on('proctor_feedback', (data) => {
      setWarningCount(data.warning_count);
      setCheatingScore(data.cheating_score);
      if (data.violations && data.violations.length > 0) {
        setWarningsList(data.violations);
      }
      if (data.alert) {
        logLocalWarning(data.alert);
      }
    });

    socketService.on('admin_warning', (data) => {
      setWarningCount(data.warning_count);
      logLocalWarning(`ADMINISTRATOR ALERT: ${data.message}`);
    });

    socketService.on('auto_submit', (data) => {
      handleAutoSubmit(data.message);
    });

    socketService.on('exam_terminated', (data) => {
      handleAutoSubmit(data.message);
    });
  };

  // Capture loop & Web Recorder (MediaRecorder API)
  const initVideoCaptureStream = async (sessId) => {
    try {
      const activeStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { max: 15 } },
        audio: true
      });

      // Video Preview element
      if (videoRef.current) {
        videoRef.current.srcObject = activeStream;
        videoRef.current.play();
      }

      // 1. Setup local video recording
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(activeStream, { mimeType: 'video/webm;codecs=vp8' });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Record in 3-second slices
      mediaRecorder.start(3000);

      // 2. Setup frame capture Socket.IO stream
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      
      frameIntervalRef.current = setInterval(() => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        tempCanvas.width = 320; // Downscale frame for speed
        tempCanvas.height = 240;
        
        ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        const frameBase64 = tempCanvas.toDataURL('image/jpeg', 0.7); // compress
        
        socketService.sendVideoFrame(sessId, frameBase64);
      }, 1500); // 1.5 seconds intervals

      // 3. Monitor mic volume levels inside react as well (Web Audio)
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(activeStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let talkWarningsCounter = 0;
      audioIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const vol = Math.min(100, Math.round(avg * 1.5));
        
        if (vol > 35) { // Noise threshold
          talkWarningsCounter++;
          if (talkWarningsCounter > 20) { // Persistent noise
            socketService.sendStudentAction(sessId, 'Excessive Speaking / Noise');
            talkWarningsCounter = 0;
          }
        } else {
          talkWarningsCounter = Math.max(0, talkWarningsCounter - 1);
        }
      }, 200);

    } catch (err) {
      console.error("Camera proctoring streams initialization failed:", err);
      setError("AI Proctoring streams failed to launch. Camera & Mic are mandatory.");
    }
  };

  const clearIntervals = () => {
    clearInterval(frameIntervalRef.current);
    clearInterval(audioIntervalRef.current);
  };

  // MCQ Navigation and Save Answer
  const handleSelectOption = async (questionId, option) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: option
    }));

    try {
      await examAPI.saveAnswer(sessionId, questionId, option);
    } catch (err) {
      console.error("Answer autosave failed:", err);
    }
  };

  // Submit Exam Actions
  const handleSubmitExam = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    clearIntervals();
    
    // Stop recording first
    let videoUrl = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Wait a tiny bit for chunk compiling
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Package video blob
      const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      try {
        const uploadRes = await examAPI.uploadVideo(sessionId, videoBlob);
        videoUrl = uploadRes.path;
      } catch (uploadErr) {
        console.error("Video recording upload failed:", uploadErr);
      }
    }

    try {
      // Complete exam session
      await examAPI.submitSession(sessionId, videoUrl);
      
      // Tear down lockdowns
      disableAcademicLockdowns();
      socketService.leaveExam(sessionId);
      socketService.disconnect();

      // Stop camera tracks
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }

      // Exit Fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }

      navigate('/dashboard');
    } catch (err) {
      setError('Submit failed. Please notify the assessor.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = async (alertMsg = 'Exam completed.') => {
    disableAcademicLockdowns();
    clearIntervals();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    alert(alertMsg);
    navigate('/dashboard');
  };

  if (loading && step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-purple mx-auto mb-4"></div>
          <p className="text-slate-400">Locking environment and loading exam paper...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 flex flex-col justify-between">
      
      {/* ------------------------------------------------------------- */}
      {/* STEP 1: IDENTITY VERIFICATION WIZARD */}
      {/* ------------------------------------------------------------- */}
      {step === 1 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border-t-brand-purple/40">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-1.5">
              <Shield className="w-5 h-5 text-brand-purple" />
              Pre-Exam Face Verification
            </h3>
            <p className="text-xs text-slate-400 mb-6">Take a snapshot to verify your identity against your registered profile.</p>
            
            {error && (
              <div className="mb-4 p-3 bg-brand-crimson/15 border border-brand-crimson/30 rounded-lg text-brand-crimson text-sm font-medium">
                {error}
              </div>
            )}

            <div className="relative rounded-xl overflow-hidden aspect-video bg-black/60 border border-white/10 flex items-center justify-center mb-6">
              {stream ? (
                <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />
              ) : (
                <div className="animate-pulse text-xs text-slate-500">Initializing camera feed...</div>
              )}
            </div>
            
            <canvas ref={canvasRef} className="hidden" />

            <button
              onClick={handleVerifyFace}
              className="w-full bg-brand-purple hover:bg-brand-purple/95 text-white font-semibold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
              disabled={verifyLoading}
            >
              {verifyLoading ? 'Matching biometrics...' : 'Verify Identity'}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STEP 2: SYSTEM CONDITIONS AGREEMENT */}
      {/* ------------------------------------------------------------- */}
      {step === 2 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border-t-brand-amber/40">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-5 h-5 text-brand-amber" />
              System Checks & Lockdown Setup
            </h3>
            <p className="text-xs text-slate-400 mb-6">Configure proctoring bounds before starting the examination.</p>

            <div className="space-y-4 mb-6">
              {/* Audio Volume indicator */}
              <div className="p-4 bg-dark-900 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-brand-purple" />
                    Microphone Input check
                  </span>
                  <span className="text-xs text-slate-400">{micVolume > 0 ? 'Active' : 'Unused'}</span>
                </div>
                <div className="w-full h-2 bg-dark-950 rounded overflow-hidden">
                  <div 
                    className="h-full bg-brand-purple transition-all duration-100" 
                    style={{ width: `${micVolume}%` }}
                  />
                </div>
              </div>

              {/* Fullscreen authorization */}
              <div className="p-4 bg-dark-900 border border-white/5 rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                    <Maximize className="w-4 h-4 text-brand-purple" />
                    Authorize Fullscreen Mode
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Required to block tab switches.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRequestFullscreen}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    fullscreenGranted 
                      ? 'bg-brand-emerald/10 border border-brand-emerald text-brand-emerald cursor-default'
                      : 'bg-brand-purple text-white hover:bg-brand-purple/95'
                  }`}
                  disabled={fullscreenGranted}
                >
                  {fullscreenGranted ? 'Authorized' : 'Authorize'}
                </button>
              </div>
            </div>

            <button
              onClick={handleBeginExam}
              className="w-full bg-brand-purple hover:bg-brand-purple/95 text-white font-semibold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
              disabled={!fullscreenGranted}
            >
              <Play className="w-4 h-4" />
              Begin Examination
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STEP 3: ACTIVE EXAM ENVIRONMENT */}
      {/* ------------------------------------------------------------- */}
      {step === 3 && exam && (
        <>
          {/* Top proctor metrics banner */}
          <header className="glass-panel border-x-0 border-t-0 py-3.5 px-6 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-white leading-tight">{exam.title}</h2>
              <span className="text-[10px] text-slate-500">EXAM SESSION ID: #{sessionId}</span>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Warnings Count */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-brand-crimson/10 border border-brand-crimson/20">
                <AlertCircle className="w-4 h-4 text-brand-crimson" />
                <span className="text-xs text-brand-crimson font-bold">Warnings: {warningCount}/5</span>
              </div>
              
              {/* Cheating Score Gauge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-brand-amber/10 border border-brand-amber/20">
                <ShieldAlert className="w-4 h-4 text-brand-amber" />
                <span className="text-xs text-brand-amber font-bold">Risk Score: {cheatingScore}%</span>
              </div>

              {/* Countdown timer */}
              <div className="px-3.5 py-1 bg-dark-900 border border-white/5 rounded font-mono font-bold text-white">
                {formatTime(timeLeft)}
              </div>
            </div>
          </header>

          {/* Main workspace */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 select-none" style={{ userSelect: 'none' }}>
            
            {/* Left side: Web camera widget */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-panel rounded-xl overflow-hidden aspect-video bg-black/60 border border-white/5 relative shadow-lg">
                <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-brand-emerald/90 text-[10px] font-bold text-white tracking-wide">
                  <span className="h-1.5 w-1.5 bg-white rounded-full animate-ping"></span>
                  AI PROCTOR ONLINE
                </div>
              </div>

              {/* Warnings history log details */}
              <div className="glass-panel rounded-xl p-4 h-[300px] flex flex-col justify-between border-t-white/10">
                <div className="flex flex-col h-full justify-between">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Live AI Proctor Log</h4>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                    {warningsList.length === 0 ? (
                      <p className="text-slate-500 italic">No infractions reported. Maintain focus.</p>
                    ) : (
                      warningsList.map((warn, i) => (
                        <div key={i} className="p-2 rounded bg-brand-crimson/5 border border-brand-crimson/10 text-brand-crimson font-medium">
                          {warn}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Questions and choices */}
            <div className="lg:col-span-3 flex flex-col justify-between glass-panel rounded-xl p-6 border-t-white/10 relative">
              {questions.length > 0 ? (
                <>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Question {currentQIndex + 1} of {questions.length}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded bg-brand-purple/10 border border-brand-purple/20 text-brand-purple font-semibold">
                        {questions[currentQIndex].points} point
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white tracking-wide leading-relaxed">
                      {questions[currentQIndex].question_text}
                    </h3>

                    <div className="space-y-3 pt-2">
                      {['A', 'B', 'C', 'D'].map((opt) => {
                        const optText = questions[currentQIndex][`option_${opt.toLowerCase()}`];
                        const isSelected = answers[questions[currentQIndex].id] === opt;
                        
                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelectOption(questions[currentQIndex].id, opt)}
                            className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all flex items-center gap-3 ${
                              isSelected
                                ? 'bg-brand-purple/15 border-brand-purple text-white shadow-md'
                                : 'bg-dark-900 border-white/5 text-slate-300 hover:border-brand-purple/40'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                              isSelected
                                ? 'bg-brand-purple border-brand-purple text-white'
                                : 'bg-dark-950 border-white/10 text-slate-400'
                            }`}>
                              {opt}
                            </span>
                            {optText}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Navigation controls */}
                  <div className="flex justify-between items-center pt-8 border-t border-white/5 mt-6">
                    <button
                      onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentQIndex === 0}
                      className="px-4 py-2 rounded-lg bg-dark-900 border border-white/5 text-slate-300 text-xs font-semibold hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-dark-900 transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>

                    <button
                      onClick={handleSubmitExam}
                      disabled={submitting}
                      className="px-6 py-2.5 rounded-lg bg-brand-emerald hover:bg-brand-emerald/90 text-white text-xs font-bold shadow-md hover:shadow-brand-emerald/20 transition-all"
                    >
                      {submitting ? 'Submitting Answers...' : 'Submit Examination'}
                    </button>

                    <button
                      onClick={() => setCurrentQIndex(prev => Math.min(questions.length - 1, prev + 1))}
                      disabled={currentQIndex === questions.length - 1}
                      className="px-4 py-2 rounded-lg bg-dark-900 border border-white/5 text-slate-300 text-xs font-semibold hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-dark-900 transition-colors flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
                  <HelpCircle className="w-12 h-12 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500">Exams questions dataset empty.</p>
                </div>
              )}
            </div>
          </main>
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* WARNING MODAL DIALOG */}
      {/* ------------------------------------------------------------- */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm glass-panel rounded-2xl p-6 border border-brand-crimson/30 neon-glow-crimson text-center">
            <div className="p-3 bg-brand-crimson/10 border border-brand-crimson/30 rounded-xl w-fit mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-brand-crimson" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Proctoring Alert</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {warningModalMessage}
            </p>
            <button
              onClick={() => {
                setShowWarningModal(false);
                // Attempt to go back to fullscreen if they exited
                if (!document.fullscreenElement && step === 3) {
                  const element = document.documentElement;
                  if (element.requestFullscreen) element.requestFullscreen();
                }
              }}
              className="w-full bg-brand-crimson hover:bg-brand-crimson/95 text-white font-semibold py-2.5 rounded-lg shadow-md transition-all text-xs"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen restriction cover if exited fullscreen in step 3 */}
      {step === 3 && !isFullscreenActive && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center p-4 fullscreen-warning-overlay">
          <div className="text-center max-w-md">
            <ShieldAlert className="w-16 h-16 text-brand-crimson mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-black text-white mb-2">FULLSCREEN MODE REQUIRED</h2>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed">
              Exiting fullscreen mode constitutes a proctor violation. Please re-enter fullscreen immediately to continue your exam.
            </p>
            <button
              onClick={() => {
                const element = document.documentElement;
                if (element.requestFullscreen) {
                  element.requestFullscreen();
                } else if (element.webkitRequestFullscreen) {
                  element.webkitRequestFullscreen();
                }
              }}
              className="bg-brand-purple hover:bg-brand-purple/95 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-brand-purple/35 transition-all text-sm"
            >
              Restore Fullscreen Mode
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamScreen;
