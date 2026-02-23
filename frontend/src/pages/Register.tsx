// src/pages/Register.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', formData);
      alert('Account created successfully! Please log in.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        .auth-page {
          min-height: 100vh;
          background: #050a14;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 16px;
          font-family: 'Outfit', sans-serif;
          color: #e8f0ff;
          position: relative;
          overflow: hidden;
        }

        .auth-orb {
          position: fixed; border-radius: 50%;
          filter: blur(100px); pointer-events: none; z-index: 0;
        }
        .auth-orb-1 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(56,114,255,0.16) 0%, transparent 70%);
          top: -100px; left: -100px;
        }
        .auth-orb-2 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(0,210,160,0.1) 0%, transparent 70%);
          bottom: -80px; right: -80px;
        }

        .auth-logo {
          position: relative; z-index: 1;
          font-family: 'Instrument Serif', serif;
          font-size: 22px; color: #fff;
          margin-bottom: 28px;
          text-decoration: none;
          display: block; text-align: center;
        }
        .auth-logo span { color: #4d8dff; font-style: italic; }

        .auth-card {
          position: relative; z-index: 1;
          width: 100%; max-width: 420px;
          background: rgba(14,17,25,0.9);
          border: 1px solid rgba(232,240,255,0.08);
          border-radius: 20px;
          overflow: hidden;
          backdrop-filter: blur(20px);
        }

        .auth-header {
          padding: 32px 32px 28px;
          border-bottom: 1px solid rgba(232,240,255,0.06);
          text-align: center;
        }
        .auth-header h2 {
          font-family: 'Instrument Serif', serif;
          font-size: 28px; color: #fff; font-weight: 400;
          margin-bottom: 6px;
        }
        .auth-header p {
          font-size: 13px; color: rgba(232,240,255,0.4); font-weight: 300;
        }

        .auth-body { padding: 28px 32px 32px; }

        .auth-error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 13px; color: #f87171;
          margin-bottom: 20px; text-align: center;
        }

        .auth-field { margin-bottom: 18px; }
        .auth-label {
          display: block; font-size: 11px; font-weight: 600;
          color: rgba(232,240,255,0.5); margin-bottom: 8px;
          letter-spacing: 0.05em; text-transform: uppercase;
        }
        .auth-input {
          width: 100%; padding: 12px 16px;
          background: rgba(232,240,255,0.04);
          border: 1px solid rgba(232,240,255,0.1);
          border-radius: 10px;
          color: #e8f0ff; font-family: 'Outfit', sans-serif;
          font-size: 14px; outline: none;
          transition: border-color 0.2s;
        }
        .auth-input::placeholder { color: rgba(232,240,255,0.2); }
        .auth-input:focus { border-color: rgba(77,141,255,0.5); }

        .auth-hint {
          font-size: 11px; color: rgba(232,240,255,0.25);
          margin-top: 6px; line-height: 1.5;
        }

        .auth-btn {
          width: 100%; padding: 14px; margin-top: 8px;
          background: linear-gradient(135deg, #3b7bff, #6c40f0);
          border: none; border-radius: 10px;
          color: #fff; font-family: 'Outfit', sans-serif;
          font-size: 15px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 0 30px rgba(59,123,255,0.25);
        }
        .auth-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 0 40px rgba(59,123,255,0.4);
        }
        .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .auth-footer {
          margin-top: 24px; text-align: center;
          font-size: 13px; color: rgba(232,240,255,0.35);
        }
        .auth-footer a {
          color: #4d8dff; text-decoration: none; font-weight: 500;
          transition: color 0.2s;
        }
        .auth-footer a:hover { color: #7ab0ff; }

        .auth-back {
          position: relative; z-index: 1;
          margin-top: 24px; text-align: center;
        }
        .auth-back a {
          font-size: 12px; color: rgba(232,240,255,0.3);
          text-decoration: none; transition: color 0.2s;
        }
        .auth-back a:hover { color: rgba(232,240,255,0.6); }

        @media (max-width: 480px) {
          .auth-header { padding: 24px 20px 20px; }
          .auth-header h2 { font-size: 24px; }
          .auth-body { padding: 20px 20px 24px; }
          .auth-card { border-radius: 16px; }
        }
      `}</style>

      <div className="auth-page">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />

        <a href="/" className="auth-logo">Swift<span>Mall</span></a>

        <div className="auth-card">
          <div className="auth-header">
            <h2>Join SwiftMall</h2>
            <p>Create your account and start shopping</p>
          </div>
          <div className="auth-body">
            {error && <div className="auth-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-label">Username</label>
                <input
                  className="auth-input"
                  name="username" type="text" required
                  placeholder="Choose a username"
                  value={formData.username} onChange={handleChange}
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Email Address</label>
                <input
                  className="auth-input"
                  name="email" type="email" required
                  placeholder="you@example.com"
                  value={formData.email} onChange={handleChange}
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Password</label>
                <input
                  className="auth-input"
                  name="password" type="password" required
                  placeholder="••••••••"
                  value={formData.password} onChange={handleChange}
                />
                <div className="auth-hint">At least 8 characters recommended</div>
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
            <div className="auth-footer">
              Already have an account? <a href="/login">Sign in</a>
            </div>
          </div>
        </div>

        <div className="auth-back">
          <a href="/">← Back to home</a>
        </div>
      </div>
    </>
  );
};

export default Register;
