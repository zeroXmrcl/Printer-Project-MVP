import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = import.meta.dirname;
const port = Number(process.env.STUDY_PORT || 4317);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const target = path.join(root, path.normalize(pathname));
  if (!target.startsWith(root)) {
    response.writeHead(404);
    response.end("not found");
    return;
  }
  fs.readFile(target, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": types[path.extname(target)] ?? "text/plain" });
    response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`study http://127.0.0.1:${port}`);
});
