import React from "react";
import ReactDOM from "react-dom/client";
import Clarity from "./Clarity.jsx";
import "./design/tokens.css";
import "./design/shell.css";
import "./design/evidence-surfaces.css";
import "./design/graph-command.css";
import "./design/matcher-instrument.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Clarity />
  </React.StrictMode>
);
