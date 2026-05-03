import { useRef } from 'react';

export default function StickySubNav({ items, activeId }) {
  const navRef = useRef(null);

  return (
    <nav className="robot-subnav" ref={navRef}>
      <div className="robot-subnav-inner">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`subnav-link ${activeId === item.id ? 'active' : ''}`}
            onClick={() => {
              const target = document.getElementById(item.id);
              if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
