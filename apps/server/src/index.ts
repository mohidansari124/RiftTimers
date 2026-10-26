import { createRiftServer } from "./server";
const server = createRiftServer();
const port = Number(process.env.PORT ?? 3001);
server.http.listen(port, process.env.HOST ?? "127.0.0.1", () =>
  console.log(`RiftTimers simulation server listening on ${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => void server.close().then(() => process.exit()));
