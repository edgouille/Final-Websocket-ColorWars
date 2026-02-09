import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { initDb, run, get } from "./db.mjs";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

app.use(cors({ origin: true, credentials: true }));
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

await initDb();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});
