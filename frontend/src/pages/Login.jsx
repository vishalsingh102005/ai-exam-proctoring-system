import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail, Sparkles, PhoneIncoming, AlertCircle } from 'lucide-react';
import { authAPI } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loginMode, setLoginMode] = useState('password'); // 'password' or 'otp'
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const { login, otpLogin } = useAuth();
  const navigate = useNavigate();

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    try {
      const user = await login(email, password);
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await authAPI.forgotPassword(email);
      setOtpSent(true);
      setMessage(data.message); // Contains mock instructions
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !otp) {
      setError('Please enter the OTP.');
      return;
    }
    setSubmitting(true);
    try {
      const user = await otpLogin(email, otp);
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      {/* Background neon blobs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-purple/20 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-brand-pink/15 rounded-full blur-3xl animate-pulse-slow"></div>

      <div className="w-full max-w-md glass-panel rounded-2xl p-8 z-10 neon-glow-purple border-t-brand-purple/40">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-brand-purple/10 rounded-xl mb-3 border border-brand-purple/30">
            <Sparkles className="w-8 h-8 text-brand-purple" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">ProctorAI</h2>
          <p className="text-slate-400 text-sm mt-1 text-center">Secure Exam Proctoring & Management Hub</p>
        </div>

        {/* Toggle Login Modes */}
        <div className="flex rounded-lg bg-dark-900/60 p-1 mb-6 border border-white/5">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              loginMode === 'password' ? 'bg-brand-purple text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => {
              setLoginMode('password');
              setError('');
              setMessage('');
            }}
          >
            Password Mode
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              loginMode === 'otp' ? 'bg-brand-purple text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => {
              setLoginMode('otp');
              setError('');
              setMessage('');
            }}
          >
            OTP Login
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-brand-crimson/15 border border-brand-crimson/30 rounded-lg flex items-start gap-2.5 text-brand-crimson text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-brand-emerald/15 border border-brand-emerald/30 rounded-lg text-brand-emerald text-sm">
            {message}
          </div>
        )}

        {loginMode === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  className="w-full glass-input pl-10"
                  placeholder="name@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider">Password</label>
                <button
                  type="button"
                  className="text-xs text-brand-purple hover:underline"
                  onClick={async () => {
                    if (!email) {
                      setError('Enter email address to reset password.');
                      return;
                    }
                    try {
                      const data = await authAPI.forgotPassword(email);
                      setMessage(data.message);
                    } catch (err) {
                      setError(err.response?.data?.message || 'Failed to trigger reset.');
                    }
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  className="w-full glass-input pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-brand-purple hover:bg-brand-purple/95 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-brand-purple/35 transition-all flex items-center justify-center gap-2 mt-4"
              disabled={submitting}
            >
              {submitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={otpSent ? handleOtpSubmit : handleRequestOtp} className="space-y-5">
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  className="w-full glass-input pl-10"
                  placeholder="name@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={otpSent || submitting}
                />
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Enter OTP Code</label>
                <div className="relative">
                  <PhoneIncoming className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    className="w-full glass-input pl-10"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-brand-purple hover:bg-brand-purple/95 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-brand-purple/35 transition-all flex items-center justify-center gap-2 mt-4"
              disabled={submitting}
            >
              {submitting 
                ? 'Processing...' 
                : (otpSent ? 'Verify OTP' : 'Request OTP Code')}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-slate-400 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-purple font-semibold hover:underline">
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
