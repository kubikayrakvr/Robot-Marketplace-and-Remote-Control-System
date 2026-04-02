const SESSION_KEY = 'satproje.session';

export function saveMockSession({ token, user }) {
  const session = {
    token,
    user,
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

