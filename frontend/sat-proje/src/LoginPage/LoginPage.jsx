import { Link, useNavigate } from 'react-router-dom';
import { saveMockSession } from '../auth/mockSession';

function LoginPage() {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  async function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      if (!response.ok) {
        throw new Error('Giriş başarısız');
      }

      const data = await response.json(); // { access_token: "...", token_type: "bearer" }

      // Token'ı sakla ve user bilgilerini çek
      await saveSessionWithUser(data.access_token);

      navigate('/user');
    } catch (error) {
      console.error(error);
      alert('Bir hata oluştu');
    }
  }

  async function saveSessionWithUser(token) {
    try {
      const userResponse = await fetch(`${API_URL}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (userResponse.ok) {
        const user = await userResponse.json();
        saveMockSession({ token, user });
      } else {
        // User çekilemezse sadece token ile sakla
        saveMockSession({ token, user: null });
      }
    } catch (error) {
      console.error('User bilgileri çekilemedi:', error);
      saveMockSession({ token, user: null });
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="back-link">
          &larr; Ana sayfaya dön
        </Link>
        <h1>Giriş yap</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            E-posta
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Şifre
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="primary-button full-width">
            Giriş yap
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;

