import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';

function ActivateRobotPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ownedRobots, activateRobot } = useRobots();
  const [serial, setSerial] = useState('');

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

  const handleActivate = (e) => {
    e.preventDefault();
    if (serial.trim()) {
      activateRobot(id, serial.trim());
      navigate(`/user/robotlarim/bilgi/${id}`);
    }
  };

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Aktivasyon</p>
            <h1>Robot Tanimlama</h1>
            <p className="user-subtitle">
              {robot.name} model robotunuzu kullanmaya baslamak icin kutusundan cikan seri numarasini girin.
            </p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user/robotlarim')}
            >
              Iptal
            </button>
          </div>
        </header>

        <section className="checkout-content">
          <div className="checkout-card activation-card">
            <div className="activation-icon">{robot.icon}</div>
            <h3>{robot.name}</h3>
            <form className="auth-form" onSubmit={handleActivate}>
              <label>
                Seri Numarasi
                <input
                  type="text"
                  placeholder="Orn: SN-1234-5678"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="primary-button full-width">
                Aktiflestir
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ActivateRobotPage;
