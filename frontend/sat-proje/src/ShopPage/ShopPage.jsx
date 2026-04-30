import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { fetchMarketRobots } from '../api/userApi';

function ShopPage() {
  const navigate = useNavigate();
  const { addToCart, cartItemCount } = useCart();
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    fetchMarketRobots()
      .then((data) => {
        setRobots(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  async function handleAddToCart(robot) {
    try {
      setAddingId(robot.id);
      await addToCart(robot.id, 1);
    } catch (err) {
      alert(err.message || 'Sepete eklenemedi');
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Magaza</p>
            <h1>Robot Modelleri</h1>
            <p className="user-subtitle">
              Ihtiyaciniza en uygun robotu secin ve hemen siparis verin.
            </p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="primary-button cart-button"
              onClick={() => navigate('/user/sepetim')}
            >
              🛒 Sepetim ({cartItemCount})
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user')}
            >
              Geri Don
            </button>
          </div>
        </header>

        {loading && (
          <div className="empty-cart">
            <div className="empty-icon">⏳</div>
            <h2>Yukleniyor...</h2>
          </div>
        )}

        {error && (
          <div className="empty-cart">
            <div className="empty-icon">❌</div>
            <h2>Hata</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <section className="shop-grid">
            {robots.length === 0 ? (
              <div className="empty-cart">
                <div className="empty-icon">📦</div>
                <h2>Henuz magaza bos.</h2>
                <p>Yakin zamanda yeni robot modelleri eklenecek.</p>
              </div>
            ) : (
              robots.map((robot) => (
                <div key={robot.id} className={`product-card ${robot.stock_count === 0 ? 'out-of-stock' : ''}`}>
                  <div className="product-icon">🤖</div>
                  <h3 className="product-title">{robot.name}</h3>
                  <p className="product-desc">
                    {robot.model_type || 'Robot modeli'}
                  </p>
                  <div className="product-stock" style={{ fontSize: '0.85rem', color: robot.stock_count > 0 ? '#10b981' : '#ef4444', marginBottom: '1rem' }}>
                    {robot.stock_count > 0 ? `Stokta ${robot.stock_count} adet var` : 'Stokta yok'}
                  </div>
                  <div className="product-footer">
                    <span className="product-price">
                      {robot.price.toLocaleString('tr-TR')} ₺
                    </span>
                    <button
                      type="button"
                      className={`primary-button add-button ${robot.stock_count === 0 ? 'disabled' : ''}`}
                      onClick={() => handleAddToCart(robot)}
                      disabled={addingId === robot.id || robot.stock_count === 0}
                    >
                      {robot.stock_count === 0 ? 'Stokta Yok' : (addingId === robot.id ? 'Ekleniyor...' : 'Sepete Ekle')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default ShopPage;
