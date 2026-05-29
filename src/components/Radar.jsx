export default function Radar({ items }) {
  return (
    <div className="radar-card">
      <div className="radar-orb">
        {items.map((item, index) => (
          <i key={item.label} style={{ '--angle': `${index * (360 / items.length)}deg`, '--size': `${item.value}%` }} />
        ))}
        <b>86%</b>
      </div>
      <div className="radar-list">
        {items.map((item) => <span key={item.label}>{item.label}<strong>{item.value}</strong></span>)}
      </div>
    </div>
  );
}
