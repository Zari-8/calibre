export function MetricBar({ label, value, pulse=false }: { label:string; value:number; pulse?:boolean }) {
  return (
    <div style={{margin:'13px 0'}}>
      <div className="metric"><span>{label}</span><strong>{value}</strong></div>
      {pulse ? <div className="pulse" style={{'--w': `${value}%`} as React.CSSProperties}><span /></div>
             : <div className="bar"><div className="fill" style={{'--w': `${value}%`} as React.CSSProperties}/></div>}
    </div>
  );
}
