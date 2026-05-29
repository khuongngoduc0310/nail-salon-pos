// Store connected clients
const clients = new Set<any>();

export function addClient(ws: any): void {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
}

export function broadcast(type: string, data: unknown): void {
  const message = JSON.stringify({ type, data, ts: new Date().toISOString() });
  for (const ws of clients) {
    if (ws.readyState === 1) { // OPEN = 1
      ws.send(message);
    }
  }
}
