import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOrders } from '../api/userApi';

function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadOrders() {
      try {
        const data = await fetchOrders();
        setOrders(data);
      } catch (err) {
        setError(err.message || 'Siparişler yüklenemedi.');
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Alışveriş Geçmişi</p>
            <h1>Siparişlerim</h1>
            <p className="user-subtitle">
              Önceki siparişlerinizi ve detaylarını buradan inceleyebilirsiniz.
            </p>
          </div>
          <div className="user-meta">
            <button className="secondary-button" onClick={() => navigate('/user')}>
              Panele Dön
            </button>
          </div>
        </header>

        <section className="inventory-content">
          {loading ? (
            <p>Siparişleriniz yükleniyor...</p>
          ) : error ? (
            <div className="empty-cart">
              <div className="empty-icon">⚠️</div>
              <h2>Bir Hata Oluştu</h2>
              <p>{error}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon">📦</div>
              <h2>Sipariş Bulunamadı</h2>
              <p>Henüz herhangi bir sipariş vermemişsiniz.</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => navigate('/user/shop')}
              >
                Mağazaya Git
              </button>
            </div>
          ) : (
            <div className="robot-grid">
              {orders.map((order) => (
                <div key={order.id} className="robot-card" style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
                  <div className="card-info">
                    <div className="robot-icon">📦</div>
                    <div className="robot-details">
                      <h3>Sipariş #{order.id}</h3>
                      <p>Tarih: {new Date(order.created_at).toLocaleDateString('tr-TR')}</p>
                      <p>Tutar: ₺{order.total_amount.toLocaleString()}</p>
                      <p>Durum: {order.status}</p>
                    </div>
                  </div>
                  <div className="card-actions" style={{ marginTop: '1rem' }}>
                    <button
                      className="secondary-button full-width"
                      onClick={() => navigate(`/user/siparislerim/${order.id}`)}
                    >
                      Detayları Gör
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default OrdersPage;
