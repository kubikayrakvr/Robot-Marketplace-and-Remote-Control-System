import RegisterForm from './RegisterForm';
import { Link, useNavigate } from 'react-router-dom';
import { saveMockSession } from '../auth/mockSession';

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

  // basit kontrol
  if (password !== passwordConfirm) {
    alert('Şifreler eşleşmiyor');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        username: fullName, // backend username istiyor
        password: password,
      }),
    });

    if (!response.ok) {
      throw new Error('Kayıt başarısız');
    }

    const data = await response.json();

    // örnek: backend user döndüyse
    saveMockSession(data);

    navigate('/user');
  } catch (error) {
    console.error(error);
    alert('Bir hata oluştu');
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