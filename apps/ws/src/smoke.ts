// Одноразовый smoke-тест: проверяет, что WS-сервер отвергает
// неавторизованные подключения и принимает корректно подписанные.
// Запуск из корня монорепо: `tsx apps/ws/src/smoke.ts`

import "./env";
import { io as ioClient } from "socket.io-client";
import { signWsToken } from "@alias/shared/token";

const WS_URL = "http://localhost:3001";
const SECRET = process.env.WS_TOKEN_SECRET;
if (!SECRET) throw new Error("WS_TOKEN_SECRET missing");

function connect(opts: { token?: string; code?: string }) {
  return new Promise<{ ok: boolean; error?: string; ack?: unknown }>((resolve) => {
    const sock = ioClient(`${WS_URL}/room`, {
      auth: { token: opts.token, code: opts.code },
      transports: ["websocket"],
      reconnection: false,
      timeout: 3000,
    });
    sock.on("connect", () => {
      sock.emit("room:hello", {}, (ack: unknown) => {
        sock.disconnect();
        resolve({ ok: true, ack });
      });
    });
    sock.on("connect_error", (err) => {
      sock.disconnect();
      resolve({ ok: false, error: err.message });
    });
    setTimeout(() => {
      sock.disconnect();
      resolve({ ok: false, error: "timeout" });
    }, 4000);
  });
}

async function main() {
  console.log("\n[1] no token  →", await connect({}));
  console.log(
    "[2] bad token →",
    await connect({ token: "garbage.garbage", code: "ABC123" }),
  );

  const goodToken = signWsToken(
    { userId: "u-smoke-1", roomCode: "ABC123", role: "host" },
    SECRET!,
  );
  console.log(
    "[3] mismatch  →",
    await connect({ token: goodToken, code: "ZZZ999" }),
  );

  console.log(
    "[4] valid     →",
    await connect({ token: goodToken, code: "ABC123" }),
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
