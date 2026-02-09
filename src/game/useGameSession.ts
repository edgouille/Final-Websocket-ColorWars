import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
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
  SelfUpdatePayload,
} from "../../shared/game";
import { clearToken, getMe } from "../lib/api";
import type { GameClientState } from "./types";

const initialState: GameClientState = {
  name: "",
  userTeam: "",
  mapSize: 200,
  map: [],
  teams: [],
  players: [],
  self: null,
  connected: false,
  error: "",
  chatGeneral: [],
  chatTeam: [],
};

export function useGameSession(token: string | null): {
  state: GameClientState;
  emitMove: (direction: Direction) => void;
  sendChat: (payload: ChatSendPayload) => void;
  sendTeamChat: (payload: TeamChatSendPayload) => void;
} {
  const [state, setState] = useState<GameClientState>(initialState);
  const socketRef = useRef<Socket | null>(null);
  const mapSizeRef = useRef(200);
  const errorTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    getMe(token)
      .then((res) => {
        setState((prev) => ({ ...prev, name: res.user.name, userTeam: res.user.team }));
      })
      .catch(() => {
        clearToken();
        window.location.href = "/login";
      });
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const isViteDev = window.location.port === "5173";
    const socketUrl = isViteDev
      ? `${window.location.protocol}//${window.location.hostname}:4000`
      : undefined;
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setState((prev) => ({ ...prev, connected: true, error: "" }));
    });

    socket.on("disconnect", () => {
      setState((prev) => ({ ...prev, connected: false }));
    });

    socket.on("connect_error", (err: Error) => {
      setState((prev) => ({ ...prev, error: err.message || "Connection failed" }));
    });

    socket.on("game:init", (payload: GameInitPayload) => {
      mapSizeRef.current = payload.mapSize;
      setState((prev) => ({
        ...prev,
        mapSize: payload.mapSize,
        map: payload.map,
        teams: payload.teams.map((team) => ({ name: team.name, color: team.color })),
        players: payload.players,
        self: payload.self,
        error: "",
      }));
    });

    socket.on("game:patch", (payload: GamePatchPayload) => {
      setState((prev) => {
        if (prev.map.length === 0) {
          return {
            ...prev,
            map: payload.map ?? prev.map,
            players: payload.players,
            error: "",
          };
        }

        const nextMap = payload.map ? [...payload.map] : [...prev.map];
        if (!payload.map) {
          const index = payload.painted.y * mapSizeRef.current + payload.painted.x;
          nextMap[index] = payload.painted.teamIndex;
        }

        return {
          ...prev,
          map: nextMap,
          players: payload.players,
          error: "",
        };
      });
    });

    socket.on("game:players", (payload: PlayersPayload) => {
      setState((prev) => ({ ...prev, players: payload.players }));
    });

    socket.on("game:self", (payload: SelfUpdatePayload) => {
      setState((prev) => ({ ...prev, self: payload.self, error: "" }));
    });

    socket.on("chat:history", (payload: ChatHistoryPayload) => {
      setState((prev) => ({ ...prev, chatGeneral: payload.messages }));
    });

    socket.on("chat:message", (payload: ChatMessagePayload) => {
      setState((prev) => ({ ...prev, chatGeneral: [...prev.chatGeneral, payload.message] }));
    });

    socket.on("chat:team:history", (payload: TeamChatHistoryPayload) => {
      setState((prev) => ({ ...prev, chatTeam: payload.messages }));
    });

    socket.on("chat:team:message", (payload: TeamChatMessagePayload) => {
      setState((prev) => ({ ...prev, chatTeam: [...prev.chatTeam, payload.message] }));
    });

    socket.on("game:reject", (payload: { reason: string }) => {
      if (payload.reason === "No moves available") {
        return;
      }
      setState((prev) => ({ ...prev, error: payload.reason }));
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = window.setTimeout(() => {
        setState((prev) => ({ ...prev, error: "" }));
        errorTimeoutRef.current = null;
      }, 1500);
    });

    return () => {
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const emitMove = useCallback((direction: Direction): void => {
    socketRef.current?.emit("game:move", direction);
  }, []);

  const sendChat = useCallback((payload: ChatSendPayload): void => {
    socketRef.current?.emit("chat:send", payload);
  }, []);

  const sendTeamChat = useCallback((payload: TeamChatSendPayload): void => {
    socketRef.current?.emit("chat:team:send", payload);
  }, []);

  return { state, emitMove, sendChat, sendTeamChat };
}
