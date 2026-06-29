"use client";

import { useEffect, useState } from "react";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlB64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Renders nothing unless web push is configured (VAPID key) AND supported by the browser.
export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!VAPID || typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  if (!VAPID || !supported) return null;

  async function toggle() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setSubscribed(false);
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(VAPID as string),
        });
        const json = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
        setSubscribed(true);
      }
    } catch {
      /* permission denied / unsupported — leave state as-is */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-2 flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">Push notifications</span>
        <span className="block text-xs text-muted">PRs, streak alerts and social activity on this device.</span>
      </span>
      <button
        onClick={toggle}
        disabled={busy}
        className={`${subscribed ? "btn-surface" : "btn-accent"} px-3 py-1.5 text-xs disabled:opacity-60`}
      >
        {busy ? "…" : subscribed ? "Disable" : "Enable"}
      </button>
    </div>
  );
}
