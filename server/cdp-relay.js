/**
 * CDP Relay — chay tren Windows host de chuyen tiep ket noi CDP tu Docker container.
 *
 * Van de: GemLogin mo Chrome bind 127.0.0.1:PORT (chi chap nhan ket noi local).
 *         Docker container khong the goi 127.0.0.1 cua Windows host.
 *         Chrome CDP kiem tra Host header — chi chap nhan localhost/127.0.0.1.
 *
 * Giai phap: HTTP reverse proxy rewrite Host header + WebSocket proxy cho CDP.
 *            Docker container goi host.docker.internal:19222 → relay (rewrite Host) → Chrome CDP.
 *
 * Usage:
 *   node cdp-relay.js
 *
 * Backend tu dong goi POST http://host.docker.internal:19223/set?port=53624
 * de cap nhat target port khi GemLogin start.
 */

const http = require('http');
const net = require('net');

let targetPort = 0;
const LISTEN_PORT = 19222;   // CDP proxy port (Docker ket noi vao day)
const CONTROL_PORT = 19223;  // HTTP API port (backend goi de cap nhat target)

// ── HTTP Reverse Proxy (rewrite Host header cho Chrome CDP) ─────
const proxy = http.createServer((req, res) => {
  if (!targetPort) {
    console.log('[relay] Chua co target port — tu choi ket noi');
    res.writeHead(502);
    res.end('No target port configured');
    return;
  }

  console.log(`[relay] HTTP ${req.method} ${req.url} -> 127.0.0.1:${targetPort}`);

  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${targetPort}`,  // Rewrite Host header — Chrome CDP yeu cau localhost
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    console.log(`[relay] HTTP ${req.url} <- ${proxyRes.statusCode}`);
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.log(`[relay] HTTP proxy error: ${err.message}`);
    res.writeHead(502);
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq);
});

// ── WebSocket / Upgrade proxy (cho CDP WebSocket connections) ───
proxy.on('upgrade', (req, clientSocket, head) => {
  if (!targetPort) {
    console.log('[relay] Chua co target port — tu choi WebSocket');
    clientSocket.destroy();
    return;
  }

  console.log(`[relay] WebSocket upgrade ${req.url} -> 127.0.0.1:${targetPort}`);

  const serverSocket = net.createConnection({ host: '127.0.0.1', port: targetPort }, () => {
    // Gui HTTP upgrade request voi Host header da rewrite
    const headers = { ...req.headers, host: `127.0.0.1:${targetPort}` };
    let rawReq = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (const [key, val] of Object.entries(headers)) {
      rawReq += `${key}: ${val}\r\n`;
    }
    rawReq += '\r\n';

    serverSocket.write(rawReq);
    if (head.length > 0) serverSocket.write(head);

    // Pipe 2 chieu
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', (err) => {
    console.log(`[relay] WebSocket target error: ${err.message}`);
    clientSocket.destroy();
  });
  clientSocket.on('error', () => serverSocket.destroy());
  clientSocket.on('close', () => serverSocket.destroy());
  serverSocket.on('close', () => clientSocket.destroy());
});

proxy.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`[relay] HTTP/WebSocket proxy listening on 0.0.0.0:${LISTEN_PORT}`);
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
