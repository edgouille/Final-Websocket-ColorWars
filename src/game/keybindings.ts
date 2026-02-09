import type { Direction } from "../../shared/game";

export function keyToDirection(key: string): Direction | null {
  const lower = key.toLowerCase();

  if (lower === "arrowup") {
    return "up";
  }
  if (lower === "arrowdown") {
    return "down";
  }
  if (lower === "arrowleft") {
    return "left";
  }
  if (lower === "arrowright") {
    return "right";
  }

  return null;
}
