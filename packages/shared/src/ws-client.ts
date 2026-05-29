const API_HOST = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) || "http://localhost:4000/api";
const WS_URL = API_HOST.replace("/api", "").replace("http://", "ws://").replace("https://", "wss://") + "/ws";

// Simple hook for React apps
export function createWsConnection(onMessage: (type: string, data: any) => void) {
  let ws: WebSocket | null = null;
  let reconnectTimer: any = null;

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) return;
    try {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          onMessage(msg.type, msg.data);
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => { ws?.close(); };
    } catch { /* ignore */ }
  }

  function disconnect() {
    clearTimeout(reconnectTimer);
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
  }

  return { connect, disconnect };
}

// Minimal non-React entry for other frameworks
export function connectWs(callback: (type: string, data: any) => void) {
  const c = createWsConnection(callback);
  c.connect();
  return c;
}