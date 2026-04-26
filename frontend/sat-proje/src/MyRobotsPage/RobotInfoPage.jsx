import { useParams, useNavigate } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';

function RobotInfoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ownedRobots } = useRobots();

  const robot = ownedRobots.find((r) => r.instanceId === id);

  if (!robot) {
    return (
      <div className="user-page">
        <div className="user-shell">
          <h2>Robot bulunamadi.</h2>
          <button className="secondary-button" onClick={() => navigate('/user/robotlarim')}>Geri Don</button>
        </div>
      </div>
    );
  }

  // Placeholder veriler
  const batteryLevel = Math.floor(Math.random() * 40) + 60; // 60-100 arasi salla
  const signalStrength = 'Mukemmel';

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Durum Paneli</p>
            <h1>{robot.name}</h1>
            <p className="user-subtitle">
              Seri No: {robot.serialNumber}
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
            <div className="info-icon">{robot.icon}</div>
            <div className="info-stats">
              <div className="stat-box">
                <span className="stat-label">Batarya</span>
                <span className="stat-value">{batteryLevel}%</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Sinyal</span>
                <span className="stat-value">{signalStrength}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Durum</span>
                <span className="stat-value text-green">Cevrimici</span>
              </div>
            </div>
            <p className="info-desc">{robot.description}</p>
            <div className="info-actions">
              <button className="primary-button" onClick={() => alert('Simulasyona baglaniliyor... (Placeholder)')}>
                Simulasyona Baglan
              </button>
              <button className="secondary-button" onClick={() => alert('Yazilim guncelleniyor... (Placeholder)')}>
                Yazilimi Guncelle
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default RobotInfoPage;
