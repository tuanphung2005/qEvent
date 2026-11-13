import path from "node:path";
import { describe, expect, it } from "bun:test";
import { makeTestApp } from "./helpers";

const { app } = makeTestApp();

const expectedOperations: Record<string, string[]> = {
  "/health": ["get"],
  "/api/sessions/{sessionId}/questions": ["get", "post"],
  "/api/questions/{questionId}": ["delete"],
  "/api/questions/{questionId}/votes": ["put"],
  "/api/sessions/{sessionId}/polls": ["get", "post"],
  "/api/polls/{pollId}": ["patch"],
  "/api/polls/{pollId}/vote": ["post"],
  "/api/sessions/{sessionId}/stats": ["get"],
  "/api/sessions/{sessionId}/game": ["get", "post"],
  "/api/game/{gameId}/question": ["post"],
  "/api/game/{gameId}": ["get"],
  "/api/game/{gameId}/start": ["post"],
  "/api/game/{gameId}/reveal": ["post"],
  "/api/game/{gameId}/next": ["post"],
  "/api/game/{gameId}/end": ["post"],
  "/api/game/{gameId}/answer": ["post"],
  "/api/game/{gameId}/leaderboard": ["get"],
};

const protectedOperations: string[][] = [
  ["/api/sessions/{sessionId}/questions", "post"],
  ["/api/questions/{questionId}", "delete"],
  ["/api/questions/{questionId}/votes", "put"],
  ["/api/sessions/{sessionId}/polls", "post"],
  ["/api/polls/{pollId}", "patch"],
  ["/api/polls/{pollId}/vote", "post"],
  ["/api/sessions/{sessionId}/stats", "get"],
  ["/api/sessions/{sessionId}/game", "post"],
  ["/api/game/{gameId}/question", "post"],
  ["/api/game/{gameId}/start", "post"],
  ["/api/game/{gameId}/reveal", "post"],
  ["/api/game/{gameId}/next", "post"],
  ["/api/game/{gameId}/end", "post"],
  ["/api/game/{gameId}/answer", "post"],
];

async function loadSpec(): Promise<any> {
  const response = await app.handle(new Request("http://localhost/swagger/json"));
  expect(response.status).toBe(200);
  return response.json();
}

const spec = await loadSpec();

function deref(node: any): any {
  if (node && typeof node === "object" && typeof node.$ref === "string") {
    let target: any = spec;
    for (const key of node.$ref.replace(/^#\//, "").split("/")) {
      target = target?.[key.replace(/~1/g, "/").replace(/~0/g, "~")];
    }
    if (target === undefined) throw new Error(`Dangling $ref: ${node.$ref}`);
    return target;
  }
  return node;
}

function collectRefs(node: any, found: string[] = []): string[] {
  if (!node || typeof node !== "object") return found;
  if (typeof node.$ref === "string") {
    found.push(node.$ref);
    return found;
  }
  for (const value of Object.values(node)) collectRefs(value, found);
  return found;
}

function examplesOf(response: any): Array<{ label: string; value: any }> {
  const media = deref(response).content?.["application/json"];
  if (!media) return [];
  if ("example" in media) return [{ label: "example", value: media.example }];
  if (media.examples) {
    return Object.entries<any>(media.examples).map(([label, entry]) => ({
      label,
      value: entry.value,
    }));
  }
  return [];
}

function assertExample(schema: any, example: any, where: string): void {
  if (example === null || example === undefined) return;
  const resolved = deref(schema);
  if (!resolved || typeof resolved !== "object") return;

  for (const key of resolved.required ?? []) {
    if (!(key in example)) throw new Error(`${where} is missing required key "${key}"`);
  }

  if (Array.isArray(example)) {
    if (resolved.items) {
      example.forEach((item, index) => assertExample(resolved.items, item, `${where}[${index}]`));
    }
    return;
  }
  if (!example || typeof example !== "object") return;
  for (const [key, propertySchema] of Object.entries<any>(resolved.properties ?? {})) {
    if (key in example) assertExample(propertySchema, example[key], `${where}.${key}`);
  }
}

describe("engagement openapi contract", () => {
  it("serves a valid OpenAPI 3.0.3 document", () => {
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBe("qEvent Engagement Service");
    expect(spec.info.version).toBe("1.0.0");
    expect(spec.info.description).toContain("BR-6");
    expect(spec.servers.length).toBeGreaterThan(0);
  });

  it("documents every route and nothing outside the contract", () => {
    expect(Object.keys(spec.paths).sort()).toEqual(Object.keys(expectedOperations).sort());
    for (const [route, methods] of Object.entries(expectedOperations)) {
      expect(Object.keys(spec.paths[route]).sort()).toEqual([...methods].sort());
    }
  });

  it("gives every operation a unique id, summary and tag", () => {
    const operationIds = new Set<string>();
    for (const [route, methods] of Object.entries(expectedOperations)) {
      for (const method of methods) {
        const operation = spec.paths[route][method];
        expect(operation.operationId).toBeString();
        expect(operation.summary).toBeString();
        expect(operation.summary.length).toBeGreaterThan(0);
        expect(operation.tags?.length ?? 0).toBeGreaterThan(0);
        expect(operationIds.has(operation.operationId)).toBe(false);
        operationIds.add(operation.operationId);
      }
    }
  });

  it("declares bearer security on every write operation", () => {
    expect(spec.components.securitySchemes.bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "JWT verified by the API Gateway. For WebSocket handshakes use `?token=<jwt>` because browsers cannot set headers.",
    });

    for (const [route, method] of protectedOperations) {
      expect(spec.paths[route][method].security).toEqual([{ bearerAuth: [] }]);
    }
    for (const [route, methods] of Object.entries(expectedOperations)) {
      for (const method of methods) {
        const isProtected = protectedOperations.some(
          ([protectedRoute, protectedMethod]) =>
            protectedRoute === route && protectedMethod === method
        );
        if (!isProtected) expect(spec.paths[route][method].security).toBeUndefined();
      }
    }
  });

  it("documents success and error responses with valid examples for every operation", () => {
    for (const [route, methods] of Object.entries(expectedOperations)) {
      for (const method of methods) {
        const operation = spec.paths[route][method];
        const codes = Object.keys(operation.responses);
        expect(codes.some((code) => /^2\d\d$/.test(code))).toBe(true);

        for (const code of codes) {
          const response = deref(operation.responses[code]);
          expect(response.description).toBeString();
          if (code === "204") continue;
          const media = response.content?.["application/json"];
          expect(media?.schema).toBeDefined();
          const examples = examplesOf(operation.responses[code]);
          expect(examples.length).toBeGreaterThan(0);
          for (const example of examples) {
            assertExample(
              media.schema,
              example.value,
              `${method.toUpperCase()} ${route} ${code} ${example.label}`
            );
          }
        }
      }
    }
  });

  it("documents the BR-6 and upstream failure responses with examples", () => {
    const questionPost = spec.paths["/api/sessions/{sessionId}/questions"].post;
    expect(questionPost.responses["403"].content["application/json"].examples).toHaveProperty(
      "notCheckedIn"
    );
    expect(
      deref(questionPost.responses["503"]).content["application/json"].schema.$ref
    ).toBe("#/components/schemas/ErrorBody");
  });

  it("resolves every $ref", () => {
    const refs = collectRefs(spec);
    expect(refs.length).toBeGreaterThan(20);
    for (const ref of refs) expect(() => deref({ $ref: ref })).not.toThrow();
  });

  it("keeps openapi.json and openapi.yaml in sync with the served spec", async () => {
    const json = await Bun.file(path.resolve(import.meta.dir, "../openapi.json")).json();
    const yaml = Bun.YAML.parse(
      await Bun.file(path.resolve(import.meta.dir, "../openapi.yaml")).text()
    );
    expect(json).toEqual(spec);
    expect(yaml).toEqual(spec);
  });

  it("serves the documentation page", async () => {
    const response = await app.handle(new Request("http://localhost/swagger"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("swagger/json");
  });

  it("matches the live error envelope and validation payload", async () => {
    const noAuth = await app.handle(
      new Request("http://localhost/api/sessions/session-1/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      })
    );
    expect(noAuth.status).toBe(401);
    const noAuthBody = (await noAuth.json()) as any;
    for (const key of spec.components.schemas.ErrorBody.required) {
      expect(noAuthBody).toHaveProperty(key);
    }

    const invalid = await app.handle(
      new Request("http://localhost/api/sessions/session-1/questions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-id": "u1", "x-user-role": "ATTENDEE" },
        body: JSON.stringify({ content: "" }),
      })
    );
    expect(invalid.status).toBe(422);
    const invalidBody = (await invalid.json()) as any;
    for (const key of spec.components.schemas.ValidationError.required) {
      expect(invalidBody).toHaveProperty(key);
    }
  });
});
