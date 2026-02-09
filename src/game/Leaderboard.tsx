import type { TeamInfo } from "./types";

type TeamLeaderboardItem = {
  teamIndex: number;
  team: TeamInfo;
  painted: number;
  players: number;
};

type LeaderboardProps = {
  rows: TeamLeaderboardItem[];
};

export function Leaderboard({ rows }: LeaderboardProps) {
  return (
    <aside className="leaderboard">
      <h2>Leaderboard</h2>
      <ol className="leaderboard-list">
        {rows.map((row, idx) => (
          <li key={row.teamIndex} className="leaderboard-row">
            <span className="leaderboard-rank">#{idx + 1}</span>
            <span className="leaderboard-team" style={{ color: row.team.color }}>
              {row.team.name}
            </span>
            <span className="leaderboard-score">{row.painted} px</span>
            <span className="leaderboard-players">{row.players} players</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
