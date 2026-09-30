// Local preview: static allowlist and streaming proxy to the CA backend.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = __dirname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};
const files = new Set([
  "index.html",
  "styles.css",
  "playful.css",
  "client.css",
  "app.js",
  "api.js",
  "ca-link.js",
  "companion.js",
  "growth-cycle.js",
  "reassessment.js",
  "ui-components.js",
  "playworld.js",
  "talent-data.js",
  "talent-explorer.js",
  "career-data.js",
  "career-explorer.js",
  "riasec.js",
  "island-explorer.js",
  "fingerprint-guide.js",
  "fingerprint.js",
  "fingerprint.css",
  "exploration-v4.css",
  "talents.css",
  "readability.css",
  "exploration-session.js",
]);
http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (pathname.startsWith("/api/v1/")) {
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: Number(process.env.BACKEND_PORT || 8017),
          // 本地浏览器回归可选用另一个本机网卡地址，隔离共享开发库的短信 IP 限流。
          localAddress: process.env.E2E_PROXY_SOURCE_IP || undefined,
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            host: `127.0.0.1:${process.env.BACKEND_PORT || 8017}`,
          },
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.on("error", () => {
        if (!res.headersSent)
          res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            code: "BACKEND_UNAVAILABLE",
            message: "服务暂时无法连接，请稍后重试。",
          }),
        );
      });
      req.on("aborted", () => upstream.destroy());
      req.pipe(upstream);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    const name = pathname === "/" ? "index.html" : pathname.slice(1);
    if (
      !files.has(name) &&
      !/^assets\/(?:(?:islands|dingdong|generated|fingerprints)\/)?[a-zA-Z0-9_-]+\.(svg|png|webp)$/.test(
        name,
      )
    ) {
      res.writeHead(404).end();
      return;
    }
    fs.readFile(path.join(root, name), (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(name)],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    });
  })
  .listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
    console.log(
      `DingDong 家长端：http://127.0.0.1:${process.env.PORT || 4173}`,
    ),
  );
