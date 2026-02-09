import type { RemotePlayer, SelfState } from "../../shared/game";
import type { TeamInfo } from "./types";

const CELL_SIZE = 3;
const UNPAINTED_COLOR = "#f3f4f6";

export function drawGame(
  canvas: HTMLCanvasElement,
  mapSize: number,
  map: number[],
  teams: TeamInfo[],
  players: RemotePlayer[],
  self: SelfState | null,
): void {
  const width = mapSize * CELL_SIZE;
  const height = mapSize * CELL_SIZE;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.fillStyle = UNPAINTED_COLOR;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < map.length; i += 1) {
    const teamIndex = map[i];
    if (teamIndex < 0) {
      continue;
    }

    const team = teams[teamIndex];
    if (!team) {
      continue;
    }

    const x = i % mapSize;
    const y = Math.floor(i / mapSize);
    ctx.fillStyle = team.color;
    ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  }

  for (const player of players) {
    const x = player.x * CELL_SIZE;
    const y = player.y * CELL_SIZE;
    ctx.fillStyle = "#111111";
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
  }

  if (!self) {
    return;
  }

  const x = self.x * CELL_SIZE;
  const y = self.y * CELL_SIZE;
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + CELL_SIZE, y);
  ctx.lineTo(x, y + CELL_SIZE);
  ctx.closePath();
  ctx.fill();
}
