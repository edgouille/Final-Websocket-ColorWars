export const MAP_SIZE = 50;
export const MAX_MOVES = 5;
export const MOVE_REGEN_MS = 500;
export const TEAMS = [
  { name: "Blue", color: "#2563eb" },
  { name: "Green", color: "#16a34a" },
  { name: "Red", color: "#dc2626" },
  { name: "Purple", color: "#9333ea" },
] as const;

export type Direction = "up" | "down" | "left" | "right";

export type TeamIndex = 0 | 1 | 2 | 3;

export type RemotePlayer = {
  id: string;
  teamIndex: TeamIndex;
  x: number;
  y: number;
};

export type SelfState = {
  id: string;
  teamIndex: TeamIndex;
  x: number;
  y: number;
  moves: number;
  msToNextMove: number;
};

export type GameInitPayload = {
  mapSize: number;
  map: number[];
  teams: ReadonlyArray<{ name: string; color: string }>;
  players: RemotePlayer[];
  self: SelfState;
};

export type GamePatchPayload = {
  painted: {
    x: number;
    y: number;
    teamIndex: TeamIndex;
  };
  players: RemotePlayer[];
  map?: number[];
};

export type PlayersPayload = {
  players: RemotePlayer[];
};

export type SelfUpdatePayload = {
  self: SelfState;
};

export type RejectPayload = {
  reason: string;
};
