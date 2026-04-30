const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ADMIN_SESSION_KEY = 'satproje.admin_session';

// ─── ADMIN OTURUM YÖNETİMİ ──────────────────────────────────

/** Admin oturumunu localStorage'a kaydeder */
export function saveAdminSession(token, user) {
  localStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({ token, user })
  );
}

/** Admin oturumunu localStorage'dan okur */
export function getAdminSession() {
  const raw = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Admin oturumunu temizler */
export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

/** Admin oturum token'ını döner (convenience) */
function getAdminToken() {
  const session = getAdminSession();
  return session?.token ?? null;
}

// ─── ADMIN GİRİŞ ─────────────────────────────────────────────

/**
 * Admin olarak giriş yapar.
 * 1) /api/auth/login ile token alır
 * 2) /api/users/me ile kullanıcı bilgilerini çeker
 * 3) is_admin kontrolü yapar
 * 4) Admin oturumunu ayrı key'e kaydeder
 */
export async function adminLogin(email, password) {
  // 1) Login — token al
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const errData = await loginRes.json().catch(() => ({}));
    let msg = 'Giriş başarısız';
    if (errData.detail) {
      msg = typeof errData.detail === 'string'
        ? errData.detail
        : JSON.stringify(errData.detail);
    }
    throw new Error(msg);
  }

  const { access_token } = await loginRes.json();

  // 2) Kullanıcı bilgilerini çek
  const meRes = await fetch(`${API_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!meRes.ok) {
    throw new Error('Kullanıcı bilgileri alınamadı');
  }

  const user = await meRes.json();

  // 3) Admin kontrolü
  if (!user.is_admin) {
    throw new Error('Bu hesap admin yetkisine sahip değil');
  }

  // 4) Admin oturumunu kaydet
  saveAdminSession(access_token, user);

  return user;
}

// ─── AUTH FETCH HELPER ────────────────────────────────────────

/**
 * Admin token'ı ile authenticated fetch yapar.
 * Token yoksa "Oturum bulunamadı" hatası fırlatır.
 */
async function adminFetch(endpoint, options = {}) {
  const token = getAdminToken();
  if (!token) {
    throw new Error('Admin oturumu bulunamadı. Lütfen giriş yapın.');
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
    // Token geçersiz veya süresi dolmuşsa oturumu temizle
    if (res.status === 401) {
      clearAdminSession();
      throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `İstek başarısız (HTTP ${res.status})`);
  }

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

/** Katalogdaki bir robotu siler */
export function deleteRobot(robotId) {
  return adminFetch(`/api/admin/robots/${robotId}`, {
    method: 'DELETE',
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

// ─── RAPOR YÖNETİMİ ──────────────────────────────────────────

/** Raporları listeler (resolved: true/false/null) */
export function fetchAdminReports(resolved = null) {
  let url = '/api/admin/reports';
  if (resolved !== null) {
    url += `?resolved=${resolved}`;
  }
  return adminFetch(url);
}

/** Bir raporu çözüldü olarak işaretler */
export function resolveReport(reportId) {
  return adminFetch(`/api/admin/reports/coz/${reportId}`, {
    method: 'PATCH',
  });
}
