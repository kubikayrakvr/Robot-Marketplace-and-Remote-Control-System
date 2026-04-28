import { getAccessToken } from '../auth/mockSession';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Helper: Authenticated fetch with JSON handling & error mapping.
 */
async function adminFetch(endpoint, options = {}) {
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

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ─── KULLANICI YÖNETİMİ ──────────────────────────────────────

/** Tüm kullanıcıları listeler */
export function fetchUsers() {
  return adminFetch('/api/admin/kullanıcılar');
}

/** Belirli bir kullanıcının detaylarını getirir */
export function fetchUserById(userId) {
  return adminFetch(`/api/admin/kullanıcılar/bilgi/${userId}`);
}

/** Kullanıcı bilgilerini günceller */
export function updateUser(userId, data) {
  return adminFetch(`/api/admin/kullanıcılar/düzenle/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── ROBOT KATALOG YÖNETİMİ ──────────────────────────────────

/** Tüm robot katalog öğelerini listeler */
export function fetchRobots() {
  return adminFetch('/api/admin/robots');
}

/** Katalogdaki bir robotu günceller */
export function updateRobot(robotId, data) {
  return adminFetch(`/api/admin/robots/düzenle/${robotId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** Kataloga yeni bir robot modeli ekler */
export function createRobot(data) {
  return adminFetch('/api/admin/robots/ekle', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── ENVANTER ─────────────────────────────────────────────────

/** Fiziksel robot birimleri (envanter) üretir */
export function generateInventory(data) {
  return adminFetch('/api/admin/robots/envanter-olustur', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── SİSTEM LOGLARI ──────────────────────────────────────────

/** Sistem denetim loglarını getirir */
export function fetchAuditLogs(limit = 100) {
  return adminFetch(`/api/admin/log?limit=${limit}`);
}
