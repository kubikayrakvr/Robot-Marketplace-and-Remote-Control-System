import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';

function ControlPanelPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ownedRobots } = useRobots();

  const [isConnected, setIsConnected] = useState(false);
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    heading: 0,
    altitude: 0,
  });

  const robot = ownedRobots.find((r) => r.instanceId === id);

  useEffect(() => {
    // Burada ileride gercek bir WebSocket veya ROS/Gazebo connection kurulacak.
    // Simdilik dummy bir baglanti simule ediyoruz.
    const timer = setTimeout(() => {
      setIsConnected(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!robot || robot.status !== 'active') {
    return (
      <div className="user-page">
        <div className="user-shell">
          <h2>Gecerli robot bulunamadi veya robot henuz aktif degil.</h2>
          <button className="secondary-button" onClick={() => navigate('/user/kontrol')}>Geri Don</button>
        </div>
      </div>
    );
  }

  // Dummy joystick handler
  const handleDirection = (dir) => {
    if (!isConnected) return;
    console.log(`Hareket komutu gonderildi: ${dir}`);
    // Ileride burada servera komut gonderilecek
  };

  return (
    <div className="control-station">
      <header className="control-header">
        <div className="control-title">
          <button className="back-btn" onClick={() => navigate('/user/kontrol')}>← Ayril</button>
          <h2>{robot.name} <span>[{robot.serialNumber}]</span></h2>
        </div>
        <div className={`connection-status ${isConnected ? 'connected' : 'connecting'}`}>
          <div className="status-dot"></div>
          {isConnected ? 'Gazebo Sunucusuna Bagli' : 'Baglanti Kuruluyor...'}
        </div>
      </header>

      <div className="control-grid">
        {/* Sol Panel: Kamera Akisi */}
        <div className="panel camera-panel">
          <div className="panel-header">Ana Kamera (Gazebo)</div>
          <div className="camera-feed">
            {isConnected ? (
              <div className="camera-placeholder">
                <span className="camera-icon">📷</span>
                <p>Canli Yayin Aktif</p>
                <div className="feed-overlay">REC</div>
              </div>
            ) : (
              <div className="camera-loading">Sinyal Bekleniyor...</div>
            )}
          </div>
        </div>

        {/* Sag Panel: Telemetri ve Kontrol */}
        <div className="panel side-panel">
          <div className="panel-section">
            <div className="panel-header">Telemetri Verileri</div>
            <div className="telemetry-grid">
              <div className="telemetry-box">
                <span className="t-label">HIZ (m/s)</span>
                <span className="t-value">{telemetry.speed.toFixed(1)}</span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">YON (°)</span>
                <span className="t-value">{telemetry.heading}</span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">YUKSEKLIK (m)</span>
                <span className="t-value">{telemetry.altitude.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div className="panel-section control-section">
            <div className="panel-header">Manuel Surus (Joystick)</div>
            <div className="joystick-container">
              <button
                className="joy-btn joy-up"
                onMouseDown={() => handleDirection('FORWARD')}
              >▲</button>
              <button
                className="joy-btn joy-left"
                onMouseDown={() => handleDirection('LEFT')}
              >◀</button>
              <div className="joy-center"></div>
              <button
                className="joy-btn joy-right"
                onMouseDown={() => handleDirection('RIGHT')}
              >▶</button>
              <button
                className="joy-btn joy-down"
                onMouseDown={() => handleDirection('BACKWARD')}
              >▼</button>
            </div>
          </div>
          
          <div className="panel-section action-section">
             <button className="danger-button full-width">ACIL DURDURMA (E-STOP)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlPanelPage;
