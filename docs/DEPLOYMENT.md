# Simulation server deployment

## Local

Use Node 24 LTS and pnpm 11.25.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @rift/server start
```

Default bind: `127.0.0.1:3001`. Health probe: `GET /health`. The installed desktop uses this address by default. For two local clients, run the application again with `--second-client`; this gives it a separate settings/session directory.

## Hosted

The shared server is **https://rifttimers-server.onrender.com**. Enter this URL in **General Settings** on every player's desktop app, then create/join a room in **Multiplayer**. This is a free Render service in Oregon, with one instance and automatic deployments disabled.

The service was created directly through Render, so its Dashboard configuration is authoritative; `render.yaml` is a template for creating another deployment, not a linked Blueprint for this existing service. The current service uses Render's default TCP health probe. Its application health endpoint is `/health`.

To verify the public service from the repository, run `node scripts/remote-smoke.mjs https://rifttimers-server.onrender.com`. This checks HTTPS health, creates a temporary room, connects two WebSocket clients, verifies timer start/reset synchronization, and disconnects both clients.

### Free Render setup

Use [Deploy to Render](https://render.com/deploy?repo=https://github.com/mohidansari124/RiftTimers) and sign in to your Render account. The repository's `render.yaml` defines one free Node web service, builds only the server and its shared dependency, and configures the bind address, Electron origin and health check. Review the free plan and deploy. No database is needed.

After Render reports the service live, copy its actual HTTPS URL into RiftTimers **General Settings** on each computer. Check `https://YOUR-SERVICE.onrender.com/health`, then create and join a room to verify synchronization. The deployment URL is assigned by Render; do not assume the service name is available.

Free services sleep after 15 minutes without inbound traffic and can take about a minute to wake up. Rooms are lost on sleep/restart, so create a fresh room afterward. Auto-deploy is disabled; deploy new versions manually from Render. See [Render's free-service limitations](https://render.com/docs/free).

### Other hosts

Deploy this repository to a Node-capable host supporting persistent WebSocket connections. Build with `pnpm install --frozen-lockfile && pnpm build`; start with `node apps/server/dist/index.js`. Keep installed production dependencies available. Set `HOST=0.0.0.0`, `PORT` to the host's assigned port, and configure a public HTTPS endpoint with WebSocket upgrades. Set `ALLOWED_ORIGINS=null` for the packaged Electron renderer; include explicit browser development origins only if needed.

The client requires HTTPS for non-loopback servers. In General Settings, enter your hosted HTTPS URL, create a simulation room, and share the code with a friend using the same server URL and application release. No home router port forwarding is required. The v0.1.2 installer still defaults to localhost; set the hosted URL explicitly.

## Operations

- Run one process/replica. Rooms are ephemeral; a restart loses rooms. Clients should leave and create a new room after restart.
- Use TLS, a reverse proxy, and infrastructure connection/request limits. Application rate limiting is 100 acknowledged events per 10 seconds per peer IP; behind a proxy that address may be shared. Do not blindly trust forwarded IP headers.
- Maximum event payload is 16 KiB. Names, commands, lineup and room mode are validated. There are no server secrets in the desktop bundle.
- Rooms have no account authentication; anyone with the invitation code can join and change timers. Keep codes private. This is a prototype service, not an Internet-scale hardened deployment.
- Socket.IO pings every 15 seconds and times out after 10 seconds without a response. Reconnection restores state while the room still exists.
- Do not deploy or promote this as a live-match tool. Review `COMPLIANCE.md` before any public distribution.
