import { randomUUID } from "node:crypto";
import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import type {
  ChatHistoryPayload,
  ChatMessagePayload,
  ChatSendPayload,
  TeamChatHistoryPayload,
  TeamChatMessagePayload,
  TeamChatSendPayload,
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
  "chat:message": (payload: ChatMessagePayload) => void;
  "chat:history": (payload: ChatHistoryPayload) => void;
  "chat:team:message": (payload: TeamChatMessagePayload) => void;
  "chat:team:history": (payload: TeamChatHistoryPayload) => void;
};

type ClientToServerEvents = {
  "game:move": (direction: Direction) => void;
  "chat:send": (payload: ChatSendPayload) => void;
  "chat:team:send": (payload: TeamChatSendPayload) => void;
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
  const chatMessages: ChatHistoryPayload["messages"] = [];
  const teamChatMessages = new Map<string, TeamChatHistoryPayload["messages"]>();
  const maxChatMessages = 100;

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
    handleConnection(io, game, socket, chatMessages, teamChatMessages, maxChatMessages);
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
  chatMessages: ChatHistoryPayload["messages"],
  teamChatMessages: Map<string, TeamChatHistoryPayload["messages"]>,
  maxChatMessages: number,
): void {
  const joined = game.addPlayer(socket.id, socket.data.user);
  if (!joined) {
    socket.emit("game:reject", { reason: "Map is full" });
    socket.disconnect(true);
    return;
  }

  socket.emit("game:init", joined.init);
  socket.broadcast.emit("game:patch", {
    painted: joined.painted,
    players: game.getPublicPlayers(),
  });
  socket.emit("chat:history", { messages: chatMessages });

  const teamRoom = getTeamRoom(socket.data.user.team);
  socket.join(teamRoom);
  const teamMessages = getTeamBuffer(teamChatMessages, teamRoom);
  socket.emit("chat:team:history", { messages: teamMessages });

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
    });
    socket.emit("game:self", { self: result.self });
  });

  socket.on("chat:send", (payload) => {
    const text = payload.text.trim();
    if (!text) {
      return;
    }

    const message = {
      id: randomUUID(),
      user: {
        id: socket.data.user.uid,
        name: socket.data.user.name,
        team: socket.data.user.team,
      },
      text: text.slice(0, 280),
      createdAt: Date.now(),
    };

    chatMessages.push(message);
    if (chatMessages.length > maxChatMessages) {
      chatMessages.splice(0, chatMessages.length - maxChatMessages);
    }

    io.emit("chat:message", { message });
  });

  socket.on("chat:team:send", (payload) => {
    const text = payload.text.trim();
    if (!text) {
      return;
    }

    const message = {
      id: randomUUID(),
      user: {
        id: socket.data.user.uid,
        name: socket.data.user.name,
        team: socket.data.user.team,
      },
      text: text.slice(0, 280),
      createdAt: Date.now(),
    };

    const teamMessages = getTeamBuffer(teamChatMessages, teamRoom);
    teamMessages.push(message);
    if (teamMessages.length > maxChatMessages) {
      teamMessages.splice(0, teamMessages.length - maxChatMessages);
    }

    io.to(teamRoom).emit("chat:team:message", { message });
  });

  socket.on("disconnect", () => {
    const removed = game.removePlayer(socket.id);
    if (!removed) {
      return;
    }
    io.emit("game:players", { players: game.getPublicPlayers() });
  });
}

function getTeamRoom(team: string): string {
  return `team:${team}`;
}

function getTeamBuffer(
  teamChatMessages: Map<string, TeamChatHistoryPayload["messages"]>,
  teamRoom: string,
): TeamChatHistoryPayload["messages"] {
  const existing = teamChatMessages.get(teamRoom);
  if (existing) {
    return existing;
  }
  const created: TeamChatHistoryPayload["messages"] = [];
  teamChatMessages.set(teamRoom, created);
  return created;
}
