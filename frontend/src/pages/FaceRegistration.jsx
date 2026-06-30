import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { Camera, Sparkles, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

const FaceRegistration = () => {
  const { user, updateFaceStatus } = useAuth();
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setError('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.error(err);
      setError('Could not access webcam. Please check camera permissions in your browser.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setCameraActive(false);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setError('');
    setLoading(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Draw current video frame to canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64 jpeg
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);
      
      // Upload to backend
      const data = await authAPI.registerFace(imageBase64);
      
      if (data.face_registered) {
        updateFaceStatus(true);
        setSuccess(true);
        stopCamera();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Face registration failed. Please ensure your face is fully visible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 relative flex items-center justify-center">
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-purple/10 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-brand-pink/10 rounded-full blur-3xl animate-pulse-slow"></div>

      <div className="w-full max-w-lg glass-panel rounded-2xl p-6 z-10 neon-glow-purple border-t-brand-purple/40">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-1.5">
              <Camera className="w-5 h-5 text-brand-purple" />
              Face Registration
            </h2>
            <p className="text-xs text-slate-400">Capture your face encoding vector for proctor verification</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-brand-crimson/15 border border-brand-crimson/30 rounded-lg flex items-start gap-2.5 text-brand-crimson text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="p-4 bg-brand-emerald/10 border border-brand-emerald/30 rounded-full neon-glow-emerald animate-bounce">
              <CheckCircle2 className="w-16 h-16 text-brand-emerald" />
            </div>
            <h3 className="text-xl font-bold text-white">Face Registered Successfully!</h3>
            <p className="text-sm text-slate-400 text-center max-w-xs">
              Your biometric face structure has been compiled and saved. You can now take exams.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 bg-brand-purple hover:bg-brand-purple/95 text-white font-semibold py-2.5 px-6 rounded-lg transition-all"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Webcam viewport box */}
            <div className="relative rounded-xl overflow-hidden aspect-video bg-black/60 border border-white/10 flex items-center justify-center">
              {cameraActive ? (
                <>
                  <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover scale-x-[-1]" // Mirror camera feed
                    playsInline 
                    muted
                  />
                  {/* Overlay Guides */}
                  <div className="absolute inset-0 border-[30px] border-black/40 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-64 border-2 border-dashed border-brand-purple/60 rounded-[100px] shadow-[0_0_0_9999px_rgba(3,7,18,0.3)] flex items-center justify-center">
                      <div className="w-full text-center text-xs font-semibold text-brand-purple/80 bg-slate-950/80 py-1 rounded px-2">
                        Position face inside oval
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-4">
                  <div className="animate-pulse rounded-full h-12 w-12 border-t-2 border-brand-purple mx-auto mb-3"></div>
                  <p className="text-sm text-slate-500">Initializing video stream...</p>
                </div>
              )}
            </div>

            {/* Hidden canvas for capturing */}
            <canvas ref={canvasRef} className="hidden" />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white">Instructions for Capture:</h4>
              <ul className="text-xs text-slate-400 list-disc pl-4 space-y-1.5">
                <li>Ensure you are in a well-lit room.</li>
                <li>Remove hats, sunglasses, or heavy masks.</li>
                <li>Position yourself directly in front of the camera, looking straight ahead.</li>
                <li>Maintain a neutral expression during compilation.</li>
              </ul>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 py-3 px-4 rounded-lg bg-dark-900 border border-white/5 text-slate-300 font-semibold hover:bg-white/5 transition-all"
                disabled={loading}
              >
                Reset Camera
              </button>
              <button
                type="button"
                onClick={handleCapture}
                className="flex-1 py-3 px-4 rounded-lg bg-brand-purple hover:bg-brand-purple/95 text-white font-semibold shadow-md hover:shadow-brand-purple/35 transition-all flex items-center justify-center gap-1.5"
                disabled={!cameraActive || loading}
              >
                {loading ? 'Compiling Face...' : 'Capture Face'}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default FaceRegistration;
