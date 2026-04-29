import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOrders } from '../api/userApi';

function MyRobotsPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders()
      .then((data) => {
        setOrders(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Siparişlerden robot ürünlerini çıkar
  const purchasedItems = orders.flatMap((order) =>
    (order.items || []).map((item) => ({
      orderId: order.id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      orderDate: order.created_at,
      status: order.status,
    }))
  );

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Envanter</p>
            <h1>Robotlarim</h1>
            <p className="user-subtitle">
              Satin aldiginiz robotlari goruntuleyin ve aktivasyon kodu ile aktiflestirin.
            </p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate('/user/robotlarim/tanimla/new')}
            >
              🤖 Robot Aktiflestir
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user')}
            >
              Panele Don
            </button>
          </div>
        </header>

        <section className="inventory-content">
          {loading ? (
            <div className="empty-cart">
              <div className="empty-icon">⏳</div>
              <h2>Yukleniyor...</h2>
            </div>
          ) : error ? (
            <div className="empty-cart">
              <div className="empty-icon">❌</div>
              <h2>Hata</h2>
              <p>{error}</p>
            </div>
          ) : purchasedItems.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon">📦</div>
              <h2>Henuz hic siparisiniz yok.</h2>
              <p>Magazaya giderek ilk robotunuzu satin alabilirsiniz.</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => navigate('/user/shop')}
              >
                Magazaya Git
              </button>
            </div>
          ) : (
            <div className="robots-grid">
              {purchasedItems.map((item, index) => (
                <div
                  key={`${item.orderId}-${item.productId}-${index}`}
                  className="inventory-card status-active"
                  onClick={() => navigate('/user/robotlarim/tanimla/new')}
                >
                  <div className="inventory-icon">🤖</div>
                  <div className="inventory-details">
                    <h3>{item.productName}</h3>
                    <p className="inventory-badge">
                      Adet: {item.quantity} · Siparis #{item.orderId}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                      {new Date(item.orderDate).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  <div className="inventory-action">Aktiflestir ➔</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default MyRobotsPage;
