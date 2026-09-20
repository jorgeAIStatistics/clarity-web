import React from "react";

const QUESTIONS = [
  ["gp-q1", "Q1", "Identity"],
  ["gp-q2", "Q2", "Biology"],
  ["gp-q3", "Q3", "Measurement"],
  ["gp-q4", "Q4", "Meaning"],
  ["gp-q5", "Q5", "Utility"],
];

export default function GraphCommand({ items = QUESTIONS }) {
  const jump = (id) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    node.focus?.({ preventScroll: true });
  };
  return (
    <nav className="gp-command" aria-label="Profile questions">
      {items.map(([id, q, label]) => (
        <a key={id} href={`#${id}`} onClick={(event) => { event.preventDefault(); jump(id); }}>
          <em>{q}</em>
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
