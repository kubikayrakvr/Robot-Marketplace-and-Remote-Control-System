export default function RobotHero({ name, tagline, heroImage, type, price, stockCount, ctaLabel, onCtaClick }) {
  const backgroundStyle = heroImage
    ? { backgroundImage: `linear-gradient(rgba(2,6,23,0.6), rgba(2,6,23,0.6)), url(${heroImage})` }
    : { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' };

  return (
    <section className="robot-hero" style={backgroundStyle}>
      <div className="robot-hero-inner">
        <p className="robot-hero-eyebrow">{type || 'Autonomous Ground Vehicle'}</p>
        <h1>{name}</h1>
        <p className="robot-hero-tagline">{tagline || 'Unmanned Ground Vehicle'}</p>
        <div className="robot-hero-actions">
          <button
            type="button"
            className="primary-button hero-cta"
            onClick={onCtaClick}
            disabled={stockCount === 0}
          >
            {ctaLabel}
          </button>
        </div>
        <div className="robot-hero-meta">
          <span>{stockCount > 0 ? `Stokta ${stockCount}` : 'Stokta yok'}</span>
          <span>{price != null ? `${price.toLocaleString('tr-TR')} ₺` : ''}</span>
        </div>
      </div>
    </section>
  );
}
