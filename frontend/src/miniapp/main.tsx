// Telegram Mini Apps for the Servis bots: /app/client/… (mijoz) and /app/master/… (usta).
// A separate Vite entry (miniapp.html) so the ERP bundle and its login never load inside Telegram.
import "./miniapp.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ClientApp } from "./client/ClientApp";
import { MasterApp } from "./master/MasterApp";
import { initTelegram } from "./tg";

initTelegram();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      retry: (n, e) => n < 1 && ![401, 403, 404].includes((e as { response?: { status?: number } }).response?.status ?? 0),
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <Routes>
          <Route path="client/*" element={<ClientApp />} />
          <Route path="master/*" element={<MasterApp />} />
          <Route path="*" element={<Navigate to="/client" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
