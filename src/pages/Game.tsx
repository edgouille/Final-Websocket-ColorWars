import { useEffect, useMemo, useRef } from "react";
import { drawGame } from "../game/drawGame";
import { keyToDirection } from "../game/keybindings";
import { useGameSession } from "../game/useGameSession";
import { getToken } from "../lib/api";

export default function Game() {
  const token = getToken();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, emitMove } = useGameSession(token);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || state.map.length === 0 || state.teams.length === 0) {
      return;
    }

    drawGame(canvas, state.mapSize, state.map, state.teams, state.players, state.self);
  }, [state]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      const direction = keyToDirection(event.key);
      if (!direction) {
        return;
      }

      event.preventDefault();
      emitMove(direction);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [emitMove]);

  const selfTeamColor = useMemo(() => {
    if (!state.self) {
      return "#999999";
    }
    return state.teams[state.self.teamIndex]?.color ?? "#999999";
  }, [state.self, state.teams]);

  if (!token) {
    return null;
  }

  return (
    <main className="game-layout">
      <header className="game-header">
        <h1>ColorWars</h1>
        <p>
          Player: <strong>{state.name || "..."}</strong> | Status:{" "}
          <strong>{state.connected ? "connected" : "disconnected"}</strong>
        </p>
        {state.self && (
          <p>
            Team color: <strong style={{ color: selfTeamColor }}>{state.teams[state.self.teamIndex]?.name}</strong>{" "}
            | Moves: <strong>{state.self.moves}/5</strong> | Regen:{" "}
            <strong>{Math.ceil(state.self.msToNextMove / 1000)}s</strong>
          </p>
        )}
        <p>Controls: arrows + ZQSD</p>
        {state.error && <p className="error">{state.error}</p>}
      </header>
      <section className="canvas-wrap">
        <canvas ref={canvasRef} className="game-canvas" />
      </section>
    </main>
  );
}
