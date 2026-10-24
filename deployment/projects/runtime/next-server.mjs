import { createServer } from "node:http";
import next from "next";
const app = next({
  dev: true,
  dir: "/work/frontend",
  hostname: "127.0.0.1",
  port: 4173,
  webpack: true,
  turbopack: false,
});
const handle = app.getRequestHandler();
await app.prepare();
const server = createServer((req, res) => handle(req, res));
server.on("upgrade", (req, socket, head) =>
  app.getUpgradeHandler()(req, socket, head),
);
server.listen(4173, "127.0.0.1", () => console.log("Next.js ready on :4173"));
