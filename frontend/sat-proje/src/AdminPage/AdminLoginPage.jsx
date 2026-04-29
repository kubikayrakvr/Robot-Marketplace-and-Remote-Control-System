import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminLogin } from './adminApi';
import './Admin.css';

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await adminLogin(email, password);
      navigate('/admin/robots');
    } catch (err) {
      setError(err.message || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        {/* Header */}
        <div className="admin-login-header">
          <div className="admin-login-icon">⚙️</div>
          <h1>Admin Paneli</h1>
          <p>Yönetim paneline erişmek için admin bilgilerinizi girin</p>
        </div>

        {/* Error */}
        {error && (
          <div className="admin-login-error">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Form */}
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <div className="admin-login-field">
            <label htmlFor="admin-email">E-posta</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="admin-login-field">
            <label htmlFor="admin-password">Şifre</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="admin-login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="admin-login-spinner" />
                Giriş yapılıyor...
              </>
            ) : (
              <>🔐 Giriş Yap</>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="admin-login-footer">
          <Link to="/login">← Kullanıcı girişine dön</Link>
        </div>
      </div>
    </div>
  );
}

export default AdminLoginPage;
