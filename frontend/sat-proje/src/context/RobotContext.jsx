import { createContext, useContext, useState } from 'react';

const RobotContext = createContext();

export function RobotProvider({ children }) {
  const [ownedRobots, setOwnedRobots] = useState([]);

  // Sepetteki urunleri envantere ekle
  const addPurchasedRobots = (cartItems) => {
    const newRobots = [];
    cartItems.forEach((item) => {
      // Eger ayni urunden 2 tane almissa, 2 ayri instance olusturuyoruz
      for (let i = 0; i < item.quantity; i++) {
        newRobots.push({
          instanceId: `${item.id}-${Date.now()}-${i}`,
          modelId: item.id,
          name: item.name,
          icon: item.icon,
          description: item.description,
          status: 'inactive', // inactive = red (onaysiz), active = green (onayli)
          serialNumber: null,
          purchaseDate: new Date().toISOString(),
        });
      }
    });
    setOwnedRobots((prev) => [...prev, ...newRobots]);
  };

  // Robotu seri no ile aktiflestir
  const activateRobot = (instanceId, serialNumber) => {
    setOwnedRobots((prev) =>
      prev.map((robot) =>
        robot.instanceId === instanceId
          ? { ...robot, status: 'active', serialNumber }
          : robot
      )
    );
  };

  return (
    <RobotContext.Provider value={{ ownedRobots, addPurchasedRobots, activateRobot }}>
      {children}
    </RobotContext.Provider>
  );
}

export function useRobots() {
  const context = useContext(RobotContext);
  if (!context) {
    throw new Error('useRobots must be used within a RobotProvider');
  }
  return context;
}
