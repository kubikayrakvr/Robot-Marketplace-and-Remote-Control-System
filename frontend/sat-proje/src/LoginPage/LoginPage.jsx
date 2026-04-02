import { Link, useNavigate } from 'react-router-dom';
import { saveMockSession } from '../auth/mockSession';

function LoginPage() {
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();

    // Backend baglanana kadar dummy session.
    saveMockSession({
      id: 1,
      fullName: 'Altan Turan',
      email: 'altan@example.com',
    });

    navigate('/user');
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

