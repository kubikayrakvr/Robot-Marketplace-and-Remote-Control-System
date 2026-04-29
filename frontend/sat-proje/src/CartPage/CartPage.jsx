import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

function CartPage() {
  const navigate = useNavigate();
  const { cartItems, cartTotal, cartItemCount, removeFromCart, refreshCart, loading } = useCart();

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Sepetim</p>
            <h1>Alisveris Sepetiniz</h1>
            <p className="user-subtitle">
              Siparisinizi tamamlamadan once sepetinizi gozden gecirin.
            </p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user/shop')}
            >
              Alisverise Devam Et
            </button>
          </div>
        </header>

        <section className="cart-content">
          {loading ? (
            <div className="empty-cart">
              <div className="empty-icon">⏳</div>
              <h2>Yukleniyor...</h2>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon">🛒</div>
              <h2>Sepetiniz su an bos.</h2>
              <p>Hemen magazamiza gidip yeni robotlar kesfedin.</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => navigate('/user/shop')}
              >
                Magazaya Git
              </button>
            </div>
          ) : (
            <div className="cart-layout">
              <div className="cart-items">
                {cartItems.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-icon">🤖</div>
                    <div className="cart-item-details">
                      <h3>{item.product_name}</h3>
                      <p>Adet: {item.quantity}</p>
                    </div>
                    <div className="cart-item-price">
                      {item.subtotal.toLocaleString('tr-TR')} ₺
                    </div>
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeFromCart(item.id)}
                      title="Sepetten Cikar"
                    >
                      ❌
                    </button>
                  </div>
                ))}
              </div>
              <div className="cart-summary">
                <h3>Siparis Ozeti</h3>
                <div className="summary-row">
                  <span>Ara Toplam</span>
                  <span>{cartTotal.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="summary-row">
                  <span>Kargo</span>
                  <span>Ucretsiz</span>
                </div>
                <div className="summary-divider"></div>
                <div className="summary-row total">
                  <span>Toplam</span>
                  <span>{cartTotal.toLocaleString('tr-TR')} ₺</span>
                </div>
                <button
                  type="button"
                  className="primary-button checkout-button"
                  onClick={() => navigate('/user/odeme')}
                >
                  Odemeye Gec
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default CartPage;
