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

Deploy this repository to a Node-capable host supporting persistent WebSocket connections. Build with `pnpm install --frozen-lockfile && pnpm build`; start with `node apps/server/dist/index.js`. Keep installed production dependencies available. Set `HOST=0.0.0.0`, `PORT` to the host's assigned port, and configure a public HTTPS endpoint with WebSocket upgrades. Set `ALLOWED_ORIGINS=null` for the packaged Electron renderer; include explicit browser development origins only if needed.

The client requires HTTPS for non-loopback servers. In General Settings, enter your hosted HTTPS URL, create a simulation room, and share the code with a friend using the same server URL and application release. No home router port forwarding is required. Hosting is not provisioned by this project and no public server is bundled.

## Operations

- Run one process/replica. Rooms are ephemeral; a restart loses rooms. Clients should leave and create a new room after restart.
- Use TLS, a reverse proxy, and infrastructure connection/request limits. Application rate limiting is 100 acknowledged events per 10 seconds per peer IP; behind a proxy that address may be shared. Do not blindly trust forwarded IP headers.
- Maximum event payload is 16 KiB. Names, commands, lineup and room mode are validated. There are no server secrets in the desktop bundle.
- Rooms have no account authentication; anyone with the invitation code can join and change timers. Keep codes private. This is a prototype service, not an Internet-scale hardened deployment.
- Socket.IO pings every 15 seconds and times out after 10 seconds without a response. Reconnection restores state while the room still exists.
- Do not deploy or promote this as a live-match tool. Review `COMPLIANCE.md` before any public distribution.
