import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "data.sqlite");
const db = new sqlite3.Database(dbPath);

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export async function initDb() {
  await run(
    `CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      team TEXT NOT NULL,
      password_hash TEXT NOT NULL
    )`,
  );

  const columns = await new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(users)", (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const hasUid = columns.some((c) => c.name === "uid");
  if (!hasUid && columns.length > 0) {
    await run(
      `CREATE TABLE IF NOT EXISTS users_new (
        uid TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        team TEXT NOT NULL,
        password_hash TEXT NOT NULL
      )`,
    );
    await run(
      `INSERT INTO users_new (uid, name, team, password_hash)
       SELECT lower(hex(randomblob(16))), name, 'default', password_hash
       FROM users`,
    );
    await run("DROP TABLE users");
    await run("ALTER TABLE users_new RENAME TO users");
  }
}
