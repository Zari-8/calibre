export default function Meter({ label, value, detail }) {
  return (
    <div className="meter-row">
      <div className="meter-top"><span>{label}</span><strong>{value}</strong></div>
      <div className="meter-track"><span style={{ width: `${value}%` }} /></div>
      {detail && <small>{detail}</small>}
    </div>
  );
}
