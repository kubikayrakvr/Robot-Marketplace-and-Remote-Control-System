import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearMockSession, getMockSession } from '../auth/mockSession';

function UserPage() {
  const navigate = useNavigate();
  const session = useMemo(() => getMockSession(), []);
  const user = session?.user ?? { username: 'Kullanıcı', email: '' };

  const actionCards = [
    { key: 'store', title: 'Magaza', subtitle: 'Yeni robotlari kesfet, teknik detaylari incele, satin alma adimina gec.', icon: '🛒' },
    { key: 'robots', title: 'Robotlarim', subtitle: 'Satin aldigin robotlari gor ve aktivasyon kodu ile etkinlestir.', icon: '🤖' },
    { key: 'control', title: 'Kontrol', subtitle: 'Gazebo sim ortamindaki robotuna baglanip uzaktan komut gonder.', icon: '🎮' },
    { key: 'profile', title: 'Bilgilerim', subtitle: 'Profil, e-posta, guvenlik ayarlari ve hesap durumunu yonet.', icon: '👤' },
  ];

  const displayName = user.username ?? 'Kullanıcı';

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
            <h1>Hos geldiniz, {displayName}</h1>
            <p className="user-subtitle">
              Robot ekosistemine baglisin. Simdi robot satin alabilir, etkinlestirip kontrol paneline gecebilirsin.
            </p>
          </div>
          <div className="user-meta">
            <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
            <button type="button" className="secondary-button" onClick={handleLogout}>
              Cikis yap
            </button>
          </div>
        </header>

        <section className="user-grid">
          {actionCards.map((item) => (
            <button
              key={item.key}
              type="button"
              className="panel-card"
              onClick={() => {
                if (item.key === 'store') {
                  navigate('/user/shop');
                } else if (item.key === 'robots') {
                  navigate('/user/robotlarim');
                } else if (item.key === 'control') {
                  navigate('/user/kontrol');
                }
              }}
            >
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

