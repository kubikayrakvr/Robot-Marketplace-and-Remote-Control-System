import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearMockSession, getMockSession } from '../auth/mockSession';

function UserPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchUser = async () => {
      const session = getMockSession();
      if (!session || !session.token) {
        navigate('/login');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/users/me`, {
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          // Session'ı güncelle
          session.user = userData;
          localStorage.setItem('satproje.session', JSON.stringify(session));
        } else if (response.status === 401) {
          // Token geçersiz, login'e yönlendir
          clearMockSession();
          navigate('/login');
        } else {
          console.error('User bilgileri alınamadı');
        }
      } catch (error) {
        console.error('Fetch hatası:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate, API_URL]);

  if (loading) {
    return <div>Yükleniyor...</div>;
  }

  if (!user) {
    return <div>Kullanıcı bilgileri yüklenemedi.</div>;
  }

  const actionCards = [
    { key: 'store', title: 'Magaza', subtitle: 'Yeni robotlari kesfet, teknik detaylari incele, satin alma adimina gec.', icon: '🛒' },
    { key: 'robots', title: 'Robotlarim', subtitle: 'Satin aldigin robotlari gor ve aktivasyon kodu ile etkinlestir.', icon: '🤖' },
    { key: 'control', title: 'Kontrol', subtitle: 'Gazebo sim ortamindaki robotuna baglanip uzaktan komut gonder.', icon: '🎮' },
    { key: 'profile', title: 'Bilgilerim', subtitle: 'Profil, e-posta, guvenlik ayarlari ve hesap durumunu yonet.', icon: '👤' },
  ];

  const firstName = user.username?.split(' ')[0] ?? 'Kullanıcı';

  function handleLogout() {
    clearMockSession();
    navigate('/login');
  }

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Kullanici Paneli</p>
            <h1>Hos geldiniz, {firstName}</h1>
            <p className="user-subtitle">
              Robot ekosistemine baglisin. Simdi robot satin alabilir, etkinlestirip kontrol paneline gecebilirsin.
            </p>
          </div>
          <div className="user-meta">
            <div className="avatar">{firstName.slice(0, 1).toUpperCase()}</div>
            <button type="button" className="secondary-button" onClick={handleLogout}>
              Cikis yap
            </button>
          </div>
        </header>

        <section className="user-grid">
          {actionCards.map((item) => (
            <button key={item.key} type="button" className="panel-card">
              <span className="panel-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="panel-title">{item.title}</span>
              <span className="panel-subtitle">{item.subtitle}</span>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}

export default UserPage;

