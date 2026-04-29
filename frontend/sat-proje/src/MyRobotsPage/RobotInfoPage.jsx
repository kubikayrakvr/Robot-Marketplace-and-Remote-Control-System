import { useNavigate } from 'react-router-dom';

function RobotInfoPage() {
  const navigate = useNavigate();

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Durum Paneli</p>
            <h1>Robot Durumu</h1>
            <p className="user-subtitle">
              Robot durum bilgileri, ROS/Gazebo entegrasyonu tamamlandiginda burada gosterilecektir.
            </p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user/robotlarim')}
            >
              Robotlara Don
            </button>
          </div>
        </header>

        <section className="robot-info-content">
          <div className="info-card">
            <div className="info-icon">🤖</div>
            <div className="info-stats">
              <div className="stat-box">
                <span className="stat-label">Durum</span>
                <span className="stat-value">Bekleniyor</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Baglanti</span>
                <span className="stat-value">Cevrimdisi</span>
              </div>
            </div>
            <p className="info-desc">
              Robotunuzun detayli durum bilgisi, Gazebo simulasyon sunucusu ve ROS 2 entegrasyonu tamamlandiginda burada canli olarak goruntulenecektir.
            </p>
            <div className="info-actions">
              <button className="primary-button" onClick={() => navigate('/user/kontrol')}>
                Kontrol Paneline Git
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default RobotInfoPage;
