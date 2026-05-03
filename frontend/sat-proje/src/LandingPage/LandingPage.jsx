import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="logo">ROBOFLEET</div>
        <nav className="landing-nav">
          <Link to="/login" className="text-button">
            Giriş yap
          </Link>
          <Link to="/register" className="primary-button">
            Kayıt ol
          </Link>
        </nav>
      </header>

      <main className="landing-main">
        <section className="hero">
          <h1>Robotunu satin al, etkinlestir ve uzaktan kontrol et.</h1>
          <p>
            Bu platformda magazadan robot satin alabilir, Robotlarim alaninda aktivasyon kodu ile
            dogrulayabilir ve Kontrol panelinden robota komut gonderebilirsin.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="primary-button">
              Hesap Olustur
            </Link>
            <Link to="/login" className="secondary-button">
              Giris Yap
            </Link>
          </div>
        </section>

        <section className="features">
          <div className="feature-card">
            <h2>Magaza</h2>
            <p>Robot modellerini incele, ozellikleri karsilastir ve satin al.</p>
          </div>
          <div className="feature-card">
            <h2>Robotlarim</h2>
            <p>Satin aldigin robotlari gor, aktivasyon kodu ile dogrulama yap.</p>
          </div>
          <div className="feature-card">
            <h2>Kontrol</h2>
            <p>Etkin robotunu uzaktan yonet, komut gonder ve operasyonu anlik takip et.</p>
          </div>
          <div className="feature-card">
            <h2>Bilgilerim</h2>
            <p>Profil, guvenlik ve hesap ayarlarini tek yerden kolayca yonet.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;

