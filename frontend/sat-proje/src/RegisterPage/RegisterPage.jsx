import RegisterForm from './RegisterForm';
import { Link, useNavigate } from 'react-router-dom';
import { saveSession } from '../auth/session';

function RegisterPage() {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  async function handleRegisterSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);

    const fullName = formData.get('fullName');
    const email = formData.get('email');
    const password = formData.get('password');
    const passwordConfirm = formData.get('passwordConfirm');
    const securityQuestion = formData.get('securityQuestion');
    const securityAnswer = formData.get('securityAnswer');

    // basit kontrol
    if (password !== passwordConfirm) {
      alert('Şifreler eşleşmiyor');
      return;
    }

    try {
      // 1) Register
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          username: fullName, // backend username istiyor
          password: password,
          security_question: securityQuestion,
          security_answer: securityAnswer,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let errorMessage = 'Kayıt başarısız';
        if (errData.detail) {
          if (Array.isArray(errData.detail)) {
            errorMessage = errData.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ');
          } else {
            errorMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        }
        throw new Error(errorMessage);
      }

      // 2) Auto-login after register
      const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        // Kayıt oldu ama login olamadı, login sayfasına yönlendir
        navigate('/login');
        return;
      }

      const { access_token } = await loginRes.json();

      // 3) Fetch user info
      const meRes = await fetch(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!meRes.ok) {
        navigate('/login');
        return;
      }

      const user = await meRes.json();

      saveSession({ access_token, user });
      navigate('/user');
    } catch (error) {
      console.error(error);
      alert(error.message || 'Bir hata oluştu');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="back-link">
          &larr; Ana sayfaya dön
        </Link>
        <h1>Kayıt ol</h1>
        <RegisterForm onSubmit={handleRegisterSubmit} />
      </div>
    </div>
  );
}

export default RegisterPage;