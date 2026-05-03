export default function TechSpecs({ type, specs = {}, blueprints = [] }) {
  let blueprintItems = blueprints && blueprints.length ? blueprints : [];

  if (blueprintItems.length === 0) {
    blueprintItems = [
      { label: 'Top View' },
      { label: 'Side View' },
      { label: 'Front View' },
    ];
  }

  const renderSpecRow = (label, value) => (
    <div className="tech-spec-row" key={label}>
      <span className="tech-spec-label">{label}</span>
      <span className="tech-spec-value">{value || '—'}</span>
    </div>
  );

  const gridStyle = blueprintItems.length === 1 ? { gridTemplateColumns: '1fr' } : {};

  return (
    <section id="tech-specs" className="robot-tech-specs-section">
      <div className="section-header">
        <p className="section-eyebrow">TECH SPECS</p>
        <h2>Blueprint-grade engineering</h2>
      </div>
      <div className="tech-blueprints" style={gridStyle}>
        {blueprintItems.map((item, index) => (
          <div key={index} className="tech-blueprint-card">
            {item.image ? (
              <img src={item.image} alt={item.label} style={{ objectFit: 'contain', maxHeight: '400px', padding: '20px' }} />
            ) : (
              <div className="blueprint-placeholder">
                <span>{item.label}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="tech-specs-grid">
        <div className="tech-spec-block">
          <h3>SIZE AND WEIGHT</h3>
          {renderSpecRow('Dimensions', specs.dimensions)}
          {renderSpecRow('Weight', specs.weight)}
          {renderSpecRow('Max Payload', specs.maxPayload)}
        </div>
        <div className="tech-spec-block">
          <h3>SPEED AND PERFORMANCE</h3>
          {renderSpecRow('Max Speed', specs.maxSpeed)}
          {renderSpecRow('Run Time', specs.runTime)}
          {renderSpecRow('Battery', specs.battery)}
        </div>
      </div>
    </section>
  );
}
