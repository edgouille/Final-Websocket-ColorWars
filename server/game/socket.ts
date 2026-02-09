import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import type {
  Direction,
  GameInitPayload,
  GamePatchPayload,
  PlayersPayload,
  RejectPayload,
  SelfUpdatePayload,
} from "../../shared/game.js";
import { verifyToken } from "../auth.js";
import type { AuthUser } from "../types/auth.js";
import { GameState } from "./state.js";

type ServerToClientEvents = {
  "game:init": (payload: GameInitPayload) => void;
  "game:patch": (payload: GamePatchPayload) => void;
  "game:players": (payload: PlayersPayload) => void;
  "game:self": (payload: SelfUpdatePayload) => void;
  "game:reject": (payload: RejectPayload) => void;
};

type ClientToServerEvents = {
  "game:move": (direction: Direction) => void;
};

type SocketData = {
  user: AuthUser;
};

export function registerGameSocket(httpServer: HttpServer): void {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    {
      cors: { origin: "*" },
    },
  );
  const game = new GameState();
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  io.use((socket, next) => {
    const token = String(socket.handshake.auth?.token ?? "");
    if (!token) {
      next(new Error("Missing token"));
      return;
    }

    try {
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const uid = socket.data.user.uid;
    const pending = disconnectTimers.get(uid);
    if (pending) {
      clearTimeout(pending);
      disconnectTimers.delete(uid);
    }

    handleConnection(io, game, socket, disconnectTimers);
  });

  setInterval(() => {
    const updates = game.tickRegen();
    for (const update of updates) {
      io.to(update.socketId).emit("game:self", { self: update.self });
    }
  }, 1000);
}

function handleConnection(
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
  game: GameState,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>,
): void {
  const joined = game.connectPlayer(socket.id, socket.data.user);
  if (!joined) {
    socket.emit("game:reject", { reason: "Map is full" });
    socket.disconnect(true);
    return;
  }

  socket.emit("game:init", joined.init);
  if (joined.kind === "spawn") {
    socket.broadcast.emit("game:patch", {
      painted: joined.painted,
      players: game.getPublicPlayers(),
    });
  } else {
    io.emit("game:players", { players: game.getPublicPlayers() });
  }

  socket.on("game:move", (direction) => {
    const result = game.move(socket.id, direction);
    if (!result.ok) {
      socket.emit("game:reject", { reason: result.reason });
      const self = game.getSelfState(socket.id);
      if (self) {
        socket.emit("game:self", { self });
      }
      return;
    }

    io.emit("game:patch", {
      painted: result.painted,
      players: result.players,
      map: result.map,
    });
    socket.emit("game:self", { self: result.self });
  });

  socket.on("disconnect", () => {
    const uid = socket.data.user.uid;
    const existingTimer = disconnectTimers.get(uid);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      disconnectTimers.delete(uid);
      const removed = game.removePlayer(socket.id);
      if (!removed) {
        return;
      }
      io.emit("game:players", { players: game.getPublicPlayers() });
    }, 3000);

    disconnectTimers.set(uid, timer);
  });
}
