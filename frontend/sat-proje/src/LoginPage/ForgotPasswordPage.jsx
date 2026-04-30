import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: Security Question
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/security-question/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Kullanıcı bulunamadı');
      
      setQuestion(data.security_question);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password-security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          security_answer: answer,
          new_password: newPassword
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Sıfırlama başarısız');
      
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>✅ Şifre Sıfırlandı</h1>
          <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.</p>
          <button className="primary-button full-width" onClick={() => navigate('/login')}>
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/login" className="back-link">
          ← Giriş sayfasına dön
        </Link>
        <h1>Şifre Sıfırla</h1>
        
        {error && (
          <div style={{ background: '#991b1b33', border: '1px solid #991b1b', color: '#f87171', padding: '12px', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {step === 1 ? (
          <form className="auth-form" onSubmit={handleEmailSubmit}>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Şifrenizi sıfırlamak için e-posta adresinizi girin.
            </p>
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
            <button type="submit" className="primary-button full-width" disabled={loading}>
              {loading ? 'Sorgulanıyor...' : 'Devam Et'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleResetSubmit}>
            <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Hesabınızı doğrulamak için aşağıdaki soruyu cevaplayın.
            </p>
            <div style={{ background: '#020617', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Güvenlik Sorusu</span>
              <strong style={{ color: '#fff' }}>{question}</strong>
            </div>
            
            <label>
              Cevap
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Cevabınızı girin"
                required
              />
            </label>
            
            <label style={{ marginTop: '1rem' }}>
              Yeni Şifre
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 6 karakter"
                minLength={6}
                required
              />
            </label>

            <button type="submit" className="primary-button full-width" disabled={loading} style={{ marginTop: '1.5rem' }}>
              {loading ? 'Sıfırlanıyor...' : 'Şifreyi Güncelle'}
            </button>
            <button type="button" className="secondary-button full-width" style={{ marginTop: '0.5rem' }} onClick={() => setStep(1)}>
              Geri
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
