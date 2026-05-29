import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Server, Github } from 'lucide-react';
import { authAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

function AuthShell({ children, title, subtitle }) {
  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Server size={20} color="#fff" />
            </div>
            <h1>Juan<span>Host</span></h1>
          </div>
          <p>Deploy anything · Scale everywhere</p>
        </div>
        <div className="auth-card">
          <h2>{title}</h2>
          <p className="sub">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async e => {
    e.preventDefault(); setLoading(true);
    try {
      const { data } = await authAPI.login(form);
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate('/dashboard');
    } catch (err) { toast.error(err.response?.data?.error || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your JuanHost account">
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required autoFocus />
        </div>
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label">Password</label>
            <Link to="/forgot-password" style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>Forgot?</Link>
          </div>
          <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
        </div>
        <button className="btn btn-primary btn-full" style={{ marginTop: 4, padding: 12 }} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <div className="auth-link">Don't have an account? <Link to="/register">Create one free</Link></div>
    </AuthShell>
  );
}

export function Register() {
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async e => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const { data } = await authAPI.register({ name: form.name, username: form.username, email: form.email, password: form.password });
      login(data.token, data.user);
      toast.success('Account created! Welcome to JuanHost 🚀');
      navigate('/dashboard');
    } catch (err) { toast.error(err.response?.data?.error || 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell title="Create your account" subtitle="Free plan · 3 services · No credit card">
      <form onSubmit={submit}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="input" placeholder="John Doe" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="input" placeholder="johndoe" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} pattern="[a-z0-9_-]+" required />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="input" type="password" placeholder="Min. 6 chars" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} minLength={6} required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm</label>
            <input className="input" type="password" placeholder="Repeat" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
          </div>
        </div>
        <button className="btn btn-primary btn-full" style={{ marginTop: 4, padding: 12 }} disabled={loading}>
          {loading ? 'Creating account...' : 'Create Free Account'}
        </button>
      </form>
      <div className="auth-link">Already have an account? <Link to="/login">Sign in</Link></div>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault(); setLoading(true);
    try { await authAPI.forgotPassword({ email }); setSent(true); }
    catch { toast.error('Something went wrong'); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell title="Reset password" subtitle="We'll send you a reset link">
      {sent ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📬</div>
          <p style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: '0.88rem', lineHeight: 1.6 }}>
            If that email exists, a reset link was sent. Check your inbox.
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
        </form>
      )}
      <div className="auth-link"><Link to="/login">← Back to login</Link></div>
    </AuthShell>
  );
}

export function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await authAPI.resetPassword(token, { password: form.password });
      toast.success('Password reset! Please login.');
      navigate('/login');
    } catch (err) { toast.error(err.response?.data?.error || 'Reset failed'); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell title="New password" subtitle="Choose a strong password">
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label">New Password</label>
          <input className="input" type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} minLength={6} required autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm Password</label>
          <input className="input" type="password" placeholder="Repeat" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
        </div>
        <button className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
      </form>
    </AuthShell>
  );
}

export default Login;
