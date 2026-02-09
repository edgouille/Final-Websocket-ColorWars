import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { authMiddleware, createToken } from "../auth.js";
import { get, run, type UserRow } from "../db.js";
import type { LoginBody, RegisterBody } from "../types/auth.js";

export function createAuthRouter(): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  router.post("/register", async (req, res) => {
    const { name, password, team } = (req.body ?? {}) as RegisterBody;

    if (!name || !password || !team) {
      res.status(400).json({ error: "name, password and team required" });
      return;
    }

    try {
      const uid = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);
      await run("INSERT INTO users (uid, name, team, password_hash) VALUES (?, ?, ?, ?)", [
        uid,
        name,
        team,
        passwordHash,
      ]);

      const user = { uid, name, team };
      const token = createToken(user);
      res.status(201).json({ user, token });
    } catch (err) {
      if (String(err).includes("SQLITE_CONSTRAINT")) {
        res.status(409).json({ error: "name already exists" });
        return;
      }
      res.status(500).json({ error: "server error" });
    }
  });

  router.post("/login", async (req, res) => {
    const { name, password } = (req.body ?? {}) as LoginBody;

    if (!name || !password) {
      res.status(400).json({ error: "name and password required" });
      return;
    }

    try {
      const userRow = await get<UserRow>(
        "SELECT uid, name, team, password_hash FROM users WHERE name = ?",
        [name],
      );
      if (!userRow) {
        res.status(401).json({ error: "invalid credentials" });
        return;
      }

      const passwordOk = await bcrypt.compare(password, userRow.password_hash);
      if (!passwordOk) {
        res.status(401).json({ error: "invalid credentials" });
        return;
      }

      const user = { uid: userRow.uid, name: userRow.name, team: userRow.team };
      const token = createToken(user);
      res.json({ user, token });
    } catch {
      res.status(500).json({ error: "server error" });
    }
  });

  router.get("/me", authMiddleware, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
