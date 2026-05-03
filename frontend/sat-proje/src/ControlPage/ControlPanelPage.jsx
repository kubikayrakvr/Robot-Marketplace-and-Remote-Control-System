import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';
import {
  claimRosRobot,
  heartbeatRosRobot,
  releaseRosRobot,
  sendBeaconRelease,
  getRosStreamUrl,
  getRosWebSocketUrl,
  fetchRosRobotById,
} from '../api/rosApi';

const ROSBRIDGE_URL = 'ws://49.13.13.48:9090';
const PUBLISH_INTERVAL_MS = 66;      // ~15 Hz cmd_vel
const ROS_HB_INTERVAL_MS = 3000;
const API_HB_INTERVAL_MS = 10000;
const PING_INTERVAL_MS = 1000;
const POSE_STALE_MS = 2000;          // ground_truth → odom fallback threshold
const ODOM_STALE_MS = 10000;         // odom silent for this long → "Target Lost"
const WATCHDOG_TICK_MS = 1000;
const JOYSTICK_RADIUS = 75;
const RAD_TO_DEG = 180 / Math.PI;

function ControlPanelPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { ownedRobots } = useRobots();

  const robot = ownedRobots.find((r) => r.instanceId === id);
  const rosRobotId = robot?.rosRobotId;

  const [sessionToken, setSessionToken] = useState(null);
  const [status, setStatus] = useState('Bağlanıyor...');
  const [error, setError] = useState(null);

  // 🕒 HAREKETSİZLİK TAKİBİ İÇİN EKLENEN STATE VE REF
  const [showIdlePopup, setShowIdlePopup] = useState(false);
  const lastActivityRef = useRef(Date.now());

  const [sensors, setSensors] = useState(null);
  const [isStale, setIsStale] = useState(true);
  const [hasEverReceivedTelemetry, setHasEverReceivedTelemetry] = useState(false);
  const [isPoseStale, setIsPoseStale] = useState(true);

  // Camera retry key — incrementing this forces the <img> to remount and retry.
  const [cameraKey, setCameraKey] = useState(0);
  // Holds the active retry timer so we can cancel it on cleanup.
  const cameraTimerRef = useRef(null);

  // ── Telemetry state (relay-driven) ───────────────────────────────────
  const [odom, setOdom] = useState({ x: 0, y: 0, ts: 0 });
  const [pose, setPose] = useState({ wx: 0, wy: 0, heading: 0, ts: 0 });
  const [imu, setImu] = useState({ ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 });
  const [collision, setCollision] = useState(null);
  const [latency, setLatency] = useState(null);
  // Battery: live value comes via the synthetic battery node on /{ns}/battery_state.
  // We seed from the value the claim returned so the UI isn't blank on first paint.
  const [batteryPct, setBatteryPct] = useState(null);

  // ── Drive controls ───────────────────────────────────────────────────
  const [linSpeed, setLinSpeed] = useState(0.30);
  const [angSpeed, setAngSpeed] = useState(0.50);
  const [cmdVel, setCmdVel] = useState({ linear: 0, angular: 0 });

  // ── High-frequency refs (avoid render churn) ─────────────────────────
  const desiredVelRef = useRef({ linear: 0, angular: 0 });
  const pressedKeysRef = useRef(new Set());
  const linSpeedRef = useRef(linSpeed);
  const angSpeedRef = useRef(angSpeed);
  const joystickActiveRef = useRef(false);
  const tokenRef = useRef(null);

  // ── Connection refs ──────────────────────────────────────────────────
  const rosRef = useRef(null);          // roslibjs (publisher only)
  const wsRef = useRef(null);           // FastAPI relay (telemetry receive)
  const cmdVelRef = useRef(null);
  const hbRosRef = useRef(null);
  const pingTopicRef = useRef(null);

  // ── Timer refs ───────────────────────────────────────────────────────
  const heartbeatTimer = useRef(null);
  const hbRosTimer = useRef(null);
  const publishTimer = useRef(null);
  const pingTimer = useRef(null);
  const watchdogTimer = useRef(null);

  const lastOdomTsRef = useRef(0);
  const lastPoseTsRef = useRef(0);
  const wasStaleRef = useRef(false);

  // ── DOM refs ─────────────────────────────────────────────────────────
  const joystickZoneRef = useRef(null);
  const joystickKnobRef = useRef(null);
  const canvasRef = useRef(null);
  const radarLegendRef = useRef(null);
  const radarClosestRef = useRef(null);
  const latestScanRef = useRef(null);

  useEffect(() => { linSpeedRef.current = linSpeed; }, [linSpeed]);
  useEffect(() => { angSpeedRef.current = angSpeed; }, [angSpeed]);

  // ── Drive command helpers ────────────────────────────────────────────
  const setDesiredVel = useCallback((linear, angular) => {
    // 🕒 HAREKETSİZLİK TAKİBİ: Komut verildiği an zamanlayıcıyı sıfırla
    lastActivityRef.current = Date.now();
    
    desiredVelRef.current = { linear, angular };
    setCmdVel({ linear, angular });
  }, []);

  const emergencyStop = useCallback(() => {
    // 🕒 HAREKETSİZLİK TAKİBİ: Kullanıcı butona bastığı için aktiftir
    lastActivityRef.current = Date.now();

    pressedKeysRef.current.clear();
    desiredVelRef.current = { linear: 0, angular: 0 };
    setCmdVel({ linear: 0, angular: 0 });
    if (cmdVelRef.current && tokenRef.current) {
      cmdVelRef.current.publish(new window.ROSLIB.Message({
        token: tokenRef.current,
        command: { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } },
      }));
    }
  }, []);

  // 🕒 HAREKETSİZLİK TAKİBİ: Arka planda süreyi kontrol eden kontrolcü
  useEffect(() => {
    const idleInterval = setInterval(() => {
      // Sadece bağlantı varken ve popup kapalıyken kontrol et
      if (status === 'Bağlandı' && !showIdlePopup) {
        const secondsIdle = (Date.now() - lastActivityRef.current) / 1000;
        if (secondsIdle > 120) { // 2 dakika sınırı
          emergencyStop(); // Önce robotu durdur
          setShowIdlePopup(true);
        }
      }
    }, 5000); // 5 saniyede bir kontrol et

    return () => clearInterval(idleInterval);
  }, [status, showIdlePopup, emergencyStop]);

  const recomputeFromKeys = useCallback(() => {
    const keys = pressedKeysRef.current;
    const lin = linSpeedRef.current;
    const ang = angSpeedRef.current;
    let lx = 0, az = 0;
    if (keys.has('w')) lx += lin;
    if (keys.has('s')) lx -= lin;
    if (keys.has('a')) az += ang;
    if (keys.has('d')) az -= ang;
    setDesiredVel(lx, az);
  }, [setDesiredVel]);

  const dpadStart = useCallback((linear, angular) => setDesiredVel(linear, angular), [setDesiredVel]);
  const dpadStop = useCallback(() => setDesiredVel(0, 0), [setDesiredVel]);

  const drawRadar = useCallback(() => {
    const canvas = canvasRef.current;
    const scan = latestScanRef.current;
    if (!canvas || !scan) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 8;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.stroke();

    const ranges = scan.ranges || [];
    const scale = R / scan.range_max;
    let validCount = 0;
    let minRange = Infinity;

    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      if (!Number.isFinite(r) || r <= scan.range_min || r > scan.range_max) continue;
      validCount++;
      if (r < minRange) minRange = r;
      const angle = scan.angle_min + i * scan.angle_increment;
      const px = cx + Math.sin(angle) * r * scale;
      const py = cy - Math.cos(angle) * r * scale;
      const ratio = r / scan.range_max;
      ctx.fillStyle = `rgb(${Math.floor(255 * (1 - ratio))}, ${Math.floor(180 * ratio + 60)}, 60)`;
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    if (radarLegendRef.current) {
      radarLegendRef.current.textContent =
        `${validCount} pts · ${scan.range_max.toFixed(1)} m menzil`;
    }
    if (radarClosestRef.current) {
      radarClosestRef.current.textContent = Number.isFinite(minRange)
        ? `${minRange.toFixed(2)} m`
        : '—';
    }
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        emergencyStop();
        return;
      }
      if (!['w', 'a', 's', 'd'].includes(k)) return;
      if (e.repeat) return;
      e.preventDefault();
      pressedKeysRef.current.add(k);
      recomputeFromKeys();
    }
    function onKeyUp(e) {
      const k = e.key.toLowerCase();
      if (!['w', 'a', 's', 'd'].includes(k)) return;
      pressedKeysRef.current.delete(k);
      recomputeFromKeys();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [recomputeFromKeys, emergencyStop]);

  useEffect(() => {
    const zone = joystickZoneRef.current;
    const knob = joystickKnobRef.current;
    if (!zone || !knob) return;

    function clampedOffset(e) {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const src = e.touches ? e.touches[0] : e;
      let dx = src.clientX - cx;
      let dy = src.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > JOYSTICK_RADIUS) {
        dx = (dx / dist) * JOYSTICK_RADIUS;
        dy = (dy / dist) * JOYSTICK_RADIUS;
      }
      return { dx, dy };
    }

    function applyJoystick(e) {
      if (!joystickActiveRef.current) return;
      e.preventDefault();
      const { dx, dy } = clampedOffset(e);
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const lin = (-dy / JOYSTICK_RADIUS) * linSpeedRef.current;
      const ang = (-dx / JOYSTICK_RADIUS) * angSpeedRef.current;
      setDesiredVel(lin, ang);
    }

    function release() {
      if (!joystickActiveRef.current) return;
      joystickActiveRef.current = false;
      zone.classList.remove('active');
      knob.style.transform = 'translate(-50%, -50%)';
      setDesiredVel(0, 0);
    }

    function onDown(e) {
      joystickActiveRef.current = true;
      zone.classList.add('active');
      applyJoystick(e);
    }

    zone.addEventListener('mousedown', onDown);
    zone.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('mousemove', applyJoystick);
    document.addEventListener('touchmove', applyJoystick, { passive: false });
    document.addEventListener('mouseup', release);
    document.addEventListener('touchend', release);

    return () => {
      zone.removeEventListener('mousedown', onDown);
      zone.removeEventListener('touchstart', onDown);
      document.removeEventListener('mousemove', applyJoystick);
      document.removeEventListener('touchmove', applyJoystick);
      document.removeEventListener('mouseup', release);
      document.removeEventListener('touchend', release);
    };
  }, [setDesiredVel]);

  useEffect(() => {
    if (!sessionToken || !rosRobotId) return;
    const handler = () => sendBeaconRelease(rosRobotId, sessionToken);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sessionToken, rosRobotId]);

  useEffect(() => {
    if (!rosRobotId) return;

    let isMounted = true;
    let currentToken = null;
    let ns = null;

    async function connect() {
      try {
        const [claim, detail] = await Promise.all([
          claimRosRobot(rosRobotId),
          fetchRosRobotById(rosRobotId).catch(() => null),
        ]);
        const { token } = claim;
        ns = claim.namespace || (detail && detail.namespace);
        if (!ns) {
          throw new Error('Sunucu robot için bir namespace döndürmedi.');
        }

        if (!isMounted) {
          releaseRosRobot(rosRobotId, token).catch(() => {});
          return;
        }
        currentToken = token;
        tokenRef.current = token;
        setSessionToken(token);
        if (detail && Array.isArray(detail.sensors)) {
          setSensors(detail.sensors);
        }
        if (typeof claim.battery_pct === 'number') {
          setBatteryPct(claim.battery_pct);
        } else if (detail && typeof detail.battery_pct === 'number') {
          setBatteryPct(detail.battery_pct);
        }

        heartbeatTimer.current = setInterval(() => {
          heartbeatRosRobot(rosRobotId, token).catch(err => {
            if (err && (err.status === 403 || err.status === 404)) {
              console.error('[heartbeat] Session revoked:', err.status, err.message);
              [publishTimer, hbRosTimer, heartbeatTimer, pingTimer, watchdogTimer]
                .forEach((t) => {
                  if (t.current) { clearInterval(t.current); t.current = null; }
                });
              if (wsRef.current) {
                try { wsRef.current.close(); } catch { /* noop */ }
                wsRef.current = null;
              }
              setError(
                err.status === 403
                  ? 'Oturum sunucu tarafından iptal edildi (başka bir operatör devraldı veya token süresi doldu).'
                  : 'Oturum sunucu tarafında bulunamadı. Lütfen yeniden bağlanın.'
              );
            } else {
              console.error('FastAPI heartbeat error', err);
            }
          });
        }, API_HB_INTERVAL_MS);

        const ros = new window.ROSLIB.Ros({ url: ROSBRIDGE_URL });
        rosRef.current = ros;

        ros.on('connection', () => {
          if (!isMounted) return;
          console.log('[ROS] rosbridge bağlandı (publisher)');

          cmdVelRef.current = new window.ROSLIB.Topic({
            ros,
            name: `/${ns}/cmd_vel_web`,
            messageType: 'web_ros_custom_msgs/AuthorizedTwist',
          });

          hbRosRef.current = new window.ROSLIB.Topic({
            ros,
            name: `/${ns}/session/heartbeat`,
            messageType: 'std_msgs/String',
          });

          pingTopicRef.current = new window.ROSLIB.Topic({
            ros,
            name: `/${ns}/ping`,
            messageType: 'std_msgs/String',
          });

          hbRosTimer.current = setInterval(() => {
            if (hbRosRef.current && tokenRef.current) {
              hbRosRef.current.publish(new window.ROSLIB.Message({ data: tokenRef.current }));
            }
          }, ROS_HB_INTERVAL_MS);

          publishTimer.current = setInterval(() => {
            const last = lastOdomTsRef.current;
            if (last > 0 && Date.now() - last > ODOM_STALE_MS) return;

            const { linear, angular } = desiredVelRef.current;
            if (linear === 0 && angular === 0) return;
            if (!cmdVelRef.current || !tokenRef.current) return;
            cmdVelRef.current.publish(new window.ROSLIB.Message({
              token: tokenRef.current,
              command: {
                linear: { x: linear, y: 0, z: 0 },
                angular: { x: 0, y: 0, z: angular },
              },
            }));
          }, PUBLISH_INTERVAL_MS);

          pingTimer.current = setInterval(() => {
            if (pingTopicRef.current) {
              pingTopicRef.current.publish(new window.ROSLIB.Message({
                data: Date.now().toString(),
              }));
            }
          }, PING_INTERVAL_MS);
        });

        ros.on('error', (err) => {
          console.error('[ROS] rosbridge hata:', err);
          if (isMounted) setStatus('ROS Bağlantı Hatası');
        });

        ros.on('close', () => {
          if (isMounted) setStatus('Bağlantı kesildi');
        });

        const ws = new WebSocket(getRosWebSocketUrl(rosRobotId, token));
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setStatus('Bağlandı');
          console.log('[relay] FastAPI telemetry WS açıldı');

          watchdogTimer.current = setInterval(() => {
            const lastOdom = lastOdomTsRef.current;
            if (lastOdom > 0) {
              const stale = Date.now() - lastOdom > ODOM_STALE_MS;
              if (stale && !wasStaleRef.current) {
                emergencyStop();
              }
              wasStaleRef.current = stale;
              setIsStale(prev => (prev !== stale ? stale : prev));
            }
            const lastPose = lastPoseTsRef.current;
            if (lastPose > 0) {
              const stale = Date.now() - lastPose > POSE_STALE_MS;
              setIsPoseStale(prev => (prev !== stale ? stale : prev));
            }
          }, WATCHDOG_TICK_MS);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          let d;
          try { d = JSON.parse(event.data); } catch { return; }

          switch (d.type) {
            case 'odom':
              setOdom({ x: d.x, y: d.y, ts: Date.now() });
              lastOdomTsRef.current = Date.now();
              setIsStale(prev => (prev ? false : prev));
              setHasEverReceivedTelemetry(prev => prev || true);
              break;
            case 'pose':
              setPose({ wx: d.wx, wy: d.wy, heading: d.heading, ts: Date.now() });
              lastPoseTsRef.current = Date.now();
              setIsPoseStale(false);
              break;
            case 'imu':
              setImu({
                ax: d.ax, ay: d.ay, az: d.az,
                gx: d.gx, gy: d.gy, gz: d.gz,
              });
              break;
            case 'scan':
              latestScanRef.current = d;
              drawRadar();
              break;
            case 'collision':
              setCollision(d.status);
              break;
            case 'ping': {
              const sent = parseInt(d.data, 10);
              if (Number.isFinite(sent)) {
                setLatency(Date.now() - sent);
              }
              break;
            }
            case 'battery':
              if (typeof d.pct === 'number') setBatteryPct(d.pct);
              break;
            default:
              break;
          }
        };

        ws.onclose = (e) => {
          if (!isMounted) return;
          if (e.code === 4003) {
            setError('Oturum sunucu tarafından sonlandırıldı.');
          } else {
            setStatus('Telemetri akışı kesildi');
          }
        };

      } catch (err) {
        if (isMounted) {
          let msg = err.message || 'Robota bağlanılamadı. Robot kullanımda olabilir.';
          if (err.status === 429) {
            msg = 'Simülasyon kapasitesi şu an dolu (en fazla 3 aktif robot). Lütfen birazdan tekrar deneyin.';
          } else if (err.status === 409) {
            msg = 'Robotun bataryası boş. Şarj olana kadar başlatılamaz.';
          } else if (err.status === 423) {
            msg = 'Robot şu an başka bir oturumda kullanılıyor.';
          }
          setError(msg);
          setStatus('Hata');
        }
      }
    }

    connect();

    return () => {
      isMounted = false;
      [publishTimer, hbRosTimer, heartbeatTimer, pingTimer, watchdogTimer].forEach((t) => {
        if (t.current) {
          clearInterval(t.current);
          t.current = null;
        }
      });
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* noop */ }
        wsRef.current = null;
      }
      if (rosRef.current) {
        try { rosRef.current.close(); } catch { /* noop */ }
        rosRef.current = null;
      }
      if (currentToken) {
        releaseRosRobot(rosRobotId, currentToken).catch(() => {});
      }
    };
  }, [rosRobotId, drawRadar, emergencyStop]);

  const sensorList = sensors ?? ['imu', 'scan', 'camera'];
  const hasCamera  = sensorList.includes('camera');
  const hasScan    = sensorList.includes('scan');

  const displayError = error
    ?? (rosRobotId ? null : 'Bu robot için tanımlı bir ROS ID bulunamadı.');

  if (displayError) {
    return (
      <div className="control-station" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#2a2a2a', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
          <h2>Bağlantı Hatası</h2>
          <p>{displayError}</p>
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
  const canDrive = isConnected && !isStale;

  const displayStatus = isStale
    ? (hasEverReceivedTelemetry ? 'Hedef Kayıp' : 'Robot başlatılıyor…')
    : status;
  const statusDotColor = isStale
    ? (hasEverReceivedTelemetry ? '#ef4444' : '#f59e0b')
    : (isConnected ? '#4ade80' : '#f59e0b');
  const statusPillClass = isStale
    ? (hasEverReceivedTelemetry ? 'disconnected' : 'connecting')
    : (isConnected ? 'connected' : 'connecting');

  const isWorldFresh = !isPoseStale && pose.ts > 0;
  const worldX = isWorldFresh ? pose.wx : null;
  const worldY = isWorldFresh ? pose.wy : null;
  const worldHeadingDeg = isWorldFresh ? pose.heading * RAD_TO_DEG : null;

  const batteryDisplay = batteryPct == null ? '—' : `${Math.round(batteryPct)}%`;
  const batteryClass =
    batteryPct == null ? 'battery-pill connecting' :
    batteryPct <= 15 ? 'battery-pill disconnected' :
    batteryPct <= 35 ? 'battery-pill connecting' : 'battery-pill connected';
  const batteryIcon =
    batteryPct == null ? '🔌' :
    batteryPct <= 15 ? '🪫' : '🔋';

  const latencyClass =
    latency == null ? 'connecting' :
    latency > 200 ? 'disconnected' :
    latency > 100 ? 'connecting' : 'connected';

  const collisionClass =
    collision == null ? 'connecting' :
    collision === 'OK' ? 'connected' : 'disconnected';

  return (
    <div className="control-station">
      {/* 🕒 HAREKETSİZLİK TAKİBİ: Popup Modal */}
      {showIdlePopup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center'
        }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', border: '1px solid #334155', maxWidth: '400px' }}>
            <h2>Hala Burada mısınız?</h2>
            <p style={{ color: '#94a3b8', margin: '1rem 0' }}>Uzun süredir hareket tespit edilmedi. Robotun güvenliği için oturum kapatılacaktır.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="primary-button" style={{ flex: 1 }} onClick={() => {
                lastActivityRef.current = Date.now();
                setShowIdlePopup(false);
              }}>Buradayım</button>
              <button className="secondary-button" style={{ flex: 1 }} onClick={() => navigate('/user/kontrol')}>Ayrıl</button>
            </div>
          </div>
        </div>
      )}

      <header className="control-header">
        <div className="control-title">
          <button className="back-btn" onClick={() => navigate('/user/kontrol')}>← Ayrıl</button>
          <h2>{robot?.nickname || robot?.name || 'Robot'} Kontrol Paneli</h2>
        </div>
        <div className={`connection-status ${statusPillClass}`}>
          <div className="status-dot" style={{ backgroundColor: statusDotColor }}></div>
          {displayStatus}
        </div>
      </header>

      <div className="status-strip">
        <span className="ns-tag">{rosRobotId || '—'}</span>
        <span className="strip-label">Gecikme</span>
        <span className={`status-badge ${latencyClass}`}>
          {latency != null ? `${latency} ms` : '—'}
        </span>
        <span className="strip-label">Çarpışma</span>
        <span className={`status-badge ${collisionClass}`}>
          {collision ?? '—'}
        </span>
        <span className="strip-label">Batarya</span>
        <span className={`status-badge ${batteryClass}`}>
          {batteryIcon} {batteryDisplay}
        </span>
        <span className="strip-label">Oturum</span>
        <span className="session-pill">
          {sessionToken ? `MINE · ${sessionToken.slice(0, 8)}` : 'YOK'}
        </span>
      </div>

      <div className="control-grid">
        <div className="visual-col">
          {hasCamera ? (
            <div className="panel camera-panel">
              <div className="panel-header">Ana Kamera</div>
              {/* Fixed 16:9 box — never resizes regardless of stream state */}
              <div
                className="camera-feed"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  background: '#000',
                  flexShrink: 0,
                }}
              >
                {sessionToken && (
                  <img
                    key={cameraKey}
                    src={getRosStreamUrl(rosRobotId, sessionToken)}
                    // crossOrigin flips the request to CORS mode so the
                    // multipart/x-mixed-replace response is not opaque —
                    // without it Firefox's ORB blocks the body even though
                    // CORSMiddleware would otherwise allow it.
                    crossOrigin="anonymous"
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    onError={() => {
                      clearTimeout(cameraTimerRef.current);
                      cameraTimerRef.current = setTimeout(() => setCameraKey(k => k + 1), 3000);
                    }}
                  />
                )}
              </div>
            </div>
          ) : hasScan ? (
            <div className="panel radar-panel radar-panel-large">
              <div className="panel-header">🎯 LIDAR</div>
              <div className="radar-wrapper">
                <canvas ref={canvasRef} width={360} height={360} className="radar-canvas" />
                <div className="radar-meta">
                  <div className="radar-legend" ref={radarLegendRef}>Tarama bekleniyor…</div>
                  <div className="radar-closest">
                    En yakın: <span ref={radarClosestRef}>—</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel camera-panel">
              <div className="panel-header">Görsel Sensör</div>
              <div className="cam-placeholder">
                📷 Bu konfigürasyon kamera veya LIDAR ile donatılmamış.
              </div>
            </div>
          )}

          <div className={`sensor-row${hasCamera && hasScan ? '' : ' single'}`}>
            <div className="panel imu-panel">
              <div className="panel-header">📡 IMU</div>
              <div className="sensor-rows">
                <SensorRow label="Yaw hızı"   value={(imu.gz * RAD_TO_DEG).toFixed(1)} unit="°/s" />
                <SensorRow label="Pitch hızı" value={(imu.gy * RAD_TO_DEG).toFixed(1)} unit="°/s" />
                <SensorRow label="Roll hızı"  value={(imu.gx * RAD_TO_DEG).toFixed(1)} unit="°/s" />
                <SensorRow label="İvme X"      value={imu.ax.toFixed(2)}                unit="m/s²" />
                <SensorRow label="İvme Y"      value={imu.ay.toFixed(2)}                unit="m/s²" />
                <SensorRow label="İvme Z"      value={imu.az.toFixed(2)}                unit="m/s²" />
              </div>
            </div>

            {hasCamera && hasScan && (
              <div className="panel radar-panel">
                <div className="panel-header">🎯 LIDAR</div>
                <div className="radar-wrapper">
                  <canvas ref={canvasRef} width={200} height={200} className="radar-canvas" />
                  <div className="radar-meta">
                    <div className="radar-legend" ref={radarLegendRef}>Tarama bekleniyor…</div>
                    <div className="radar-closest">
                      En yakın: <span ref={radarClosestRef}>—</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel side-panel">
          <div className="panel-section">
            <div className="panel-header">
              Telemetri
              <span className="hint">· {isWorldFresh ? '' : 'Odometri bekleniyor'}</span>
            </div>
            <div className="telemetry-grid telem-3x2">
              <div className="telemetry-box">
                <span className="t-label">Dünya X (m)</span>
                <span className="t-value">
                  {worldX != null ? worldX.toFixed(3) : '—'}
                </span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">Dünya Y (m)</span>
                <span className="t-value">
                  {worldY != null ? worldY.toFixed(3) : '—'}
                </span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">Dünya Yön (°)</span>
                <span className="t-value">
                  {worldHeadingDeg != null ? worldHeadingDeg.toFixed(1) : '—'}
                </span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">Odom X (m)</span>
                <span className="t-value">{odom.x.toFixed(3)}</span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">Odom Y (m)</span>
                <span className="t-value">{odom.y.toFixed(3)}</span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">{batteryIcon} Batarya</span>
                <span className="t-value">{batteryDisplay}</span>
              </div>
            </div>
          </div>

          <div className="panel-section control-section">
            <div className="panel-header">
              Manuel Sürüş
              <span className="hint">· WASD / Boşluk = Acil Dur</span>
            </div>

            <div className="speed-row">
              <div className="speed-item">
                <label>
                  Doğrusal <span className="speed-val">{linSpeed.toFixed(2)}</span> m/s
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={linSpeed}
                  onChange={(e) => setLinSpeed(parseFloat(e.target.value))}
                />
              </div>
              <div className="speed-item">
                <label>
                  Açısal <span className="speed-val">{angSpeed.toFixed(2)}</span> rad/s
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={angSpeed}
                  onChange={(e) => setAngSpeed(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="drive-controls">
              <div className="drive-col">
                <div
                  className="virtual-joystick-zone"
                  ref={joystickZoneRef}
                  aria-disabled={!canDrive}
                >
                  <div className="virtual-joystick-knob" ref={joystickKnobRef}></div>
                </div>
                <div className="ctrl-label">Sürüklerek sür</div>
              </div>

              <div className="drive-col">
                <div className="joystick-container compact">
                  <button
                    className="joy-btn joy-up"
                    disabled={!canDrive}
                    onMouseDown={() => dpadStart(linSpeed, 0)}
                    onMouseUp={dpadStop}
                    onMouseLeave={dpadStop}
                    onTouchStart={(e) => { e.preventDefault(); dpadStart(linSpeed, 0); }}
                    onTouchEnd={dpadStop}
                  >▲</button>
                  <button
                    className="joy-btn joy-left"
                    disabled={!canDrive}
                    onMouseDown={() => dpadStart(0, angSpeed)}
                    onMouseUp={dpadStop}
                    onMouseLeave={dpadStop}
                    onTouchStart={(e) => { e.preventDefault(); dpadStart(0, angSpeed); }}
                    onTouchEnd={dpadStop}
                  >◀</button>
                  <button
                    className="joy-btn dpad-stop"
                    disabled={!isConnected}
                    onMouseDown={emergencyStop}
                    onTouchStart={(e) => { e.preventDefault(); emergencyStop(); }}
                    aria-label="Acil Durdurma"
                    title="Acil Durdurma (Boşluk)"
                  >■</button>
                  <button
                    className="joy-btn joy-right"
                    disabled={!canDrive}
                    onMouseDown={() => dpadStart(0, -angSpeed)}
                    onMouseUp={dpadStop}
                    onMouseLeave={dpadStop}
                    onTouchStart={(e) => { e.preventDefault(); dpadStart(0, -angSpeed); }}
                    onTouchEnd={dpadStop}
                  >▶</button>
                  <button
                    className="joy-btn joy-down"
                    disabled={!canDrive}
                    onMouseDown={() => dpadStart(-linSpeed, 0)}
                    onMouseUp={dpadStop}
                    onMouseLeave={dpadStop}
                    onTouchStart={(e) => { e.preventDefault(); dpadStart(-linSpeed, 0); }}
                    onTouchEnd={dpadStop}
                  >▼</button>
                </div>
                <div className="ctrl-label">D-Pad</div>
              </div>

              <div className="drive-col">
                <div className="cmdvel-readout">
                  <div className="cv-label">Doğrusal X</div>
                  <div className="cv-val">{cmdVel.linear.toFixed(2)} <span className="cv-unit">m/s</span></div>
                  <div className="cv-label" style={{ marginTop: 8 }}>Açısal Z</div>
                  <div className="cv-val">{cmdVel.angular.toFixed(2)} <span className="cv-unit">rad/s</span></div>
                </div>
                <div className="ctrl-label">/cmd_vel</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SensorRow({ label, value, unit }) {
  return (
    <div className="sensor-row-item">
      <span className="sensor-lbl">{label}</span>
      <span><span className="sensor-val">{value}</span> {unit}</span>
    </div>
  );
}

export default ControlPanelPage;