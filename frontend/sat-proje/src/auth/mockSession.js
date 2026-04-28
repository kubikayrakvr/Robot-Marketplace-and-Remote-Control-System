const SESSION_KEY = 'satproje.session';

/**
 * Save real session after login.
 * @param {{ access_token: string, user: object }} sessionData
 */
export function saveMockSession(sessionData) {
  // sessionData should have { access_token, user: { id, email, username, is_admin } }
  const session = {
    token: sessionData.access_token,
    user: sessionData.user,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getMockSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearMockSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Get stored access token (convenience).
 */
export function getAccessToken() {
  const session = getMockSession();
  return session?.token ?? null;
}
