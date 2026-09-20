import React from "react";
import ReactDOM from "react-dom/client";
import OsApp from "./os/OsApp.jsx";
import "./design/tokens.css";
import "./design/shell.css";
import "./design/evidence-surfaces.css";
import "./design/graph-command.css";
import "./design/matcher-instrument.css";
import "./profile/visual.css";
import "./profile/meaning.css";
import "./profile/report.css";
import "./research/questionMap.css";
import "./research/workspace.css";
import "./platform/platform.css";
import "./evidence/evidence.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <OsApp />
  </React.StrictMode>
);
