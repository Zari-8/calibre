import React from "react";
import { Search, Globe2, Crown } from "lucide-react";

const links = [
  ["/", "Home"],
  ["/debates", "Debates"],
  ["/players", "Players"],
  ["/competitions", "Competitions"],
  ["/talents", "Talents"],
  ["/system-fit", "System Fit"]
];

export default function Navbar({ activePath }) {
  return (
    <nav className="nav">
      <a className="logo" href="/">
        <div className="logoMark">C</div>
        <div>
          <div className="logoWord">CALIBRE</div>
          <div className="logoSub">FOOTBALL INTELLIGENCE</div>
        </div>
      </a>

      <div className="navLinks">
        {links.map(([href, label]) => (
          <a key={href} className={activePath === href ? "active" : ""} href={href}>{label}</a>
        ))}
      </div>

      <div className="navActions">
        <button className="roundButton"><Search size={18} /></button>
        <button className="ghostButton"><Globe2 size={15} /> English ▾</button>
        <button className="ghostButton">Log in</button>
        <button className="founderButton"><Crown size={15} /> Get World Cup Founder Pass</button>
      </div>
    </nav>
  );
}
