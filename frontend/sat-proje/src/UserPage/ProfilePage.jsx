import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession, saveSession } from '../auth/session';
import { updateMyProfile } from '../api/userApi';

function ProfilePage() {
  const navigate = useNavigate();
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? { username: '', email: '' };

  const [formData, setFormData] = useState({
    username: user.username || '',
    email: user.email || '',
    old_password: '',
    new_password: '',
    security_question: user.security_question || 'İlk evcil hayvanınızın adı nedir?',
    security_answer: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const dataToUpdate = {};
    if (formData.username !== user.username) dataToUpdate.username = formData.username;
    if (formData.email !== user.email) dataToUpdate.email = formData.email;
    if (formData.new_password) {
      dataToUpdate.new_password = formData.new_password;
      dataToUpdate.old_password = formData.old_password;
    }
    if (formData.security_answer) {
      dataToUpdate.security_question = formData.security_question;
      dataToUpdate.security_answer = formData.security_answer;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      setError('Herhangi bir degisiklik yapmadiniz.');
      setLoading(false);
      return;
    }

    // E-posta uyarisi
    if (dataToUpdate.email) {
      const confirmEmail = window.confirm(
        'E-posta adresinizi degistirirseniz hesabiniz aktivasyon maili onaylanana kadar pasif duruma alinacaktir. Onayliyor musunuz?'
      );
      if (!confirmEmail) {
        setLoading(false);
        return;
      }
    }

    try {
      const updatedUser = await updateMyProfile(dataToUpdate);
      
      // Update local session data with new user info
      if (session) {
        saveSession({ access_token: session.token, user: updatedUser });
      }

      setSuccess('Profil bilgileriniz basariyla guncellendi.');
      // Clear sensitive fields
      setFormData((prev) => ({ ...prev, old_password: '', new_password: '', security_answer: '' }));

      // If email changed, they might be logged out or need re-login, handle gracefully
      if (dataToUpdate.email) {
        setSuccess('E-posta adresiniz degistirildi. Hesabiniz pasif duruma gecmis olabilir. Yeniden giris yapmaniz gerekebilir.');
      }
    } catch (err) {
      setError(err.message || 'Guncelleme basarisiz oldu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Hesap Ayarlari</p>
            <h1>Bilgilerim</h1>
            <p className="user-subtitle">
              Profil bilgilerinizi ve guvenlik ayarlarinizi buradan guncelleyebilirsiniz.
            </p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user')}
            >
              Panele Don
            </button>
          </div>
        </header>

        <section className="checkout-content">
          <div className="checkout-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h3>Profil Duzenle</h3>

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

            {success && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                color: '#4ade80',
                fontSize: '0.9rem',
              }}>
                {success}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                Kullanici Adi
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                E-posta Adresi
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </label>

              <div style={{ margin: '24px 0 16px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}></div>
              <h4 style={{ margin: '0 0 16px', color: '#e2e8f0' }}>Sifre Degistir</h4>

              <label>
                Mevcut Sifre
                <input
                  type="password"
                  name="old_password"
                  value={formData.old_password}
                  onChange={handleChange}
                  placeholder="Sifre degistirmeyecekseniz bos birakin"
                />
              </label>

              <label>
                Yeni Sifre
                <input
                  type="password"
                  name="new_password"
                  value={formData.new_password}
                  onChange={handleChange}
                  placeholder="En az 6 karakter"
                  minLength={6}
                />
              </label>

              <div style={{ margin: '24px 0 16px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}></div>
              <h4 style={{ margin: '0 0 8px', color: '#e2e8f0' }}>Güvenlik Sorusu</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '16px' }}>
                Şifrenizi unuttuğunuzda hesabınızı kurtarmak için kullanılır.
              </p>

              <label>
                Soru Seçin
                <select 
                  name="security_question" 
                  value={formData.security_question} 
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: '#020617', border: '1px solid #1e293b', color: '#fff', marginBottom: '1rem' }}
                >
                  <option value="İlk evcil hayvanınızın adı nedir?">İlk evcil hayvanınızın adı nedir?</option>
                  <option value="Annenizin kızlık soyadı nedir?">Annenizin kızlık soyadı nedir?</option>
                  <option value="Hangi şehirde doğdunuz?">Hangi şehirde doğdunuz?</option>
                  <option value="En sevdiğiniz çocukluk arkadaşınızın adı nedir?">En sevdiğiniz çocukluk arkadaşınızın adı nedir?</option>
                  <option value="İlk okulunuzun adı nedir?">İlk okulunuzun adı nedir?</option>
                </select>
              </label>

              <label>
                Cevap
                <input
                  type="text"
                  name="security_answer"
                  value={formData.security_answer}
                  onChange={handleChange}
                  placeholder={user.security_question ? "Degistirmek için yeni cevap girin" : "Güvenlik cevabınızı girin"}
                />
              </label>

              <button
                type="submit"
                className="primary-button full-width"
                disabled={loading}
              >
                {loading ? 'Guncelleniyor...' : 'Degisiklikleri Kaydet'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ProfilePage;
