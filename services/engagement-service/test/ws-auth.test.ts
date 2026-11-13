import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { makeTestApp } from "./helpers";

const JWT_SECRET = "test_jwt_secret_key_12345";

async function signToken(userId: string, role = "ATTENDEE"): Promise<string> {
  let token = "";
  const signer = new Elysia()
    .use(jwt({ name: "jwtAuth", secret: JWT_SECRET }))
    .get("/", async ({ jwtAuth }: any) => {
      token = await jwtAuth.sign({ sub: userId, role });
      return { token };
    });
  await signer.handle(new Request("http://localhost/"));
  return token;
}

function connect(url: string): Promise<{ ws: WebSocket; messages: unknown[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages: unknown[] = [];
    const timer = setTimeout(() => reject(new Error(`WS timeout for ${url}`)), 3000);

    ws.onopen = () => {
      clearTimeout(timer);
      resolve({ ws, messages });
    };
    ws.onmessage = (event) => messages.push(event.data);
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`WS error for ${url}`));
    };
  });
}

describe("engagement WebSocket authentication", () => {
  it("closes an anonymous connection with 4401", async () => {
    const { app } = makeTestApp();
    const server = app.listen(0);
    const port = (server.server as any).port;

    const result = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws/qa`);
      const timer = setTimeout(() => reject(new Error("no close received")), 3000);
      ws.onclose = (event) => {
        clearTimeout(timer);
        resolve(event.code);
      };
      ws.onopen = () => {
        // Server should close immediately; send a message to make sure it is ignored.
        ws.send(JSON.stringify({ type: "JOIN_SESSION", sessionId: "session-1" }));
      };
      ws.onerror = () => {};
    });

    expect(result).toBe(4401);
    server.stop();
  });

  it("accepts a JWT in the query string and delivers realtime messages", async () => {
    const { app } = makeTestApp();
    const server = app.listen(0);
    const port = (server.server as any).port;
    const token = await signToken("attendee-1");

    const { ws, messages } = await connect(
      `ws://localhost:${port}/ws/qa?token=${encodeURIComponent(token)}`
    );

    ws.send(JSON.stringify({ type: "JOIN_SESSION", sessionId: "session-1" }));

    for (let i = 0; i < 30 && messages.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(messages.length).toBeGreaterThan(0);
    expect(JSON.parse(String(messages[0]))).toEqual({
      type: "JOINED_SESSION",
      sessionId: "session-1",
    });

    ws.close();
    server.stop();
  });
});
