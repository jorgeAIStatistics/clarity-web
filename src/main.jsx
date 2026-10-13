import React from "react";
import ReactDOM from "react-dom/client";
// Tokens first, then primitives: everything downstream styles through them.
import "./design/tokens.css";
import "./design/base.css";
import "./design/shell.css";
import Clarity from "./Clarity.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Clarity />
  </React.StrictMode>
);
