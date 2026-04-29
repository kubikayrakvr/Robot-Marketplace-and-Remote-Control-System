import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activateRobotOnBackend } from '../api/userApi';

function ActivateRobotPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  const handleActivate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await activateRobotOnBackend(code.trim(), nickname.trim());
      setResultMsg(result.message || 'Robot basariyla aktiflesirildi!');
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Aktivasyon basarisiz');
    } finally {
      setLoading(false);
    }
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
            onClick={() => navigate('/user')}
          >
            Panele Don
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
              Robotunuzu kullanmaya baslamak icin kutusundan cikan aktivasyon kodunu ve bir takma ad girin.
            </p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user')}
            >
              Iptal
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
                Aktivasyon Kodu
                <input
                  type="text"
                  placeholder="Kutudaki aktivasyon kodunu girin"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </label>
              <label>
                Robot Takma Adi
                <input
                  type="text"
                  placeholder="Orn: Benim Robotum"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                className="primary-button full-width"
                disabled={loading}
              >
                {loading ? 'Aktiflestiriliyor...' : 'Aktiflestir'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ActivateRobotPage;
