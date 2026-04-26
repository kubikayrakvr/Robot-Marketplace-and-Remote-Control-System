import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const DUMMY_ROBOTS = [
  {
    id: 'r1',
    name: 'AeroBot X1',
    description: 'Hizli ve cevik gozlem robotu. Kapali alanlarda yuksek manevra kabiliyeti.',
    price: 1200,
    icon: '🚁',
  },
  {
    id: 'r2',
    name: 'TerraCrawler V2',
    description: 'Zorlu arazi kosullari icin paletli kesif araci. Yuksek torklu motorlar.',
    price: 3400,
    icon: '🚜',
  },
  {
    id: 'r3',
    name: 'AquaDrone Pro',
    description: 'Sualti haritalama ve inceleme amacli otonom dalgic robot.',
    price: 5500,
    icon: '🚤',
  },
  {
    id: 'r4',
    name: 'Sentinel Biped',
    description: 'Iki ayakli devriye ve guvenlik robotu. Yapay zeka destekli goruntu isleme.',
    price: 8900,
    icon: '🤖',
  },
];

function ShopPage() {
  const navigate = useNavigate();
  const { addToCart, cartItemCount } = useCart();

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

        <section className="shop-grid">
          {DUMMY_ROBOTS.map((robot) => (
            <div key={robot.id} className="product-card">
              <div className="product-icon">{robot.icon}</div>
              <h3 className="product-title">{robot.name}</h3>
              <p className="product-desc">{robot.description}</p>
              <div className="product-footer">
                <span className="product-price">${robot.price}</span>
                <button
                  type="button"
                  className="primary-button add-button"
                  onClick={() => addToCart(robot)}
                >
                  Sepete Ekle
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export default ShopPage;
