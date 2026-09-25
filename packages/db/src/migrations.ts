import type { DatabaseSync } from "node:sqlite";

type Migration = {
  id: string;
  up: (db: DatabaseSync) => void;
  down: (db: DatabaseSync) => void;
};

function columnNames(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((column) => column.name);
}

export const migrations: Migration[] = [
  {
    id: "002_display_flags",
    up(db) {
      const columns = columnNames(db, "display_settings");
      if (!columns.includes("always_show_camera")) {
        db.exec("ALTER TABLE display_settings ADD COLUMN always_show_camera INTEGER NOT NULL DEFAULT 0");
      }
      if (!columnNames(db, "display_settings").includes("ams_own_supply")) {
        db.exec("ALTER TABLE display_settings ADD COLUMN ams_own_supply INTEGER NOT NULL DEFAULT 0");
      }
    },
    down(db) {
      const columns = columnNames(db, "display_settings");
      if (columns.includes("ams_own_supply")) db.exec("ALTER TABLE display_settings DROP COLUMN ams_own_supply");
      if (columnNames(db, "display_settings").includes("always_show_camera")) {
        db.exec("ALTER TABLE display_settings DROP COLUMN always_show_camera");
      }
    },
  },
  {
    id: "003_login_failures",
    up(db) {
      db.exec(`CREATE TABLE IF NOT EXISTS login_failures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        at INTEGER NOT NULL
      )`);
      db.exec("CREATE INDEX IF NOT EXISTS login_failures_ip_at ON login_failures(ip, at)");
    },
    down(db) {
      db.exec("DROP TABLE IF EXISTS login_failures");
    },
  },
  {
    id: "004_mediamtx_control",
    up(db) {
      const columns = columnNames(db, "display_settings");
      if (!columns.includes("mediamtx_api_url")) {
        db.exec("ALTER TABLE display_settings ADD COLUMN mediamtx_api_url TEXT NOT NULL DEFAULT ''");
      }
      if (!columnNames(db, "display_settings").includes("mediamtx_path")) {
        db.exec("ALTER TABLE display_settings ADD COLUMN mediamtx_path TEXT NOT NULL DEFAULT 'printercam'");
      }
      if (!columnNames(db, "display_settings").includes("mediamtx_api_user")) {
        db.exec("ALTER TABLE display_settings ADD COLUMN mediamtx_api_user TEXT NOT NULL DEFAULT ''");
      }
      if (!columnNames(db, "display_settings").includes("mediamtx_api_password")) {
        db.exec("ALTER TABLE display_settings ADD COLUMN mediamtx_api_password TEXT NOT NULL DEFAULT ''");
      }
    },
    down(db) {
      for (const column of ["mediamtx_api_password", "mediamtx_api_user", "mediamtx_path", "mediamtx_api_url"]) {
        if (columnNames(db, "display_settings").includes(column)) {
          db.exec(`ALTER TABLE display_settings DROP COLUMN ${column}`);
        }
      }
    },
  },
  {
    id: "005_show_ams_grade",
    up(db) {
      if (!columnNames(db, "display_settings").includes("show_ams_grade")) {
        db.exec("ALTER TABLE display_settings ADD COLUMN show_ams_grade INTEGER NOT NULL DEFAULT 0");
      }
    },
    down(db) {
      if (columnNames(db, "display_settings").includes("show_ams_grade")) {
        db.exec("ALTER TABLE display_settings DROP COLUMN show_ams_grade");
      }
    },
  },
];

export function applyMigrations(db: DatabaseSync, now = Date.now()): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const applied = new Set(
    (db.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]).map((row) => row.id),
  );
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    migration.up(db);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(migration.id, now);
  }
}

export function revertMigration(db: DatabaseSync, id: string): void {
  const migration = migrations.find((item) => item.id === id);
  if (!migration) throw new Error(`Unknown migration ${id}`);
  migration.down(db);
  db.prepare("DELETE FROM schema_migrations WHERE id = ?").run(id);
}
