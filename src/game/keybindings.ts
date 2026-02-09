import type { Direction } from "../../shared/game";

export function keyToDirection(key: string): Direction | null {
  const lower = key.toLowerCase();

  if (lower === "arrowup" || lower === "z" || lower === "w") {
    return "up";
  }
  if (lower === "arrowdown" || lower === "s") {
    return "down";
  }
  if (lower === "arrowleft" || lower === "q" || lower === "a") {
    return "left";
  }
  if (lower === "arrowright" || lower === "d") {
    return "right";
  }

  return null;
}
