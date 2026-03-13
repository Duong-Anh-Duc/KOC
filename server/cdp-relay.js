/**
 * CDP Relay — chay tren Windows host de chuyen tiep ket noi CDP tu Docker container.
 *
 * Van de: GemLogin mo Chrome bind 127.0.0.1:PORT (chi chap nhan ket noi local).
 *         Docker container khong the goi 127.0.0.1 cua Windows host.
 *
 * Giai phap: Relay nay listen tren 0.0.0.0:19222 (tat ca interface)
 *            va proxy TCP den 127.0.0.1:TARGET_PORT (Chrome CDP).
 *            Docker container goi host.docker.internal:19222 → relay → Chrome CDP.
 *
 * Usage:
 *   node cdp-relay.js
 *
 * Backend tu dong goi POST http://host.docker.internal:19223/set?port=53624
 * de cap nhat target port khi GemLogin start.
 */

const net = require('net');
const http = require('http');

let targetPort = 0;
const LISTEN_PORT = 19222;   // CDP proxy port (Docker ket noi vao day)
const CONTROL_PORT = 19223;  // HTTP API port (backend goi de cap nhat target)

// ── TCP Proxy ──────────────────────────────────────────────────
const proxy = net.createServer((clientSocket) => {
  if (!targetPort) {
    console.log('[relay] Chua co target port — tu choi ket noi');
    clientSocket.destroy();
    return;
  }

  const serverSocket = net.createConnection({ host: '127.0.0.1', port: targetPort }, () => {
    console.log(`[relay] ${clientSocket.remoteAddress} -> 127.0.0.1:${targetPort}`);
    clientSocket.pipe(serverSocket);
    serverSocket.pipe(clientSocket);
  });

  serverSocket.on('error', (err) => {
    console.log(`[relay] Target error: ${err.message}`);
    clientSocket.destroy();
  });
  clientSocket.on('error', () => serverSocket.destroy());
  clientSocket.on('close', () => serverSocket.destroy());
  serverSocket.on('close', () => clientSocket.destroy());
});

proxy.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`[relay] TCP proxy listening on 0.0.0.0:${LISTEN_PORT}`);
  console.log(`[relay] Control API on http://0.0.0.0:${CONTROL_PORT}`);
  console.log(`[relay] Waiting for target port...`);
});

// ── HTTP Control API ───────────────────────────────────────────
const control = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/set') {
    const port = parseInt(url.searchParams.get('port') || '0', 10);
    if (port > 0 && port < 65536) {
      targetPort = port;
      console.log(`[relay] Target updated: 127.0.0.1:${targetPort}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, target: `127.0.0.1:${targetPort}` }));
    } else {
      res.writeHead(400);
      res.end(JSON.stringify({ ok: false, error: 'Invalid port' }));
    }
    return;
  }

  if (url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, targetPort, listening: LISTEN_PORT }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

control.listen(CONTROL_PORT, '0.0.0.0');
