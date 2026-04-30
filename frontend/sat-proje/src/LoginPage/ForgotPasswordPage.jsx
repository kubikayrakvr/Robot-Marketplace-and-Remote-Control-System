import { useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Bir hata oluştu');
      }

      setStatus('success');
      setMessage(data.message);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/login" className="back-link">
          ← Giriş sayfasına dön
        </Link>
        <h1>Şifre Sıfırla</h1>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          E-posta adresinizi girin. Sıfırlama token'ı sunucu loglarına yazılacaktır (demo mod).
        </p>

        {status === 'success' ? (
          <div style={{
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '8px',
            padding: '16px',
            color: '#4ade80',
          }}>
            <p>✅ {message}</p>
            <p style={{ marginTop: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
              Token sunucu konsoluna yazıldı. Token'ı kopyalayıp{' '}
              <Link to="/reset-password" style={{ color: '#60a5fa' }}>
                şifre sıfırlama sayfasına
              </Link>{' '}
              gidin.
            </p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {status === 'error' && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                color: '#f87171',
                fontSize: '0.9rem',
              }}>
                {message}
              </div>
            )}
            <label>
              E-posta
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@mail.com"
                required
              />
            </label>
            <button
              type="submit"
              className="primary-button full-width"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Gönderiliyor...' : 'Sıfırlama Token\'ı Oluştur'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
