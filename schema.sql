CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY,
  user_name TEXT DEFAULT 'Bosku',
  ai_name TEXT DEFAULT 'Sohib',
  mode TEXT DEFAULT 'manis',
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT,
  message TEXT,
  timestamp INTEGER
);

INSERT OR IGNORE INTO user_profile (id, user_name, ai_name, mode, updated_at) 
VALUES ('default', 'Kamu', 'Aura', 'manis', 0);
