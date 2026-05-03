import { useState, useEffect } from 'react';

export default function RobotPackages({ packages = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [packages]);

  const activePackage = packages[activeIndex] || {};

  return (
    <section id="packages" className="robot-packages-section">
      <div className="section-header">
        <p className="section-eyebrow">PACKAGES</p>
        <h2>Customize your deployment</h2>
      </div>
      <div className="package-tabs">
        {packages.map((pkg, index) => (
          <button
            type="button"
            key={pkg.name}
            className={`package-tab ${activeIndex === index ? 'active' : ''}`}
            onClick={() => setActiveIndex(index)}
          >
            {pkg.name}
          </button>
        ))}
      </div>
      <div className="package-detail">
        {activePackage.image ? (
          <img src={activePackage.image} alt={activePackage.name} />
        ) : (
          <div className="package-placeholder">{activePackage.name}</div>
        )}
        <div className="package-description">
          <h3>{activePackage.name}</h3>
          <p>{activePackage.description}</p>
        </div>
      </div>
    </section>
  );
}
