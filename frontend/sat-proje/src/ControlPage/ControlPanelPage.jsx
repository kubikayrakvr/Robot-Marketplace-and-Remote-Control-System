import { useNavigate } from 'react-router-dom';

function ControlPanelPage() {
  const navigate = useNavigate();

  return (
    <div className="control-station">
      <header className="control-header">
        <div className="control-title">
          <button className="back-btn" onClick={() => navigate('/user/kontrol')}>← Ayril</button>
          <h2>Robot Kontrol Paneli</h2>
        </div>
        <div className="connection-status connecting">
          <div className="status-dot"></div>
          ROS/Gazebo Entegrasyonu Bekleniyor
        </div>
      </header>

      <div className="control-grid">
        {/* Sol Panel: Kamera Akisi */}
        <div className="panel camera-panel">
          <div className="panel-header">Ana Kamera (Gazebo)</div>
          <div className="camera-feed">
            <div className="camera-loading">
              Gazebo simulasyon sunucusu baglantisi henuz aktif degil. 
              ROS 2 entegrasyonu tamamlandiginda canli goruntu burada goruntulenecektir.
            </div>
          </div>
        </div>

        {/* Sag Panel: Telemetri ve Kontrol */}
        <div className="panel side-panel">
          <div className="panel-section">
            <div className="panel-header">Telemetri Verileri</div>
            <div className="telemetry-grid">
              <div className="telemetry-box">
                <span className="t-label">HIZ (m/s)</span>
                <span className="t-value">—</span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">YON (°)</span>
                <span className="t-value">—</span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">YUKSEKLIK (m)</span>
                <span className="t-value">—</span>
              </div>
            </div>
          </div>

          <div className="panel-section control-section">
            <div className="panel-header">Manuel Surus (Joystick)</div>
            <div className="joystick-container">
              <button className="joy-btn joy-up" disabled>▲</button>
              <button className="joy-btn joy-left" disabled>◀</button>
              <div className="joy-center"></div>
              <button className="joy-btn joy-right" disabled>▶</button>
              <button className="joy-btn joy-down" disabled>▼</button>
            </div>
          </div>

          <div className="panel-section action-section">
            <button className="danger-button full-width" disabled>ACIL DURDURMA (E-STOP)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlPanelPage;
