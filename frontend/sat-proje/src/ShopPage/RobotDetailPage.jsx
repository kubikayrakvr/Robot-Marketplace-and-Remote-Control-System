import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { fetchRobotDetail } from '../api/userApi';
import RobotHero from '../components/product/RobotHero';
import StickySubNav from '../components/product/StickySubNav';
import RobotFeatures from '../components/product/RobotFeatures';
import TechSpecs from '../components/product/TechSpecs';
import RobotPackages from '../components/product/RobotPackages';

function RobotDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [robot, setRobot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRobotDetail(id)
      .then((data) => setRobot(data))
      .catch((err) => setError(err.message || 'Detaylar alınamadı.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!robot) return;

    const sectionIds = ['overview', 'features', 'tech-specs', 'packages', 'gallery'];
    const sections = sectionIds
      .map((section) => document.getElementById(section))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: [0.2, 0.6] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [robot]);

  const handleAddToCart = async () => {
    if (!robot || robot.stock_count === 0) return;
    try {
      setAdding(true);
      await addToCart(robot.id, 1);
      navigate('/user/sepetim');
    } catch (err) {
      alert(err.message || 'Sepete eklenirken hata oluştu.');
    } finally {
      setAdding(false);
    }
  };

  const navItems = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'features', label: 'FEATURES' },
    { id: 'tech-specs', label: 'TECH SPECS' },
    { id: 'packages', label: 'PACKAGES' },
    { id: 'gallery', label: 'GALLERY' },
  ];

  if (loading) {
    return (
      <div className="user-page">
        <div className="user-shell">
          <div className="empty-cart">
            <div className="empty-icon">⏳</div>
            <h2>Yükleniyor...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (error || !robot) {
    return (
      <div className="user-page">
        <div className="user-shell">
          <div className="empty-cart">
            <div className="empty-icon">❌</div>
            <h2>Robot bulunamadı</h2>
            <p>{error || 'Bu robot için detay bulunamadı.'}</p>
            <button type="button" className="secondary-button" onClick={() => navigate('/user/shop')}>
              Mağazaya dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="robot-detail-page">
      <button className="back-button" onClick={() => navigate('/user/shop')}>
        ← Back to Shop
      </button>

      <RobotHero
        name={robot.name}
        tagline={robot.tagline}
        type={robot.type}
        heroImage={robot.hero_image}
        price={robot.price}
        stockCount={robot.stock_count}
        ctaLabel={robot.stock_count > 0 ? (adding ? 'Ekleniyor...' : 'SEPETE EKLE') : 'STOKTA YOK'}
        onCtaClick={handleAddToCart}
      />

      <StickySubNav items={navItems} activeId={activeSection} />

      <main className="robot-detail-shell">
        <section id="overview" className="robot-overview-section">
          <div className="section-header">
            <p className="section-eyebrow">OVERVIEW</p>
            <h2>{robot.description}</h2>
          </div>
          <div className="overview-metrics">
            <div>
              <span className="metric-label">Model</span>
              <p>{robot.type}</p>
            </div>
            <div>
              <span className="metric-label">Fiyat</span>
              <p>{robot.price.toLocaleString('tr-TR')} ₺</p>
            </div>
            <div>
              <span className="metric-label">Stok</span>
              <p>{robot.stock_count > 0 ? `${robot.stock_count} adet` : 'Tükendi'}</p>
            </div>
          </div>
        </section>

        <RobotFeatures features={robot.features} />

        <TechSpecs type={robot.type} specs={robot.specs} blueprints={robot.blueprints} />

        <RobotPackages packages={robot.packages} />

        <section id="gallery" className="robot-gallery-section">
          <div className="section-header">
            <p className="section-eyebrow">GALLERY</p>
            <h2>Robotun yaşam alanı</h2>
          </div>
          <div className="gallery-grid">
            {(robot.gallery || []).map((image, index) => (
              <div key={index} className="gallery-item">
                <img src={image} alt={`${robot.name} galeri ${index + 1}`} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default RobotDetailPage;
