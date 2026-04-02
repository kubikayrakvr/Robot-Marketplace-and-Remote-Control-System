import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './LandingPage/LandingPage';
import RegisterPage from './RegisterPage/RegisterPage';
import LoginPage from './LoginPage/LoginPage';
import UserPage from './UserPage/UserPage';
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;