
import '../roslib.min.js';
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';
import { 
  claimRosRobot, 
  heartbeatRosRobot, 
  releaseRosRobot,
  getRosStreamUrl 
} from '../api/rosApi';

const ROSBRIDGE_URL = 'ws://49.13.13.48:9090';

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
  
  const heartbeatTimer = useRef(null);
  const rosRef = useRef(null);
  const cmdVelRef = useRef(null);
  const hbRosRef = useRef(null);
  const hbRosTimer = useRef(null);
  const tokenRef = useRef(null);

  const sendCommand = (command) => {
    const vel = { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } };

    if (command === 'FORWARD')  vel.linear.x  =  1.0;
    if (command === 'BACKWARD') vel.linear.x  = -1.0;
    if (command === 'LEFT')     vel.angular.z =  1.5;
    if (command === 'RIGHT')    vel.angular.z = -1.5;

    if (cmdVelRef.current && tokenRef.current) {
      cmdVelRef.current.publish(new window.ROSLIB.Message({
        token: tokenRef.current,
        command: vel,
      }));
    }
  };

  useEffect(() => {
    if (!rosRobotId) {
      setError('Bu robot için tanımlı bir ROS ID bulunamadı.');
      return;
    }

    let isMounted = true;
    let currentToken = null;
    const ns = rosRobotId.toLowerCase().replace('rob-', 'rob');

    async function connectToRobot() {
      try {
        const { token } = await claimRosRobot(rosRobotId);
        if (!isMounted) {
          releaseRosRobot(rosRobotId, token).catch(() => {});
          return;
        }
        
        currentToken = token;
        tokenRef.current = token;
        setSessionToken(token);

        // FastAPI heartbeat (session TTL)
        heartbeatTimer.current = setInterval(() => {
          heartbeatRosRobot(rosRobotId, token).catch(err => {
            console.error('FastAPI heartbeat error', err);
          });
        }, 10000);

        // roslibjs rosbridge bağlantısı
        const ros = new window.ROSLIB.Ros({ url: ROSBRIDGE_URL });
        rosRef.current = ros;

        ros.on('connection', () => {
          if (!isMounted) return;
          setStatus('Bağlandı');
          console.log('[ROS] rosbridge bağlandı');

          // Komut topic'i
          cmdVelRef.current = new window.ROSLIB.Topic({
            ros,
            name: `/${ns}/cmd_vel_web`,
            messageType: 'web_ros_custom_msgs/AuthorizedTwist',
          });

          // Heartbeat topic'i (~3Hz)
          hbRosRef.current = new window.ROSLIB.Topic({
            ros,
            name: `/${ns}/session/heartbeat`,
            messageType: 'std_msgs/String',
          });

          hbRosTimer.current = setInterval(() => {
            if (hbRosRef.current && tokenRef.current) {
              hbRosRef.current.publish(new window.ROSLIB.Message({ data: tokenRef.current }));
            }
          }, 333);

          // Odom telemetrisi
          const odomTopic = new window.ROSLIB.Topic({
            ros,
            name: `/${ns}/odom`,
            messageType: 'nav_msgs/Odometry',
          });

          odomTopic.subscribe((msg) => {
            setTelemetry(prev => ({
              ...prev,
              x: parseFloat(msg.pose.pose.position.x.toFixed(3)),
              y: parseFloat(msg.pose.pose.position.y.toFixed(3)),
            }));
          });

          // IMU telemetrisi
          const imuTopic = new window.ROSLIB.Topic({
            ros,
            name: `/${ns}/imu`,
            messageType: 'sensor_msgs/Imu',
          });

          imuTopic.subscribe((msg) => {
            setTelemetry(prev => ({
              ...prev,
              gz: parseFloat(msg.angular_velocity.z.toFixed(3)),
            }));
          });
        });

        ros.on('error', (err) => {
          console.error('[ROS] rosbridge hata:', err);
          if (isMounted) setStatus('ROS Bağlantı Hatası');
        });

        ros.on('close', () => {
          if (isMounted) setStatus('Bağlantı kesildi');
        });

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
      if (hbRosTimer.current) clearInterval(hbRosTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (rosRef.current) rosRef.current.close();
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

  const isConnected = status === 'Bağlandı';

  return (
    <div className="control-station">
      <header className="control-header">
        <div className="control-title">
          <button className="back-btn" onClick={() => navigate('/user/kontrol')}>← Ayrıl</button>
          <h2>{robot?.nickname || robot?.name || 'Robot'} Kontrol Paneli</h2>
        </div>
        <div className={`connection-status ${isConnected ? 'connected' : 'connecting'}`}>
          <div
            className="status-dot"
            style={{ backgroundColor: isConnected ? '#4ade80' : '#f59e0b' }}
          ></div>
          {status}
        </div>
      </header>

      <div className="control-grid">
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
                disabled={!isConnected}
                onMouseDown={() => sendCommand('FORWARD')}
                onMouseUp={() => sendCommand('STOP')}
              >▲</button>
              <button
                className="joy-btn joy-left"
                disabled={!isConnected}
                onMouseDown={() => sendCommand('LEFT')}
                onMouseUp={() => sendCommand('STOP')}
              >◀</button>
              <div className="joy-center"></div>
              <button
                className="joy-btn joy-right"
                disabled={!isConnected}
                onMouseDown={() => sendCommand('RIGHT')}
                onMouseUp={() => sendCommand('STOP')}
              >▶</button>
              <button
                className="joy-btn joy-down"
                disabled={!isConnected}
                onMouseDown={() => sendCommand('BACKWARD')}
                onMouseUp={() => sendCommand('STOP')}
              >▼</button>
            </div>
          </div>

          <div className="panel-section action-section">
            <button
              className="danger-button full-width"
              disabled={!isConnected}
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
