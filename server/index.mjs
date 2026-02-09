import "dotenv/config";
import crypto from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { initDb, run, get } from "./db.mjs";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const MAP_SIZE = 50;
const TEAM_COLORS = ["blue", "green", "red", "purple"];
const MAX_MOVES = 5;
const REGEN_MS = 2_000;
const DIR_VECTORS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const map = new Int8Array(MAP_SIZE * MAP_SIZE).fill(-1);
const playersBySocket = new Map();
const occupied = new Map();

app.use(cors());
app.use(express.json());

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/register", async (req, res) => {
  const { name, password, team } = req.body || {};

  if (!name || !password || !team) {
    return res.status(400).json({ error: "name, password and team required" });
  }

  try {
    const uid = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO users (uid, name, team, password_hash) VALUES (?, ?, ?, ?)",
      [uid, name, team, passwordHash],
    );

    const user = { uid, name, team };
    const token = createToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    if (String(err).includes("SQLITE_CONSTRAINT")) {
      return res.status(409).json({ error: "name already exists" });
    }
    return res.status(500).json({ error: "server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { name, password } = req.body || {};

  if (!name || !password) {
    return res.status(400).json({ error: "name and password required" });
  }

  try {
    const userRow = await get(
      "SELECT uid, name, team, password_hash FROM users WHERE name = ?",
      [name],
    );

    if (!userRow) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(password, userRow.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const user = { uid: userRow.uid, name: userRow.name, team: userRow.team };
    const token = createToken(user);
    return res.json({ user, token });
  } catch (err) {
    return res.status(500).json({ error: "server error" });
  }
});

app.get("/api/me", authMiddleware, async (req, res) => {
  return res.json({ user: req.user });
});

function toIndex(x, y) {
  return y * MAP_SIZE + x;
}

function isInBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;
}

function pickLeastPopulatedTeam() {
  const counts = [0, 0, 0, 0];
  for (const player of playersBySocket.values()) {
    counts[player.teamIndex] += 1;
  }

  let minIndex = 0;
  let minCount = counts[0];
  for (let i = 1; i < counts.length; i += 1) {
    if (counts[i] < minCount) {
      minCount = counts[i];
      minIndex = i;
    }
  }

  return minIndex;
}

function randomFreePosition() {
  const max = MAP_SIZE * MAP_SIZE;
  if (occupied.size >= max) {
    return null;
  }

  for (let i = 0; i < 5000; i += 1) {
    const x = Math.floor(Math.random() * MAP_SIZE);
    const y = Math.floor(Math.random() * MAP_SIZE);
    const index = toIndex(x, y);
    if (!occupied.has(index)) {
      return { x, y };
    }
  }

  for (let index = 0; index < max; index += 1) {
    if (!occupied.has(index)) {
      return { x: index % MAP_SIZE, y: Math.floor(index / MAP_SIZE) };
    }
  }

  return null;
}

function publicPlayers() {
  return Array.from(playersBySocket.values()).map((player) => ({
    id: player.socketId,
    teamIndex: player.teamIndex,
    x: player.x,
    y: player.y,
  }));
}

function updateRegen(player, now = Date.now()) {
  if (player.moves >= MAX_MOVES) {
    return false;
  }

  const elapsed = now - player.lastRegenAt;
  const gained = Math.floor(elapsed / REGEN_MS);
  if (gained <= 0) {
    return false;
  }

  const nextMoves = Math.min(MAX_MOVES, player.moves + gained);
  player.moves = nextMoves;
  player.lastRegenAt += gained * REGEN_MS;
  if (player.moves >= MAX_MOVES) {
    player.lastRegenAt = now;
  }

  return true;
}

function msToNextMove(player, now = Date.now()) {
  if (player.moves >= MAX_MOVES) {
    return 0;
  }

  const elapsed = now - player.lastRegenAt;
  return Math.max(0, REGEN_MS - elapsed);
}

function selfPayload(player, now = Date.now()) {
  return {
    id: player.socketId,
    teamIndex: player.teamIndex,
    x: player.x,
    y: player.y,
    moves: player.moves,
    msToNextMove: msToNextMove(player, now),
  };
}

function sendSelf(io, socketId) {
  const player = playersBySocket.get(socketId);
  if (!player) {
    return;
  }
  io.to(socketId).emit("game:self", { self: selfPayload(player) });
}

function broadcastPlayers(io) {
  io.emit("game:players", { players: publicPlayers() });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    next(new Error("Missing token"));
    return;
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    socket.user = user;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const teamIndex = pickLeastPopulatedTeam();
  const position = randomFreePosition();

  if (!position) {
    socket.emit("game:reject", { reason: "Map is full" });
    socket.disconnect(true);
    return;
  }

  const index = toIndex(position.x, position.y);
  const player = {
    socketId: socket.id,
    uid: socket.user.uid,
    name: socket.user.name,
    teamIndex,
    x: position.x,
    y: position.y,
    moves: MAX_MOVES,
    lastRegenAt: Date.now(),
  };

  playersBySocket.set(socket.id, player);
  occupied.set(index, socket.id);
  map[index] = teamIndex;

  socket.emit("game:init", {
    mapSize: MAP_SIZE,
    map: Array.from(map),
    teams: TEAM_COLORS.map((color, idx) => ({ name: `Team ${idx + 1}`, color })),
    players: publicPlayers(),
    self: selfPayload(player),
  });

  socket.broadcast.emit("game:patch", {
    painted: { x: position.x, y: position.y, teamIndex },
    players: publicPlayers(),
  });

  socket.on("game:move", (direction) => {
    const current = playersBySocket.get(socket.id);
    if (!current) {
      return;
    }

    const vector = DIR_VECTORS[direction];
    if (!vector) {
      socket.emit("game:reject", { reason: "Invalid direction" });
      return;
    }

    const now = Date.now();
    updateRegen(current, now);

    if (current.moves <= 0) {
      socket.emit("game:reject", { reason: "No moves available" });
      sendSelf(io, socket.id);
      return;
    }

    const nextX = current.x + vector[0];
    const nextY = current.y + vector[1];

    if (!isInBounds(nextX, nextY)) {
      socket.emit("game:reject", { reason: "Out of bounds" });
      sendSelf(io, socket.id);
      return;
    }

    const nextIndex = toIndex(nextX, nextY);
    if (occupied.has(nextIndex)) {
      socket.emit("game:reject", { reason: "Pixel occupied" });
      sendSelf(io, socket.id);
      return;
    }

    occupied.delete(toIndex(current.x, current.y));
    occupied.set(nextIndex, socket.id);

    const wasAtMax = current.moves >= MAX_MOVES;
    current.x = nextX;
    current.y = nextY;
    current.moves -= 1;
    if (wasAtMax) {
      current.lastRegenAt = now;
    }

    map[nextIndex] = current.teamIndex;

    io.emit("game:patch", {
      painted: { x: nextX, y: nextY, teamIndex: current.teamIndex },
      players: publicPlayers(),
    });
    sendSelf(io, socket.id);
  });

  socket.on("disconnect", () => {
    const current = playersBySocket.get(socket.id);
    if (!current) {
      return;
    }

    occupied.delete(toIndex(current.x, current.y));
    playersBySocket.delete(socket.id);
    broadcastPlayers(io);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const player of playersBySocket.values()) {
    const changed = updateRegen(player, now);
    if (changed || player.moves < MAX_MOVES) {
      io.to(player.socketId).emit("game:self", { self: selfPayload(player, now) });
    }
  }
}, 1000);

await initDb();
httpServer.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`API + Socket.IO listening on http://0.0.0.0:${PORT}`);
});
