import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirm) {
      setStatus('error');
      setMessage('Şifreler eşleşmiyor.');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Bir hata oluştu');
      }

      setStatus('success');
      setMessage(data.message);
      setTimeout(() => navigate('/login'), 2000);
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
        <h1>Yeni Şifre Belirle</h1>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Sunucu konsolundaki token'ı ve yeni şifrenizi girin.
        </p>

        {status === 'success' ? (
          <div style={{
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '8px',
            padding: '16px',
            color: '#4ade80',
          }}>
            ✅ {message} Giriş sayfasına yönlendiriliyorsunuz...
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
              Sıfırlama Token'ı
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Sunucu konsolundan kopyalayın"
                required
              />
            </label>
            <label>
              Yeni Şifre
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Yeni şifreniz"
                required
                minLength={6}
              />
            </label>
            <label>
              Şifre Tekrar
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Şifrenizi tekrar girin"
                required
              />
            </label>
            <button
              type="submit"
              className="primary-button full-width"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;
