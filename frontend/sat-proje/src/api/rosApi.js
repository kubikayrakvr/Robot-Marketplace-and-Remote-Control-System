import { getAccessToken } from '../auth/session';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function authFetch(endpoint, options = {}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Oturum bulunamadı. Lütfen giriş yapın.');
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `İstek başarısız (HTTP ${res.status})`);
  }

  if (res.status === 204) return null;
  return res.json();
}

/** ROS/Gazebo sistemindeki tüm robotları getirir */
export function fetchRosRobots() {
  return authFetch('/ros/robots');
}

/** Belirli bir robotun detayını getirir */
export function fetchRosRobotById(robotId) {
  return authFetch(`/ros/robot/${robotId}`);
}

/** Robotu kontrol etmek için claim eder (oturum başlatır) */
export function claimRosRobot(robotId) {
  return authFetch(`/ros/robot/${robotId}/claim`, { method: 'POST' });
}

/** Claim edilmiş robota kalp atışı (heartbeat) gönderir */
export function heartbeatRosRobot(robotId, sessionToken) {
  const token = getAccessToken();
  return fetch(`${API_URL}/ros/robot/${robotId}/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-session-token': sessionToken,
    },
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `İstek başarısız (HTTP ${res.status})`);
    }
    return res.json();
  });
}

/** Robot kontrol oturumunu iptal eder (delete) */
export function deleteClaimRosRobot(robotId, sessionToken) {
  const token = getAccessToken();
  return fetch(`${API_URL}/ros/robot/${robotId}/claim`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-session-token': sessionToken,
    },
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `İstek başarısız (HTTP ${res.status})`);
    }
    return res.json();
  });
}

/** Robot kontrol oturumunu serbest bırakır (post release) */
export function releaseRosRobot(robotId, sessionToken) {
  const token = getAccessToken();
  return fetch(`${API_URL}/ros/robot/${robotId}/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-session-token': sessionToken,
    },
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `İstek başarısız (HTTP ${res.status})`);
    }
    return res.json();
  });
}

/** WebSocket URL'sini döner */
export function getRosWebSocketUrl(robotId, sessionToken) {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = API_URL.replace(/^https?:\/\//, '');
  return `${wsProtocol}//${host}/ros/robot/${robotId}/ws?token=${sessionToken}`;
}

/** Video stream URL'sini döner */
export function getRosStreamUrl(robotId, sessionToken) {
  return `${API_URL}/ros/robot/${robotId}/stream?token=${sessionToken}`;
}
