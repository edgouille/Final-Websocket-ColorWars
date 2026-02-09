import type { RemotePlayer, SelfState } from "../../shared/game";

export type TeamInfo = {
  name: string;
  color: string;
};

export type GameClientState = {
  name: string;
  mapSize: number;
  map: number[];
  teams: TeamInfo[];
  players: RemotePlayer[];
  self: SelfState | null;
  connected: boolean;
  error: string;
};
