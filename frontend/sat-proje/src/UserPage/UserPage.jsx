import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearMockSession, getMockSession } from '../auth/mockSession';

function UserPage() {
  const navigate = useNavigate();
  const session = useMemo(() => getMockSession(), []);
  const user = session?.user ?? { fullName: 'Altan', email: 'altan@example.com' };

  const actionCards = [
    { key: 'store', title: 'Magaza', subtitle: 'Yeni robotlari kesfet, teknik detaylari incele, satin alma adimina gec.', icon: '🛒' },
    { key: 'robots', title: 'Robotlarim', subtitle: 'Satin aldigin robotlari gor ve aktivasyon kodu ile etkinlestir.', icon: '🤖' },
    { key: 'control', title: 'Kontrol', subtitle: 'Gazebo sim ortamindaki robotuna baglanip uzaktan komut gonder.', icon: '🎮' },
    { key: 'profile', title: 'Bilgilerim', subtitle: 'Profil, e-posta, guvenlik ayarlari ve hesap durumunu yonet.', icon: '👤' },
  ];

  const firstName = user.fullName?.split(' ')[0] ?? 'Altan';

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

