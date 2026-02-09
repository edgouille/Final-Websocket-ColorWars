import type { TeamName } from "../../shared/game.js";

export type AuthUser = {
  uid: string;
  name: string;
  team: TeamName;
};

export type LoginBody = {
  name?: string;
  password?: string;
};

export type RegisterBody = {
  name?: string;
  password?: string;
  team?: TeamName;
};
