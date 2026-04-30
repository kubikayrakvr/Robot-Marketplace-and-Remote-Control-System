import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';
import { 
  claimRosRobot, 
  heartbeatRosRobot, 
  releaseRosRobot, 
  getRosWebSocketUrl, 
  getRosStreamUrl 
} from '../api/rosApi';

function ControlPanelPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { ownedRobots } = useRobots();
  
  const robot = ownedRobots.find((r) => r.instanceId === id);
  const rosRobotId = robot?.rosRobotId;

  const [sessionToken, setSessionToken] = useState(null);
  const [status, setStatus] = useState('Bağlanıyor...');
  const [telemetry, setTelemetry] = useState({ x: 0, y: 0, gz: 0 });
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const heartbeatTimer = useRef(null);

  const sendCommand = (command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command }));
    }
  };

  useEffect(() => {
    if (!rosRobotId) {
      setError('Bu robot için tanımlı bir ROS ID bulunamadı.');
      return;
    }

    let isMounted = true;
    let currentToken = null;

    async function connectToRobot() {
      try {
        const { token } = await claimRosRobot(rosRobotId);
        if (!isMounted) {
          releaseRosRobot(rosRobotId, token).catch(() => {});
          return;
        }
        
        currentToken = token;
        setSessionToken(token);
        setStatus('Bağlandı');

        heartbeatTimer.current = setInterval(() => {
          heartbeatRosRobot(rosRobotId, token).catch(err => {
            console.error('Heartbeat error', err);
          });
        }, 10000);

        const wsUrl = getRosWebSocketUrl(rosRobotId, token);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'odom') {
              setTelemetry(prev => ({ ...prev, x: data.x, y: data.y }));
            } else if (data.type === 'imu') {
              setTelemetry(prev => ({ ...prev, gz: data.gz }));
            }
          } catch (e) {
            console.error("WS error", e);
          }
        };

        wsRef.current.onclose = () => {
          if (isMounted) {
            setStatus('Bağlantı kesildi');
          }
        };

      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Robota bağlanılamadı. Robot kullanımda olabilir.');
          setStatus('Hata');
        }
      }
    }

    connectToRobot();

    return () => {
      isMounted = false;
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (wsRef.current) wsRef.current.close();
      if (currentToken) {
        releaseRosRobot(rosRobotId, currentToken).catch(() => {});
      }
    };
  }, [rosRobotId]);

  if (error) {
    return (
      <div className="control-station" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#2a2a2a', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
          <h2>Bağlantı Hatası</h2>
          <p>{error}</p>
          <button
            className="secondary-button"
            style={{ marginTop: '1rem' }}
            onClick={() => navigate('/user/kontrol')}
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="control-station">
      <header className="control-header">
        <div className="control-title">
          <button className="back-btn" onClick={() => navigate('/user/kontrol')}>← Ayrıl</button>
          <h2>{robot?.nickname || robot?.name || 'Robot'} Kontrol Paneli</h2>
        </div>
        <div className={`connection-status ${status === 'Bağlandı' ? 'connected' : 'connecting'}`}>
          <div
            className="status-dot"
            style={{ backgroundColor: status === 'Bağlandı' ? '#4ade80' : '#f59e0b' }}
          ></div>
          {status}
        </div>
      </header>

      <div className="control-grid">
        {/* Sol Panel: Kamera Akışı */}
        <div className="panel camera-panel">
          <div className="panel-header">Ana Kamera (Gazebo)</div>
          <div className="camera-feed" style={{ padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
            {sessionToken ? (
              <img
                src={getRosStreamUrl(rosRobotId, sessionToken)}
                alt="Robot Kamera Akışı"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
            ) : (
              <div className="camera-loading">Video akışı bekleniyor...</div>
            )}
            <div style={{ display: 'none', color: '#888' }}>Kamera bağlantısı kurulamadı veya yayın yok.</div>
          </div>
        </div>

        {/* Sağ Panel: Telemetri ve Kontrol */}
        <div className="panel side-panel">
          <div className="panel-section">
            <div className="panel-header">Telemetri Verileri</div>
            <div className="telemetry-grid">
              <div className="telemetry-box">
                <span className="t-label">X (m)</span>
                <span className="t-value">{telemetry.x.toFixed(3)}</span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">Y (m)</span>
                <span className="t-value">{telemetry.y.toFixed(3)}</span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">Z (rad/s)</span>
                <span className="t-value">{telemetry.gz.toFixed(3)}</span>
              </div>
            </div>
          </div>

          <div className="panel-section control-section">
            <div className="panel-header">Manuel Sürüş (Joystick)</div>
            <div className="joystick-container">
              <button
                className="joy-btn joy-up"
                disabled={status !== 'Bağlandı'}
                onMouseDown={() => sendCommand('FORWARD')}
                onMouseUp={() => sendCommand('STOP')}
              >▲</button>
              <button
                className="joy-btn joy-left"
                disabled={status !== 'Bağlandı'}
                onMouseDown={() => sendCommand('LEFT')}
                onMouseUp={() => sendCommand('STOP')}
              >◀</button>
              <div className="joy-center"></div>
              <button
                className="joy-btn joy-right"
                disabled={status !== 'Bağlandı'}
                onMouseDown={() => sendCommand('RIGHT')}
                onMouseUp={() => sendCommand('STOP')}
              >▶</button>
              <button
                className="joy-btn joy-down"
                disabled={status !== 'Bağlandı'}
                onMouseDown={() => sendCommand('BACKWARD')}
                onMouseUp={() => sendCommand('STOP')}
              >▼</button>
            </div>
          </div>

          <div className="panel-section action-section">
            <button
              className="danger-button full-width"
              disabled={status !== 'Bağlandı'}
              onClick={() => sendCommand('ESTOP')}
            >
              ACİL DURDURMA (E-STOP)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlPanelPage;
