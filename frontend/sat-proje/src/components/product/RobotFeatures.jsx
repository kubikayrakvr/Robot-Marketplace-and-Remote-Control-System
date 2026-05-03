export default function RobotFeatures({ features = [] }) {
  return (
    <section id="features" className="robot-features-section">
      <div className="section-header">
        <p className="section-eyebrow">FEATURES</p>
        <h2>Built for demanding missions</h2>
      </div>
      <div className="robot-features-grid">
        {features.map((feature, index) => (
          <div key={index} className="feature-row">
            <div className="feature-title">{feature.title}</div>
            <div className="feature-body">{feature.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
