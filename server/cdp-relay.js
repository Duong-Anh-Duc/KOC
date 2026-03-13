/**
 * CDP Relay — chay tren Windows host de chuyen tiep ket noi CDP tu Docker container.
 *
 * Van de:
 *   1. GemLogin mo Chrome bind 127.0.0.1:PORT → Docker khong ket noi duoc.
 *   2. Chrome CDP kiem tra Host header — chi chap nhan localhost/127.0.0.1.
 *   3. /json/version tra ve webSocketDebuggerUrl: "ws://127.0.0.1:PORT/..."
 *      → Playwright ket noi truc tiep ws://127.0.0.1:PORT → Docker ECONNREFUSED.
 *
 * Giai phap: HTTP reverse proxy + WebSocket proxy:
 *   - Rewrite Host header (Docker → Chrome chap nhan)
 *   - Rewrite response body cua /json/* (thay 127.0.0.1:PORT → relay address)
 *   - Proxy WebSocket connections cho CDP protocol
 *
 * Usage:
 *   node cdp-relay.js
 */

const http = require('http');
const net = require('net');

let targetPort = 0;
const LISTEN_PORT = 19222;   // CDP proxy port (Docker ket noi vao day)
const CONTROL_PORT = 19223;  // HTTP API port (backend goi de cap nhat target)

// ── HTTP Reverse Proxy ──────────────────────────────────────────
const proxy = http.createServer((req, res) => {
  if (!targetPort) {
    console.log('[relay] Chua co target port — tu choi ket noi');
    res.writeHead(502);
    res.end('No target port configured');
    return;
  }

  const isJsonEndpoint = req.url.startsWith('/json');
  console.log(`[relay] HTTP ${req.method} ${req.url} -> 127.0.0.1:${targetPort}${isJsonEndpoint ? ' (rewrite response)' : ''}`);

  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${targetPort}`,  // Chrome CDP yeu cau Host = localhost
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Neu la /json/* endpoint → buffer response va rewrite URLs
    if (isJsonEndpoint) {
      const chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(chunk));
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf-8');

        // Lay hostname tu request Host header (Docker gui host.docker.internal:19222)
        const clientHost = (req.headers.host || '').split(':')[0] || 'host.docker.internal';

        // Rewrite ws://127.0.0.1:PORT va ws://localhost:PORT → ws://CLIENT_HOST:RELAY_PORT
        // Playwright se ket noi WebSocket qua relay thay vi truc tiep Chrome
        body = body.replace(
          /ws:\/\/(127\.0\.0\.1|localhost):\d+/g,
          `ws://${clientHost}:${LISTEN_PORT}`
        );
        // Cung rewrite http:// URLs trong response
        body = body.replace(
          /http:\/\/(127\.0\.0\.1|localhost):\d+/g,
          `http://${clientHost}:${LISTEN_PORT}`
        );

        console.log(`[relay] HTTP ${req.url} <- ${proxyRes.statusCode} (rewritten, host=${clientHost})`);

        const headers = { ...proxyRes.headers };
        headers['content-length'] = Buffer.byteLength(body).toString();
        // Cho phep CORS
        headers['access-control-allow-origin'] = '*';

        res.writeHead(proxyRes.statusCode, headers);
        res.end(body);
      });
    } else {
      console.log(`[relay] HTTP ${req.url} <- ${proxyRes.statusCode}`);
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  });

  proxyReq.on('error', (err) => {
    console.log(`[relay] HTTP proxy error: ${err.message}`);
    res.writeHead(502);
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq);
});

// ── WebSocket / Upgrade proxy (cho CDP WebSocket connections) ───
// Dung raw TCP pipe de dam bao khong corrupt WebSocket frames.
proxy.on('upgrade', (req, clientSocket, head) => {
  if (!targetPort) {
    console.log('[relay] Chua co target port — tu choi WebSocket');
    clientSocket.destroy();
    return;
  }

  console.log(`[relay] WebSocket upgrade ${req.url} -> 127.0.0.1:${targetPort}`);

  const serverSocket = net.createConnection({ host: '127.0.0.1', port: targetPort }, () => {
    // Gui HTTP upgrade request voi Host header da rewrite
    const headers = Object.assign({}, req.headers, { host: `127.0.0.1:${targetPort}` });
    let rawReq = `GET ${req.url} HTTP/1.1\r\n`;
    for (const [key, val] of Object.entries(headers)) {
      if (typeof val === 'string') {
        rawReq += `${key}: ${val}\r\n`;
      } else if (Array.isArray(val)) {
        for (const v of val) rawReq += `${key}: ${v}\r\n`;
      }
    }
    rawReq += '\r\n';

    serverSocket.write(rawReq);
    if (head && head.length > 0) serverSocket.write(head);

    // Pipe 2 chieu ngay lap tuc — KHONG parse response
    // Chrome gui 101 Switching Protocols → Playwright nhan truc tiep
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);

    console.log(`[relay] WebSocket piped for ${req.url}`);
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
  console.log(`[relay] Response URLs auto-rewritten based on client Host header`);
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
