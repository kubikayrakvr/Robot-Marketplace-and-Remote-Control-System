import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';

function ActivateRobotPage() {
  const navigate = useNavigate();
  const { id } = useParams(); // instanceId is not strictly needed for backend but good for reference
  const { activateRobot } = useRobots();
  const [serialNumber, setSerialNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  const handleActivate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await activateRobot(serialNumber.trim());
    if (result.success) {
      setResultMsg(result.message);
      setSuccess(true);
    } else {
      setError(result.message || 'Aktivasyon başarısız');
    }
    setLoading(false);
  };


  if (success) {
    return (
      <div className="user-page">
        <div className="user-shell checkout-success">
          <div className="success-icon">✅</div>
          <h1>Aktivasyon Basarili!</h1>
          <p>{resultMsg}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate('/user/robotlarim')}
          >
            Robotlarıma Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Aktivasyon</p>
            <h1>Robot Tanimlama</h1>
            <p className="user-subtitle">
              Robotunuzu aktifleştirmek için cihazın altındaki seri numarasını girin.
            </p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user/robotlarim')}
            >
              İptal
            </button>
          </div>
        </header>

        <section className="checkout-content">
          <div className="checkout-card activation-card">
            <div className="activation-icon">🤖</div>
            <h3>Robot Aktiflestir</h3>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                color: '#f87171',
                fontSize: '0.9rem',
              }}>
                {error}
              </div>
            )}

            <form className="auth-form" onSubmit={handleActivate}>
              <label>
                Seri Numarası
                <input
                  type="text"
                  placeholder="Örn: RBT-12345"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                className="primary-button full-width"
                disabled={loading}
              >
                {loading ? 'Aktifleştiriliyor...' : 'Aktifleştir'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ActivateRobotPage;
