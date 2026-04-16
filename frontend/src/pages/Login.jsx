import { useState } from 'react';
import { LogIn, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import KallixLogo from '../components/KallixLogo';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [view, setView] = useState('login'); // 'login' | 'forgot' | 'forgot_sent'

  return (
    <div className="login-container">
      {view === 'login'      && <LoginForm   onLogin={onLogin} onForgot={() => setView('forgot')} />}
      {view === 'forgot'     && <ForgotForm  onBack={() => setView('login')} onSent={() => setView('forgot_sent')} />}
      {view === 'forgot_sent'&& <ForgotSent  onBack={() => setView('login')} />}
    </div>
  );
}

function LoginForm({ onLogin, onForgot }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(username, password);
      // Session cookie is set server-side (HttpOnly) — nothing to store in JS
      onLogin(data);
    } catch (err) {
      setError(err.message === 'API error: 401' ? 'Invalid username or password' : err.message);
    }
    setLoading(false);
  }

  return (
    <form className="login-card" onSubmit={handleSubmit}>
      <div className="login-brand">
        <div className="login-brand-icon">
          <img src="/Images/kallix-icon-animated-transparent.gif" alt="Kallix" />
        </div>
        <h1 className="login-brand-name">Kallix</h1>
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="login-field">
        <label>Email</label>
        <input type="email" value={username} onChange={e => setUsername(e.target.value)}
               placeholder="you@example.com" autoFocus autoComplete="email" />
      </div>

      <div className="login-field">
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
               placeholder="Enter password" autoComplete="current-password" />
      </div>

      <button type="submit" className="btn-primary login-btn" disabled={loading}>
        {loading ? 'Signing in...' : <><LogIn size={14} /> Sign In</>}
      </button>

      <button type="button" className="login-forgot-link" onClick={onForgot}>
        Forgot your password?
      </button>
    </form>
  );
}

function ForgotForm({ onBack, onSent }) {
  const [email, setEmail]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      onSent();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  return (
    <form className="login-card" onSubmit={handleSubmit}>
      <div className="login-brand">
        <div className="login-brand-icon">
          <img src="/Images/kallix-icon-animated-transparent.gif" alt="Kallix" />
        </div>
        <h1 className="login-brand-name">Reset Password</h1>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
        Enter your account email and we'll send you a reset link.
      </p>

      {error && <div className="login-error">{error}</div>}

      <div className="login-field">
        <label>Email Address</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
               placeholder="you@company.com" autoFocus autoComplete="email" />
      </div>

      <button type="submit" className="btn-primary login-btn" disabled={loading}>
        {loading ? 'Sending...' : <><Mail size={14} /> Send Reset Link</>}
      </button>

      <button type="button" className="login-forgot-link" onClick={onBack}>
        <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        Back to sign in
      </button>
    </form>
  );
}

function ForgotSent({ onBack }) {
  return (
    <div className="login-card">
      <div className="login-brand">
        <div className="login-brand-icon" style={{ color: 'var(--green)' }}>
          <CheckCircle size={44} />
        </div>
        <h1 className="login-brand-name">Check Your Email</h1>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, textAlign: 'center', lineHeight: 1.6 }}>
        If that email is registered, a password reset link has been sent.
        The link expires in 1 hour.
      </p>

      <button type="button" className="btn-primary login-btn" onClick={onBack}>
        <LogIn size={14} /> Back to Sign In
      </button>
    </div>
  );
}
