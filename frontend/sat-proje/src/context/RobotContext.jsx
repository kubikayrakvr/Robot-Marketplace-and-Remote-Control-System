import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const RobotContext = createContext();
const API = 'http://49.13.13.48:8000';

function getAuthHeaders() {
  const raw = localStorage.getItem('satproje.session');
  const token = raw ? JSON.parse(raw)?.token : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export function RobotProvider({ children }) {
  const [ownedRobots, setOwnedRobots] = useState([]);
  const [loading, setLoading] = useState(false);

const fetchMyRobots = useCallback(async (overrideToken = null) => {
    setLoading(true);
    try {
      const raw = localStorage.getItem('satproje.session');
      const token = overrideToken || (raw ? JSON.parse(raw)?.token : null);
      if (!token) { setOwnedRobots([]); return; }

      const res = await fetch(`${API}/api/user-robots/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) { setOwnedRobots([]); return; }
      if (!res.ok) return;
      const data = await res.json();
      setOwnedRobots(data);
    } catch (e) {
      console.error('Robotlar yüklenemedi:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // f5 atınca robotlar gelsin diye
  useEffect(() => {
    const raw = localStorage.getItem('satproje.session');
    const token = raw ? JSON.parse(raw)?.token : null;
    if (token) {
      fetchMyRobots(token);
    }
  }, []);

  const addPurchasedRobots = useCallback(async () => {
    await fetchMyRobots();
  }, [fetchMyRobots]);

  const activateRobot = useCallback(async (instanceId, activationCode, nickname) => {
    try {
      const res = await fetch(
        `${API}/api/user-robots/tanimla?code=${encodeURIComponent(activationCode)}&nickname=${encodeURIComponent(nickname || activationCode)}`,
        { method: 'POST', headers: getAuthHeaders() }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Aktivasyon başarısız');
      }
      const data = await res.json();
      if (data.robot) {
        setOwnedRobots((prev) => {
          const exists = prev.find((r) => r.instanceId === data.robot.instanceId);
          if (exists) return prev.map((r) => r.instanceId === data.robot.instanceId ? data.robot : r);
          return [...prev, data.robot];
        });
      }
      return { success: true, message: data.message };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }, []);

  return (
    <RobotContext.Provider value={{ ownedRobots, addPurchasedRobots, activateRobot, fetchMyRobots, loading }}>
      {children}
    </RobotContext.Provider>
  );
}

export function useRobots() {
  const context = useContext(RobotContext);
  if (!context) throw new Error('useRobots must be used within a RobotProvider');
  return context;
}
