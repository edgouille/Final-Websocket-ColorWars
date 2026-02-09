import {
  MAP_SIZE,
  MAX_MOVES,
  MOVE_REGEN_MS,
  TEAMS,
  type Direction,
  type GameInitPayload,
  type RemotePlayer,
  type SelfState,
  type TeamIndex,
} from "../../shared/game.js";
import type { AuthUser } from "../types/auth.js";

type PlayerState = {
  socketId: string;
  uid: string;
  name: string;
  teamIndex: TeamIndex;
  x: number;
  y: number;
  moves: number;
  lastRegenAt: number;
};

type MoveResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      painted: { x: number; y: number; teamIndex: TeamIndex };
      players: RemotePlayer[];
      self: SelfState;
      map?: number[];
    };

const DIRECTION_VECTORS: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export class GameState {
  private readonly map: Int16Array = new Int16Array(MAP_SIZE * MAP_SIZE).fill(-1);
  private readonly playersBySocket = new Map<string, PlayerState>();
  private readonly playersByUid = new Map<string, PlayerState>();
  private readonly occupiedByIndex = new Map<number, string>();

  private toIndex(x: number, y: number): number {
    return y * MAP_SIZE + x;
  }

  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;
  }

  private pickLeastPopulatedTeam(): TeamIndex {
    const teamCounts = [0, 0, 0, 0];
    for (const player of this.playersBySocket.values()) {
      teamCounts[player.teamIndex] += 1;
    }

    let minIndex = 0;
    for (let i = 1; i < teamCounts.length; i += 1) {
      if (teamCounts[i] < teamCounts[minIndex]) {
        minIndex = i;
      }
    }
    return minIndex as TeamIndex;
  }

  private teamIndexFromName(name: string): TeamIndex | null {
    const index = TEAMS.findIndex((team) => team.name === name);
    if (index < 0) {
      return null;
    }
    return index as TeamIndex;
  }

  private randomFreePosition(): { x: number; y: number } | null {
    const max = MAP_SIZE * MAP_SIZE;
    if (this.occupiedByIndex.size >= max) {
      return null;
    }

    for (let i = 0; i < 5000; i += 1) {
      const x = Math.floor(Math.random() * MAP_SIZE);
      const y = Math.floor(Math.random() * MAP_SIZE);
      if (!this.occupiedByIndex.has(this.toIndex(x, y))) {
        return { x, y };
      }
    }

    for (let index = 0; index < max; index += 1) {
      if (!this.occupiedByIndex.has(index)) {
        return { x: index % MAP_SIZE, y: Math.floor(index / MAP_SIZE) };
      }
    }

    return null;
  }

  private updateRegen(player: PlayerState, now = Date.now()): boolean {
    if (player.moves >= MAX_MOVES) {
      return false;
    }

    const elapsed = now - player.lastRegenAt;
    const gained = Math.floor(elapsed / MOVE_REGEN_MS);
    if (gained <= 0) {
      return false;
    }

    player.moves = Math.min(MAX_MOVES, player.moves + gained);
    player.lastRegenAt += gained * MOVE_REGEN_MS;
    if (player.moves >= MAX_MOVES) {
      player.lastRegenAt = now;
    }

    return true;
  }

  private msToNextMove(player: PlayerState, now = Date.now()): number {
    if (player.moves >= MAX_MOVES) {
      return 0;
    }
    return Math.max(0, MOVE_REGEN_MS - (now - player.lastRegenAt));
  }

  private fillCapturedAreas(teamIndex: TeamIndex): boolean {
    const size = MAP_SIZE;
    const total = size * size;
    const reachable = new Uint8Array(total);
    const queue: number[] = [];

    const tryEnqueue = (index: number): void => {
      if (reachable[index] === 1 || this.map[index] === teamIndex) {
        return;
      }
      reachable[index] = 1;
      queue.push(index);
    };

    for (let x = 0; x < size; x += 1) {
      tryEnqueue(x);
      tryEnqueue((size - 1) * size + x);
    }
    for (let y = 0; y < size; y += 1) {
      tryEnqueue(y * size);
      tryEnqueue(y * size + (size - 1));
    }

    let cursor = 0;
    while (cursor < queue.length) {
      const index = queue[cursor];
      cursor += 1;

      const x = index % size;
      const y = Math.floor(index / size);
      if (x > 0) {
        tryEnqueue(index - 1);
      }
      if (x < size - 1) {
        tryEnqueue(index + 1);
      }
      if (y > 0) {
        tryEnqueue(index - size);
      }
      if (y < size - 1) {
        tryEnqueue(index + size);
      }
      if (x > 0 && y > 0) {
        tryEnqueue(index - size - 1);
      }
      if (x < size - 1 && y > 0) {
        tryEnqueue(index - size + 1);
      }
      if (x > 0 && y < size - 1) {
        tryEnqueue(index + size - 1);
      }
      if (x < size - 1 && y < size - 1) {
        tryEnqueue(index + size + 1);
      }
    }

    let changed = false;
    for (let i = 0; i < total; i += 1) {
      if (this.map[i] !== teamIndex && reachable[i] === 0) {
        this.map[i] = teamIndex;
        changed = true;
      }
    }

    return changed;
  }

  private toSelfState(player: PlayerState, now = Date.now()): SelfState {
    return {
      id: player.socketId,
      teamIndex: player.teamIndex,
      x: player.x,
      y: player.y,
      moves: player.moves,
      msToNextMove: this.msToNextMove(player, now),
    };
  }

  public getPublicPlayers(): RemotePlayer[] {
    return Array.from(this.playersBySocket.values()).map((player) => ({
      id: player.socketId,
      teamIndex: player.teamIndex,
      x: player.x,
      y: player.y,
    }));
  }

  public connectPlayer(
    socketId: string,
    user: AuthUser,
  ):
    | { kind: "spawn"; init: GameInitPayload; painted: { x: number; y: number; teamIndex: TeamIndex } }
    | { kind: "reconnect"; init: GameInitPayload }
    | null {
    const existing = this.playersByUid.get(user.uid);
    if (existing) {
      this.playersBySocket.delete(existing.socketId);
      existing.socketId = socketId;
      this.playersBySocket.set(socketId, existing);

      return {
        kind: "reconnect",
        init: {
          mapSize: MAP_SIZE,
          map: Array.from(this.map),
          teams: TEAMS,
          players: this.getPublicPlayers(),
          self: this.toSelfState(existing),
        },
      };
    }

    const preferredTeam = this.teamIndexFromName(user.team);
    const teamIndex = preferredTeam ?? this.pickLeastPopulatedTeam();
    const position = this.randomFreePosition();
    if (!position) {
      return null;
    }

    const spawnIndex = this.toIndex(position.x, position.y);
    const player: PlayerState = {
      socketId,
      uid: user.uid,
      name: user.name,
      teamIndex,
      x: position.x,
      y: position.y,
      moves: MAX_MOVES,
      lastRegenAt: Date.now(),
    };

    this.playersBySocket.set(socketId, player);
    this.playersByUid.set(user.uid, player);
    this.occupiedByIndex.set(spawnIndex, socketId);
    this.map[spawnIndex] = teamIndex;

    return {
      kind: "spawn",
      init: {
        mapSize: MAP_SIZE,
        map: Array.from(this.map),
        teams: TEAMS,
        players: this.getPublicPlayers(),
        self: this.toSelfState(player),
      },
      painted: { x: position.x, y: position.y, teamIndex },
    };
  }

  public removePlayer(socketId: string): boolean {
    const player = this.playersBySocket.get(socketId);
    if (!player) {
      return false;
    }

    this.occupiedByIndex.delete(this.toIndex(player.x, player.y));
    this.playersBySocket.delete(socketId);
    this.playersByUid.delete(player.uid);
    return true;
  }

  public move(socketId: string, direction: Direction): MoveResult {
    const player = this.playersBySocket.get(socketId);
    if (!player) {
      return { ok: false, reason: "Player not found" };
    }

    const now = Date.now();
    this.updateRegen(player, now);

    if (player.moves <= 0) {
      return { ok: false, reason: "No moves available" };
    }

    const [dx, dy] = DIRECTION_VECTORS[direction];
    const nextX = player.x + dx;
    const nextY = player.y + dy;

    if (!this.isInBounds(nextX, nextY)) {
      return { ok: false, reason: "Out of bounds" };
    }

    const nextIndex = this.toIndex(nextX, nextY);
    if (this.occupiedByIndex.has(nextIndex)) {
      return { ok: false, reason: "Pixel occupied" };
    }

    this.occupiedByIndex.delete(this.toIndex(player.x, player.y));
    this.occupiedByIndex.set(nextIndex, socketId);

    const wasAtMax = player.moves >= MAX_MOVES;
    player.x = nextX;
    player.y = nextY;
    player.moves -= 1;
    if (wasAtMax) {
      player.lastRegenAt = now;
    }

    this.map[nextIndex] = player.teamIndex;
    const captured = this.fillCapturedAreas(player.teamIndex);
    return {
      ok: true,
      painted: { x: nextX, y: nextY, teamIndex: player.teamIndex },
      players: this.getPublicPlayers(),
      self: this.toSelfState(player, now),
      map: captured ? Array.from(this.map) : undefined,
    };
  }

  public getSelfState(socketId: string): SelfState | null {
    const player = this.playersBySocket.get(socketId);
    if (!player) {
      return null;
    }
    return this.toSelfState(player);
  }

  public tickRegen(now = Date.now()): Array<{ socketId: string; self: SelfState }> {
    const updates: Array<{ socketId: string; self: SelfState }> = [];
    for (const player of this.playersBySocket.values()) {
      const changed = this.updateRegen(player, now);
      if (changed || player.moves < MAX_MOVES) {
        updates.push({
          socketId: player.socketId,
          self: this.toSelfState(player, now),
        });
      }
    }
    return updates;
  }
}
