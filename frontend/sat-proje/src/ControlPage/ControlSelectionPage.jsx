import { useNavigate } from 'react-router-dom';

function ControlSelectionPage() {
  const navigate = useNavigate();

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Simulasyon Baglantisi</p>
            <h1>Kontrol Paneli</h1>
            <p className="user-subtitle">
              Gazebo sunucusuna baglanmak ve kontrol etmek icin bu bolum kullanilacaktir.
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

        <section className="inventory-content">
          <div className="empty-cart">
            <div className="empty-icon">🎮</div>
            <h2>ROS/Gazebo Entegrasyonu Bekleniyor</h2>
            <p>
              Robotlarinizi uzaktan kontrol edebilmek icin Gazebo simulasyon sunucusu ve ROS 2 entegrasyonunun tamamlanmasi gerekmektedir. 
              Bu ozellik yakin zamanda aktif olacaktir.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate('/user/robotlarim')}
            >
              Robotlarima Git
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ControlSelectionPage;
