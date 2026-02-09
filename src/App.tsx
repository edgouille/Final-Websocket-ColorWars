import type { ReactElement } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { clearToken, getToken } from "./lib/api";
import Game from "./pages/Game";
import Login from "./pages/Login";
import Register from "./pages/Register";

function Home() {
  const token = getToken();

  if (token) {
    return <Navigate to="/game" replace />;
  }

  return (
    <main className="home">
      <Link to="/login" className="connect-btn">
        Connecte
      </Link>
    </main>
  );
}

function RequireAuth({ children }: { children: ReactElement }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function Logout() {
  clearToken();
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/game"
        element={
          <RequireAuth>
            <Game />
          </RequireAuth>
        }
      />
      <Route path="/logout" element={<Logout />} />
    </Routes>
  );
}
