import React from "react";
import ReactDOM from "react-dom/client";
import "./globals.css";
import { SeasonApp } from "./app/season-app";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><SeasonApp /></React.StrictMode>,
);
