import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchMyRobotsFromBackend, activateRobotOnBackend } from '../api/userApi';
import { getAccessToken } from '../auth/session';

const RobotContext = createContext();

export function RobotProvider({ children }) {
  const [ownedRobots, setOwnedRobots] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMyRobots = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) { setOwnedRobots([]); return; }

      const data = await fetchMyRobotsFromBackend();
      if (data) {
        setOwnedRobots(data);
      }
    } catch (e) {
      console.error('Robotlar yüklenemedi:', e);
      if (e.message.includes('401') || e.message.includes('403')) {
        setOwnedRobots([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // f5 atınca robotlar gelsin diye
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      fetchMyRobots();
    }
  }, [fetchMyRobots]);

  const addPurchasedRobots = useCallback(async () => {
    await fetchMyRobots();
  }, [fetchMyRobots]);

  const activateRobot = useCallback(async (instanceId, activationCode, nickname) => {
    try {
      const data = await activateRobotOnBackend(activationCode, nickname || activationCode);
      if (data && data.robot) {
        setOwnedRobots((prev) => {
          const exists = prev.find((r) => r.instanceId === data.robot.instanceId);
          if (exists) return prev.map((r) => r.instanceId === data.robot.instanceId ? data.robot : r);
          return [...prev, data.robot];
        });
      }
      return { success: true, message: data?.message || 'Aktivasyon başarılı' };
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
