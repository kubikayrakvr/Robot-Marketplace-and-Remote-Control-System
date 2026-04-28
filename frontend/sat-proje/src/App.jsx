import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './LandingPage/LandingPage';
import RegisterPage from './RegisterPage/RegisterPage';
import LoginPage from './LoginPage/LoginPage';
import UserPage from './UserPage/UserPage';
import ShopPage from './ShopPage/ShopPage';
import CartPage from './CartPage/CartPage';
import CheckoutPage from './CheckoutPage/CheckoutPage';
import MyRobotsPage from './MyRobotsPage/MyRobotsPage';
import ActivateRobotPage from './MyRobotsPage/ActivateRobotPage';
import RobotInfoPage from './MyRobotsPage/RobotInfoPage';
import ControlSelectionPage from './ControlPage/ControlSelectionPage';
import ControlPanelPage from './ControlPage/ControlPanelPage';
import AdminRobotsPage from './AdminPage/AdminRobotsPage';
import AdminRobotInfoPage from './AdminPage/AdminRobotInfoPage';
import AdminRobotEditPage from './AdminPage/AdminRobotEditPage';
import AdminUsersPage from './AdminPage/AdminUsersPage';
import AdminUserInfoPage from './AdminPage/AdminUserInfoPage';
import { CartProvider } from './context/CartContext';
import { RobotProvider } from './context/RobotContext';
import { getMockSession } from './auth/mockSession';
import './App.css';

function ProtectedRoute({ children }) {
  const session = getMockSession();
  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <RobotProvider>
      <CartProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/user"
            element={
              <ProtectedRoute>
                <UserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/shop"
            element={
              <ProtectedRoute>
                <ShopPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/sepetim"
            element={
              <ProtectedRoute>
                <CartPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/odeme"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/robotlarim"
            element={
              <ProtectedRoute>
                <MyRobotsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/robotlarim/tanimla/:id"
            element={
              <ProtectedRoute>
                <ActivateRobotPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/robotlarim/bilgi/:id"
            element={
              <ProtectedRoute>
                <RobotInfoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/kontrol"
            element={
              <ProtectedRoute>
                <ControlSelectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/kontrol/:id"
            element={
              <ProtectedRoute>
                <ControlPanelPage />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/robots" element={<AdminRobotsPage />} />
          <Route path="/admin/robots/bilgi/:id" element={<AdminRobotInfoPage />} />
          <Route path="/admin/robots/duzenle/:id" element={<AdminRobotEditPage />} />
          <Route path="/admin/kullanicilar" element={<AdminUsersPage />} />
          <Route path="/admin/user/bilgi/:id" element={<AdminUserInfoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CartProvider>
    </RobotProvider>
  );
}

export default App;