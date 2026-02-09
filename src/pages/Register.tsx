import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TEAMS, type TeamName } from "../../shared/game";
import { postJson, saveToken } from "../lib/api";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [team, setTeam] = useState<TeamName>(TEAMS[0].name);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await postJson<{ token: string; user: { uid: string; name: string; team: string } }>(
        "/api/register",
        { name, password, team },
      );
      saveToken(data.token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <h1>Register</h1>
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />
        </label>
        <label className="field">
          <span>Team</span>
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value as TeamName)}
            required
          >
            {TEAMS.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Loading..." : "Register"}
        </button>
      </form>
      <p className="switch">
        Déjà un compte ? <Link to="/login">Login</Link>
      </p>
    </main>
  );
}
