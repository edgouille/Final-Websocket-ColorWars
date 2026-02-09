import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./config.js";
import type { AuthUser } from "./types/auth.js";
import { TEAM_NAMES } from "../shared/game.js";

export function createToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid token");
  }

  const uid = String(decoded.uid ?? "");
  const name = String(decoded.name ?? "");
  const team = String(decoded.team ?? "");
  if (!uid || !name || !team || !TEAM_NAMES.includes(team)) {
    throw new Error("Invalid token payload");
  }

  return { uid, name, team };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
