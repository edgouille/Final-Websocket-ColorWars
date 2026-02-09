import "dotenv/config";
import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { HOST, PORT } from "./config.js";
import { initDb } from "./db.js";
import { registerGameSocket } from "./game/socket.js";
import { createAuthRouter } from "./routes/authRoutes.js";

async function start(): Promise<void> {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/api", createAuthRouter());

  const httpServer = createServer(app);
  registerGameSocket(httpServer);

  await initDb();
  httpServer.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`API + Socket.IO listening on http://${HOST}:${PORT}`);
  });
}

void start();
