import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, isAbsolute, normalize, relative, resolve, sep } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", "http://localhost");
  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = normalize(requestedPath);
  const filePath = resolve(root, "." + safePath);
  const relativePath = relative(root, filePath);
  const pathSegments = relativePath.split(sep).filter(Boolean);
  let fileStat;

  if (
    !safePath.startsWith("/") ||
    isAbsolute(relativePath) ||
    relativePath.startsWith("..") ||
    pathSegments.some((segment) => segment.startsWith("."))
  ) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  try {
    fileStat = statSync(filePath);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  if (!fileStat.isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
  });
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    }
    res.end("Unable to read file");
  });
  stream.pipe(res);
}).listen(port, host, () => {
  console.log(`ThreadScope running at http://${host}:${port}`);
});
