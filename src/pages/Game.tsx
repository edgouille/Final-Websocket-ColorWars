import { useEffect, useMemo, useRef } from "react";
import { Leaderboard } from "../game/Leaderboard";
import { drawGame } from "../game/drawGame";
import { keyToDirection } from "../game/keybindings";
import { useGameSession } from "../game/useGameSession";
import { getToken } from "../lib/api";
import Chat from "../components/Chat"; 

export default function Game() {
  const token = getToken();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, emitMove, sendChat, sendTeamChat } = useGameSession(token);

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

  const leaderboardRows = useMemo(() => {
    const paintedByTeam = new Array(state.teams.length).fill(0);
    const playersByTeam = new Array(state.teams.length).fill(0);

    for (const teamIndex of state.map) {
      if (teamIndex >= 0 && teamIndex < paintedByTeam.length) {
        paintedByTeam[teamIndex] += 1;
      }
    }

    for (const player of state.players) {
      if (player.teamIndex >= 0 && player.teamIndex < playersByTeam.length) {
        playersByTeam[player.teamIndex] += 1;
      }
    }

    return state.teams
      .map((team, teamIndex) => ({
        teamIndex,
        team,
        painted: paintedByTeam[teamIndex] ?? 0,
        players: playersByTeam[teamIndex] ?? 0,
      }))
      .sort((a, b) => b.painted - a.painted);
  }, [state.map, state.players, state.teams]);

  if (!token) {
    return null;
  }

  return (
    <>
      <Chat
        generalMessages={state.chatGeneral}
        teamMessages={state.chatTeam}
        isConnected={state.connected}
        onSendGeneral={(text) => sendChat({ text })}
        onSendTeam={(text) => sendTeamChat({ text })}
        teamLabel={state.userTeam}
      />
      <main className="game-layout">
        <section className="game-main">
          <div className="game-left">
            <header className="game-header">
              <h1>ColorWars</h1>
              <p>
                Player: <strong>{state.name || "..."}</strong> | Status:{" "}
                <strong>{state.connected ? "connected" : "disconnected"}</strong>
              </p>
              {state.self && (
                <p>
                  Team color:{" "}
                  <strong style={{ color: selfTeamColor }}>
                    {state.teams[state.self.teamIndex]?.name}
                  </strong>{" "}
                  | Moves: <strong>{state.self.moves}/5</strong> | Regen:{" "}
                  <strong>{Math.ceil(state.self.msToNextMove / 1000)}s</strong>
                </p>
              )}
              <p>Controls: arrows</p>
            </header>
            <div className="canvas-wrap">
              <canvas ref={canvasRef} className="game-canvas" />
            </div>
          </div>
          <Leaderboard rows={leaderboardRows} />
        </section>
      </main>
    </>
  );
}
