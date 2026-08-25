import {lazy, StrictMode, Suspense} from "react";
import {createRoot} from "react-dom/client";

import App from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element was not found");

const root = createRoot(rootElement);
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID?.trim();
const demoRequested = new URLSearchParams(globalThis.location.search).get("demo") === "1";
const LiveRoot = lazy(() => import("./LiveRoot"));

root.render(
  <StrictMode>
    {privyAppId && !demoRequested ? (
      <Suspense fallback={<div className="boot-screen">Preparing wallet security…</div>}>
        <LiveRoot appId={privyAppId} />
      </Suspense>
    ) : (
      <App
        wallet={null}
        authenticated={false}
        demo
        onConnect={() => globalThis.alert("Add VITE_PRIVY_APP_ID to .env to enable Privy wallet login.")}
        onDisconnect={() => undefined}
      />
    )}
  </StrictMode>,
);
