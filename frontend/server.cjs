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
};
const files = new Set([
  "index.html",
  "styles.css",
  "playful.css",
  "client.css",
  "app.js",
  "api.js",
  "ca-link.js",
  "playworld.js",
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
          port: 8017,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: "127.0.0.1:8017" },
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
      !/^assets\/(?:islands\/)?[a-z0-9_-]+\.(svg|png)$/.test(name)
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
  .listen(4173, "127.0.0.1", () =>
    console.log("DingDong 家长端：http://127.0.0.1:4173"),
  );
