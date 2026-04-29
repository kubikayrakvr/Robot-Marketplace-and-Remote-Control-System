import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder } from '../api/userApi';

function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, cartTotal, refreshCart } = useCart();
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const handlePayment = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.target);
    const address = formData.get('address') || 'Belirtilmedi';

    try {
      await createOrder(address);
      setIsSuccess(true);
    } catch (err) {
      setError(err.message || 'Sipariş oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="user-page">
        <div className="user-shell checkout-success">
          <div className="success-icon">✅</div>
          <h1>Odeme Basarili!</h1>
          <p>Siparisiniz alindi. Robotlariniz en kisa surede hesabinizda aktiflesecektir.</p>
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
            <p className="user-eyebrow">Odeme</p>
            <h1>Guvenli Odeme Adimi</h1>
            <p className="user-subtitle">
              Odeme bilgilerinizi girerek siparisinizi tamamlayin.
            </p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user/sepetim')}
            >
              Sepete Don
            </button>
          </div>
        </header>

        <section className="checkout-content">
          <div className="checkout-card">
            <h3>Odeme Bilgileri</h3>
            <p className="checkout-amount">
              Odenecek Tutar: <strong>{cartTotal.toLocaleString('tr-TR')} ₺</strong>
            </p>

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

            <form className="auth-form checkout-form" onSubmit={handlePayment}>
              <label>
                Teslimat Adresi
                <input type="text" name="address" placeholder="Adres giriniz" required />
              </label>
              <label>
                Kart Uzerindeki Isim
                <input type="text" placeholder="Ad Soyad" required />
              </label>
              <label>
                Kart Numarasi
                <input type="text" placeholder="0000 0000 0000 0000" maxLength="19" required />
              </label>
              <div className="form-row">
                <label>
                  Son Kullanma (AA/YY)
                  <input type="text" placeholder="MM/YY" maxLength="5" required />
                </label>
                <label>
                  CVV
                  <input type="text" placeholder="123" maxLength="3" required />
                </label>
              </div>
              <button
                type="submit"
                className="primary-button full-width"
                disabled={loading || cartItems.length === 0}
              >
                {loading ? 'Siparis Isleniyor...' : 'Siparisi Tamamla'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CheckoutPage;
