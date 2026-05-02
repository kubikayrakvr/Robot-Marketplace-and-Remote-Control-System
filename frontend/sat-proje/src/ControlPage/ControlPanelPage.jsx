
import '../roslib.min.js';
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
const PUBLISH_INTERVAL_MS = 66;     // ~15 Hz cmd_vel
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
  // Sensor configuration of the connected robot. Until the detail fetch
  // completes we render the layout with all three sensors assumed present
  // (the most common Waffle case) — once the response lands the flag flips
  // and the layout adapts. Concrete values come from the backend
  // /ros/robot/{id} response, which is sourced from _TYPE_SENSORS.
  const [sensors, setSensors] = useState(null);
  // Starts `true` so the drive controls are disabled until the first odom
  // arrives. This gates teleop on the spawn-then-online lifecycle: claim
  // succeeds → spawn signal fires → robot enters ROS → odom flows → drive
  // enables. The watchdog flips this back to true if telemetry stalls.
  const [isStale, setIsStale] = useState(true);
  // Sticky flag — false until the first odom arrives, true forever after.
  // Used to disambiguate "still spawning" from "lost mid-session" in the
  // status pill. Kept as state (not a ref) because React 19 rejects ref
  // reads during render.
  const [hasEverReceivedTelemetry, setHasEverReceivedTelemetry] = useState(false);
  // Starts `true` so we render the odom fallback before any pose has arrived.
  // Flips to false on the first pose, back to true when the watchdog tick
  // notices it's been longer than POSE_STALE_MS since the last update.
  const [isPoseStale, setIsPoseStale] = useState(true);

  // ── Telemetry state (relay-driven) ───────────────────────────────────
  const [odom, setOdom] = useState({ x: 0, y: 0, ts: 0 });
  const [pose, setPose] = useState({ wx: 0, wy: 0, heading: 0, ts: 0 });
  const [imu, setImu] = useState({ ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 });
  const [collision, setCollision] = useState(null);
  const [latency, setLatency] = useState(null);

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

  // Last odom arrival timestamp — used by the watchdog to detect stalls
  // without depending on odom state (which would require restarting the
  // interval on every odom message).
  const lastOdomTsRef = useRef(0);
  const lastPoseTsRef = useRef(0);
  // Edge detector — true while the watchdog has us in the stale state.
  // Lets the watchdog tick fire emergencyStop *once* on the transition
  // into stale, instead of routing through a [isStale]-keyed useEffect
  // (which would call setState synchronously inside an effect).
  const wasStaleRef = useRef(false);

  // ── DOM refs ─────────────────────────────────────────────────────────
  const joystickZoneRef = useRef(null);
  const joystickKnobRef = useRef(null);
  const canvasRef = useRef(null);
  const radarLegendRef = useRef(null);
  const radarClosestRef = useRef(null);

  // The latest scan is held in a ref — 5 Hz scan updates would otherwise
  // rerender the entire panel just to hand a 360-element array to a
  // canvas. We paint directly from the ref instead.
  const latestScanRef = useRef(null);

  useEffect(() => { linSpeedRef.current = linSpeed; }, [linSpeed]);
  useEffect(() => { angSpeedRef.current = angSpeed; }, [angSpeed]);

  // ── Drive command helpers ────────────────────────────────────────────
  const setDesiredVel = useCallback((linear, angular) => {
    desiredVelRef.current = { linear, angular };
    setCmdVel({ linear, angular });
  }, []);

  const emergencyStop = useCallback(() => {
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

  // ── Radar painter (direct DOM, zero React renders in the path) ───────
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

    // Range rings
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshair
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

    // Robot center marker
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Stat readouts via direct DOM mutation (no setState)
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

  // ── WASD keyboard + Spacebar e-stop ──────────────────────────────────
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

  // ── Virtual joystick (mouse + touch) ─────────────────────────────────
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

  // ── Best-effort session release on tab close ─────────────────────────
  // The component's unmount cleanup uses fetch(), which the browser is free
  // to abort during a page-unload. sendBeacon is queued at the OS level and
  // guaranteed to dispatch, so the operator's slot is freed up the moment
  // they close the tab instead of waiting for the 15 s session reaper.
  useEffect(() => {
    if (!sessionToken || !rosRobotId) return;
    const handler = () => sendBeaconRelease(rosRobotId, sessionToken);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sessionToken, rosRobotId]);

  // ── Connect: claim → roslibjs (publish) + FastAPI relay (subscribe) ──
  useEffect(() => {
    // No-op when the robot has no ROS binding — the missing-id error is
    // surfaced in render via `displayError` so we don't have to setState
    // synchronously inside this effect.
    if (!rosRobotId) return;

    let isMounted = true;
    let currentToken = null;
    const ns = rosRobotId.toLowerCase().replace('rob-', 'rob');

    async function connect() {
      try {
        // Parallel: claim the session + fetch sensor metadata. The detail
        // call adds nothing critical to the claim path so it goes alongside,
        // not before — the claim response is what blocks teleop start.
        const [{ token }, detail] = await Promise.all([
          claimRosRobot(rosRobotId),
          fetchRosRobotById(rosRobotId).catch(() => null),
        ]);

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

        // Session-keepalive ping to FastAPI (claim TTL).
        //
        // 403 (token mismatch — someone else stole our claim) and 404 (session
        // not found — server forgot us, e.g. after a restart) are terminal:
        // continuing to publish under a dead token would waste cycles and
        // emit cmd_vel messages the C++ controller will silently drop. Stop
        // every active timer and close the relay WS so no more telemetry is
        // accepted, then surface a critical error. The operator returns to
        // the selection page, the component unmounts, and the standard
        // cleanup runs the final release call (idempotent if already gone).
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

        // 1. roslibjs — for the *outbound* path only:
        //    cmd_vel_web (token-gated by the C++ controller),
        //    session/heartbeat,
        //    /ping (frontend publishes its own timestamp; the relay echoes
        //          it back to us via FastAPI WS so we can compute RTT).
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
            // Defence in depth: even before isStale propagates through React,
            // refuse to publish if telemetry has gone silent. Better to drop
            // commands than to keep driving a robot we can't see.
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

          // Latency probe — publish a timestamp; the relay subscribes to the
          // same topic and forwards the rosbridge echo back to us, so the
          // round-trip we measure mirrors the actual telemetry path.
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

        // 2. FastAPI relay WS — for the *inbound* telemetry path. All
        //    sensor data (odom, imu, scan, ground_truth, collision, ping
        //    echo) flows here so the backend can sever the stream the
        //    moment a session is revoked.
        const ws = new WebSocket(getRosWebSocketUrl(rosRobotId, token));
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setStatus('Bağlandı');
          console.log('[relay] FastAPI telemetry WS açıldı');

          // Start the watchdog only after the relay is up. Until the first
          // odom/pose arrives we hold the corresponding flag at its initial
          // value — otherwise `Date.now() - 0` would trip the stale guard
          // immediately on a healthy connection.
          //
          // The same tick also re-evaluates pose freshness so the
          // World↔Odom fallback can flip without us having to read
          // Date.now() during render (React 19 forbids impure reads).
          watchdogTimer.current = setInterval(() => {
            const lastOdom = lastOdomTsRef.current;
            if (lastOdom > 0) {
              const stale = Date.now() - lastOdom > ODOM_STALE_MS;
              // Edge: false → true. Scrub all in-flight commands so the
              // robot won't lurch when telemetry returns — the operator
              // must re-press to drive again.
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
              // First odom after spawn — flip the stale guard immediately so
              // drive controls light up without waiting for the next 1 Hz
              // watchdog tick. Both updates bail out cheaply once they're
              // already at their target value.
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
            default:
              break;
          }
        };

        ws.onerror = (e) => {
          console.warn('[relay] WS error', e);
        };

        ws.onclose = (e) => {
          if (!isMounted) return;
          if (e.code === 4003) {
            // Backend closed with the "session invalid" code — token was
            // revoked or never matched. Surface a hard error rather than
            // silently re-trying.
            setError('Oturum sunucu tarafından sonlandırıldı.');
          } else {
            setStatus('Telemetri akışı kesildi');
          }
        };

      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Robota bağlanılamadı. Robot kullanımda olabilir.');
          setStatus('Hata');
        }
      }
    }

    connect();

    return () => {
      isMounted = false;
      // Clear timers BEFORE closing sockets so no in-flight publish or
      // heartbeat fires after we've torn down its target.
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

  // Sensor capabilities. While `sensors` is still null (detail fetch
  // pending), assume the most-equipped configuration so the layout
  // doesn't flash a smaller variant before the first paint.
  const sensorList = sensors ?? ['imu', 'scan', 'camera'];
  const hasCamera  = sensorList.includes('camera');
  const hasScan    = sensorList.includes('scan');

  // Single source of truth for the error screen. The missing-rosRobotId case
  // is derived (no setState) so the connect effect stays render-pure.
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
  // Drive inputs are gated by both the connection AND the watchdog. E-stop
  // intentionally only requires `isConnected` so it remains usable during a
  // stall — better to send a "stop" the robot may not receive than to lock
  // the user out entirely.
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

  // Ground-truth-or-fallback: prefer wx/wy when pose is fresh, else odom.
  // `isPoseStale` is maintained by the watchdog tick — keeping the read
  // pure here lets render stay deterministic on its inputs (React 19's
  // purity rule rejects calling Date.now() during render).
  const isWorldFresh = !isPoseStale && pose.ts > 0;
  const displayX = isWorldFresh ? pose.wx : odom.x;
  const displayY = isWorldFresh ? pose.wy : odom.y;
  const headingDeg = pose.heading * RAD_TO_DEG;

  const latencyClass =
    latency == null ? 'connecting' :
    latency > 200 ? 'disconnected' :
    latency > 100 ? 'connecting' : 'connected';

  const collisionClass =
    collision == null ? 'connecting' :
    collision === 'OK' ? 'connected' : 'disconnected';

  return (
    <div className="control-station">
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
        <span className="strip-label">Oturum</span>
        <span className="session-pill">
          {sessionToken ? `MINE · ${sessionToken.slice(0, 8)}` : 'YOK'}
        </span>
      </div>

      <div className="control-grid">
        {/* Left column packs the visual sensor on top and the
            IMU / small-radar row below. This keeps every readout in
            one viewport — no scrolling — and absorbs the dead space
            that used to sit below the Burger's promoted radar. */}
        <div className="visual-col">
          {/* Top-left visual tile adapts to the robot's sensor loadout:
                · Has camera → live MJPEG feed.
                · No camera but has LIDAR → radar canvas promoted up,
                  larger size for readability.
                · Neither → a clear "no visual sensor" placeholder so
                  the slot doesn't collapse and the grid stays balanced. */}
          {hasCamera ? (
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
          ) : hasScan ? (
            <div className="panel radar-panel radar-panel-large">
              <div className="panel-header">🎯 LIDAR Radar</div>
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

          {/* IMU is always rendered. Small radar joins it side-by-side
              when the camera occupied the top slot — when the radar was
              already promoted up, the IMU spans the full row alone. */}
          <div className={`sensor-row${hasCamera && hasScan ? '' : ' single'}`}>
            <div className="panel imu-panel">
              <div className="panel-header">📡 IMU</div>
              <div className="sensor-rows">
                <SensorRow label="Yaw hızı"   value={(imu.gz * RAD_TO_DEG).toFixed(1)} unit="°/s" />
                <SensorRow label="Pitch hızı" value={(imu.gy * RAD_TO_DEG).toFixed(1)} unit="°/s" />
                <SensorRow label="Roll hızı"  value={(imu.gx * RAD_TO_DEG).toFixed(1)} unit="°/s" />
                <SensorRow label="İvme X"     value={imu.ax.toFixed(2)}                unit="m/s²" />
                <SensorRow label="İvme Y"     value={imu.ay.toFixed(2)}                unit="m/s²" />
                <SensorRow label="İvme Z"     value={imu.az.toFixed(2)}                unit="m/s²" />
              </div>
            </div>

            {hasCamera && hasScan && (
              <div className="panel radar-panel">
                <div className="panel-header">🎯 LIDAR Radar</div>
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
              <span className="hint">· {isWorldFresh ? 'Gazebo Ground Truth' : 'Odom Yedek'}</span>
            </div>
            <div className="telemetry-grid telem-3x2">
              <div className="telemetry-box">
                <span className="t-label">Dünya X (m)</span>
                <span className="t-value">{displayX.toFixed(3)}</span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">Dünya Y (m)</span>
                <span className="t-value">{displayY.toFixed(3)}</span>
              </div>
              <div className="telemetry-box">
                <span className="t-label">Yön (°)</span>
                <span className="t-value">
                  {Number.isFinite(headingDeg) ? headingDeg.toFixed(1) : '—'}
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
                <span className="t-label">Yaw (rad/s)</span>
                <span className="t-value">{imu.gz.toFixed(3)}</span>
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
                  {/* E-stop lives in the dpad's center cell — closer to
                      the user's hand position than a separate row at the
                      bottom of the panel. Always usable when connected,
                      even mid-stall, so the operator can stop a runaway
                      robot the moment they notice. */}
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
