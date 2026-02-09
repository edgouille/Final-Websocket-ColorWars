# Final Websocket ColorWars

Petit projet React + TypeScript avec un backend Node/Express + Socket.IO et une base SQLite locale.

## Prérequis
- Node.js 18+
- npm

## Installation
```bash
npm install
```

## Lancer en dev
Terminal 1 (API + Socket.IO) :
```bash
npm run server
```

Terminal 2 (frontend Vite) :
```bash
npm run dev
```

Frontend : `http://localhost:5173`  
API : `http://localhost:4000`

## Fonctionnalités
- Auth register/login avec mot de passe hashé (bcrypt)
- JWT (Authorization: Bearer)
- DB SQLite locale
- Game temps réel via Socket.IO
- Chat général + chat d’équipe

## Variables d’environnement
Copie `server/.env.example` en `server/.env` et ajuste :
```
PORT=4000
JWT_SECRET=change-me
```

## Routes API
- `POST /api/register` `{ name, password, team }`
- `POST /api/login` `{ name, password }`
- `GET /api/me` (auth)
- `GET /api/health`

## Notes
- La DB est stockée dans `server/data.sqlite` (ignorée par git).
- Le proxy Vite est configuré pour `/api` vers `http://localhost:4000`.
