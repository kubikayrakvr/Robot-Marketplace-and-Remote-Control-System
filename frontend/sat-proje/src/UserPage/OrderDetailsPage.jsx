import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchOrderById } from '../api/userApi';

function OrderDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadOrder() {
      try {
        const data = await fetchOrderById(id);
        setOrder(data);
      } catch (err) {
        setError(err.message || 'Sipariş detayı alınamadı.');
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [id]);

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Sipariş Detayı</p>
            <h1>Sipariş #{id}</h1>
          </div>
          <div className="user-meta">
            <button className="secondary-button" onClick={() => navigate('/user/siparislerim')}>
              ← Siparişlere Dön
            </button>
          </div>
        </header>

        <section className="inventory-content">
          {loading ? (
            <p>Sipariş detayları yükleniyor...</p>
          ) : error ? (
            <div className="empty-cart">
              <div className="empty-icon">⚠️</div>
              <h2>Bir Hata Oluştu</h2>
              <p>{error}</p>
            </div>
          ) : !order ? (
            <div className="empty-cart">
              <p>Sipariş bulunamadı.</p>
            </div>
          ) : (
            <div className="order-details-container" style={{ background: '#2a2a2a', padding: '2rem', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #444', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Sipariş Tarihi</h3>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#ccc' }}>{new Date(order.created_at).toLocaleString('tr-TR')}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ margin: 0 }}>Durum</h3>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#ccc' }}>{order.status}</p>
                </div>
              </div>
              
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Teslimat Adresi</h3>
                <p style={{ color: '#ccc', lineHeight: '1.5' }}>{order.address}</p>
              </div>

              <div>
                <h3 style={{ marginBottom: '1rem' }}>Sipariş Özeti</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {order.items && order.items.map((item) => (
                    <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed #444' }}>
                      <span>{item.quantity}x {item.product?.name || `Ürün #${item.product_id}`}</span>
                      <span>₺{item.price_at_time.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  <span>Toplam</span>
                  <span>₺{order.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default OrderDetailsPage;
