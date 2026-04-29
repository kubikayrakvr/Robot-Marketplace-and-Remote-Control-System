import { getAccessToken } from '../auth/session';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Helper: Token'lı fetch. Oturum yoksa hata fırlatır.
 */
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

/**
 * Helper: Token gerektirmeyen fetch.
 */
async function publicFetch(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

// ─── AUTH ─────────────────────────────────────────────────────

/** Backend'e logout isteği gönderir (token'ı blacklist'e ekler) */
export function logoutFromBackend() {
  return authFetch('/api/auth/logout', { method: 'POST' });
}

/** Kullanıcı profil bilgilerini günceller */
export function updateMyProfile(data) {
  return authFetch('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── MAĞAZA (PUBLIC) ──────────────────────────────────────────

/** Mağazadaki tüm robot modellerini listeler (auth gerektirmez) */
export function fetchMarketRobots() {
  return publicFetch('/api/robots/market');
}

// ─── SEPET ────────────────────────────────────────────────────

/** Kullanıcının sepetini getirir */
export function fetchCart() {
  return authFetch('/api/cart/');
}

/** Sepete ürün ekler */
export function addItemToCart(productId, quantity = 1) {
  return authFetch('/api/cart/items', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, quantity }),
  });
}

/** Sepetteki ürün miktarını günceller (0 = sil) */
export function updateCartItem(itemId, quantity) {
  return authFetch(`/api/cart/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

/** Sepeti tamamen temizler */
export function clearCartOnBackend() {
  return authFetch('/api/cart/', { method: 'DELETE' });
}

// ─── SİPARİŞ ─────────────────────────────────────────────────

/** Sipariş oluşturur (sepetteki ürünlerden) */
export function createOrder(address, paymentMethod = 'credit_card') {
  return authFetch('/api/orders/', {
    method: 'POST',
    body: JSON.stringify({ address, payment_method: paymentMethod }),
  });
}

/** Kullanıcının siparişlerini listeler */
export function fetchOrders() {
  return authFetch('/api/orders/');
}

// ─── ROBOT AKTİVASYON ────────────────────────────────────────

/** Aktivasyon kodu ile robotu kullanıcıya tanımlar */
export function activateRobotOnBackend(code, nickname) {
  return authFetch(`/api/user-robots/tanimla?code=${encodeURIComponent(code)}&nickname=${encodeURIComponent(nickname)}`, {
    method: 'POST',
  });
}
