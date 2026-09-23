# PrintCast

Read-only dashboard for a Bambu Lab P2S on the local network. Three containers share one volume: `web`, `mqtt-ingest`, and `media-worker`. MediaMTX and Cloudflare Tunnel stay outside this compose file.

## Run

```bash
cp .env.example .env
# fill printer IP, serial, access code, and admin values
npm run admin
docker compose up -d --build
```

`npm run admin` prints `ADMIN_PASSWORD_HASH`. The password needs 12 characters. `ADMIN_SESSION_SECRET` needs 32 or more characters. None of that goes in git.

The site binds to `127.0.0.1:3000`. Point the existing tunnel at it, and point a second hostname at MediaMTX HLS. See `docs/mediamtx-path.md`.

Mockups for the five screens are in `docs/mockups/index.html`.

`npm run seed` fills `data/` with a demo print so the pages can be opened without the printer. That folder stays out of git.

There is no printer control in this version. The ingest process only asks the printer for a full status report.
