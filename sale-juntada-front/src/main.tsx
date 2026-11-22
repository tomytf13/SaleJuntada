import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { MotionProvider } from "./motion/MotionProvider";
import { AuthProvider } from "./auth/AuthContext";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";
import "./premium.css";
import "./invitation.css";

navigator.serviceWorker?.addEventListener("message", (event) => {
  if (event.data?.type !== "sale-juntada-reminder") return;
  const port = event.ports[0];
  if (!port || document.visibilityState !== "visible") { port?.postMessage(false); return; }
  void new Audio("/aviso-mate.wav").play().then(() => port.postMessage(true), () => port.postMessage(false));
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MotionProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </MotionProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
