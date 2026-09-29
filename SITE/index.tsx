import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import HomePage from "./components/HomePage";
import ErrorBoundary from "./components/ErrorBoundary";
import SemBarbearia from "./components/SemBarbearia";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* A barbearia é o primeiro segmento do caminho (lib/barbearia.ts). */}
          <Route path="/:barbearia" element={<HomePage />} />
          <Route path="/:barbearia/agendar" element={<App />} />
          {/* Sem barbearia no caminho não há o que mostrar, e não há loja padrão:
              cair numa loja escolhida no escuro é o defeito que a API também recusa. */}
          <Route path="*" element={<SemBarbearia />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);