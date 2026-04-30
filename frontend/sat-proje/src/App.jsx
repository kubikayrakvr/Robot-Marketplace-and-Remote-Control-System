import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './LandingPage/LandingPage';
import RegisterPage from './RegisterPage/RegisterPage';
import LoginPage from './LoginPage/LoginPage';
import UserPage from './UserPage/UserPage';
import ProfilePage from './UserPage/ProfilePage';
import ShopPage from './ShopPage/ShopPage';
import CartPage from './CartPage/CartPage';
import CheckoutPage from './CheckoutPage/CheckoutPage';
import MyRobotsPage from './MyRobotsPage/MyRobotsPage';
import ActivateRobotPage from './MyRobotsPage/ActivateRobotPage';
import RobotInfoPage from './MyRobotsPage/RobotInfoPage';
import ControlSelectionPage from './ControlPage/ControlSelectionPage';
import ControlPanelPage from './ControlPage/ControlPanelPage';
import OrdersPage from './UserPage/OrdersPage';
import OrderDetailsPage from './UserPage/OrderDetailsPage';
import ReportsPage from './UserPage/ReportsPage';
import AdminLoginPage from './AdminPage/AdminLoginPage';
import AdminProtectedRoute from './AdminPage/AdminProtectedRoute';
import AdminRobotsPage from './AdminPage/AdminRobotsPage';
import AdminRobotInfoPage from './AdminPage/AdminRobotInfoPage';
import AdminRobotEditPage from './AdminPage/AdminRobotEditPage';
import AdminRobotAddPage from './AdminPage/AdminRobotAddPage';
import AdminUsersPage from './AdminPage/AdminUsersPage';
import AdminUserInfoPage from './AdminPage/AdminUserInfoPage';
import AdminReportsPage from './AdminPage/AdminReportsPage';
import { CartProvider } from './context/CartContext';
import { RobotProvider } from './context/RobotContext';
import { getSession } from './auth/session';
import './App.css';
import ForgotPasswordPage from './LoginPage/ForgotPasswordPage';
import ResetPasswordPage from './LoginPage/ResetPasswordPage';

function ProtectedRoute({ children }) {
  const session = getSession();
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
            path="/user/profil"
            element={
              <ProtectedRoute>
                <ProfilePage />
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
          <Route
            path="/user/siparislerim"
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/siparislerim/:id"
            element={
              <ProtectedRoute>
                <OrderDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/raporlar"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin/robots"
            element={
              <AdminProtectedRoute>
                <AdminRobotsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/robots/ekle"
            element={
              <AdminProtectedRoute>
                <AdminRobotAddPage />
              </AdminProtectedRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/admin/robots/bilgi/:id"
            element={
              <AdminProtectedRoute>
                <AdminRobotInfoPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/robots/duzenle/:id"
            element={
              <AdminProtectedRoute>
                <AdminRobotEditPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/kullanicilar"
            element={
              <AdminProtectedRoute>
                <AdminUsersPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/raporlar"
            element={
              <AdminProtectedRoute>
                <AdminReportsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/user/bilgi/:id"
            element={
              <AdminProtectedRoute>
                <AdminUserInfoPage />
              </AdminProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CartProvider>
    </RobotProvider>
  );
}

export default App;
