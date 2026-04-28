import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saveMockSession } from '../auth/mockSession';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(event.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      // 1) Login – get access_token
      const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        const errData = await loginRes.json().catch(() => ({}));
        let errorMessage = 'Giriş başarısız';
        if (errData.detail) {
          if (Array.isArray(errData.detail)) {
            errorMessage = errData.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ');
          } else {
            errorMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        }
        throw new Error(errorMessage);
      }

      const { access_token } = await loginRes.json();

      // 2) Fetch user info with the token
      const meRes = await fetch(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!meRes.ok) {
        throw new Error('Kullanıcı bilgileri alınamadı');
      }

      const user = await meRes.json(); // { id, email, username, is_admin }

      // 3) Save session
      saveMockSession({ access_token, user });

      navigate('/user');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="back-link">
          &larr; Ana sayfaya dön
        </Link>
        <h1>Giriş yap</h1>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '12px',
            color: '#f87171',
            fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            E-posta
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Şifre
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="primary-button full-width" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
          </button>
        </form>
        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: '1rem' }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Yönetici misiniz?</p>
          <Link to="/admin/robots" className="secondary-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            ⚙️ Admin Paneline Git
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
