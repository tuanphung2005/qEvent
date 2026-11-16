import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "@/styles/globals.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");

async function bootstrap() {
  // `?mock=1` runs the app against the MSW fixtures — no gateway required.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("mock")) {
    const { worker } = await import("../test/msw/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  createRoot(container as HTMLElement).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
}

void bootstrap();
