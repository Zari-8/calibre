import React from "react";

export default function PageHeader({ eyebrow, title, copy, children }) {
  return (
    <header className="pageHeader">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {children}
    </header>
  );
}
