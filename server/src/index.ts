import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { attachRealtime } from "./realtime/index.js";

const app = createApp();
const server = createServer(app);

attachRealtime(server);

server.listen(config.port, () => {
  console.log(
    `solence-api listening on http://localhost:${config.port} (ws on /ws)`
  );
});
