import path from "node:path";
import { describe, expect, it } from "bun:test";
import { call, makeTestApp } from "./helpers";

const { app } = makeTestApp();

const expectedOperations: Record<string, string[]> = {
  "/health": ["get"],
  "/api/auth/register": ["post"],
  "/api/auth/login": ["post"],
  "/api/auth/me": ["get"],
  "/api/orders": ["get", "post"],
  "/api/orders/{id}": ["get"],
  "/api/tickets": ["get"],
  "/api/tickets/my": ["get"],
  "/api/tickets/{id}": ["get"],
  "/api/tickets/{id}/qr-token": ["get"],
  "/api/checkins": ["get", "post"],
  "/api/checkins/stats": ["get"],
  "/api/checkins/sync-offline": ["post"],
  "/internal/tickets/verify-access": ["get"],
};

const protectedOperations: Array<[string, string, "bearerAuth" | "serviceToken"]> = [
  ["/api/auth/me", "get", "bearerAuth"],
  ["/api/orders", "get", "bearerAuth"],
  ["/api/orders", "post", "bearerAuth"],
  ["/api/orders/{id}", "get", "bearerAuth"],
  ["/api/tickets", "get", "bearerAuth"],
  ["/api/tickets/my", "get", "bearerAuth"],
  ["/api/tickets/{id}", "get", "bearerAuth"],
  ["/api/tickets/{id}/qr-token", "get", "bearerAuth"],
  ["/api/checkins", "get", "bearerAuth"],
  ["/api/checkins", "post", "bearerAuth"],
  ["/api/checkins/stats", "get", "bearerAuth"],
  ["/api/checkins/sync-offline", "post", "bearerAuth"],
  ["/internal/tickets/verify-access", "get", "serviceToken"],
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

  if (Array.isArray(resolved.oneOf)) {
    const failures: string[] = [];
    for (const candidate of resolved.oneOf) {
      try {
        assertExample(candidate, example, where);
        return;
      } catch (error) {
        failures.push((error as Error).message);
      }
    }
    throw new Error(`${where} matched no oneOf branch: ${failures.join(" | ")}`);
  }

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

describe("openapi contract", () => {
  it("serves a valid OpenAPI 3.0.3 document", () => {
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBe("qEvent Admission Service");
    expect(spec.info.version).toBe("1.0.0");
    expect(spec.info.description).toContain("ticket orders");
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

  it("declares JWT and service-token security on the right operations", () => {
    expect(spec.components.securitySchemes.bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT issued by `/api/auth/login` or `/api/auth/register`.",
    });
    expect(spec.components.securitySchemes.serviceToken.type).toBe("apiKey");
    expect(spec.components.securitySchemes.serviceToken.in).toBe("header");
    expect(spec.components.securitySchemes.serviceToken.name).toBe("x-service-token");

    for (const [route, method, scheme] of protectedOperations) {
      expect(spec.paths[route][method].security).toEqual([{ [scheme]: [] }]);
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

  it("documents success and error responses with examples for every operation", () => {
    for (const [route, methods] of Object.entries(expectedOperations)) {
      for (const method of methods) {
        const operation = spec.paths[route][method];
        const codes = Object.keys(operation.responses);
        expect(codes.some((code) => /^2\d\d$/.test(code))).toBe(true);
        expect(codes.some((code) => /^[45]\d\d$/.test(code))).toBe(true);

        for (const code of codes) {
          const response = deref(operation.responses[code]);
          expect(response.description).toBeString();
          const media = response.content?.["application/json"];
          expect(media?.schema).toBeDefined();
          const examples = examplesOf(operation.responses[code]);
          expect(examples.length).toBeGreaterThan(0);
          for (const example of examples) {
            assertExample(media.schema, example.value, `${method.toUpperCase()} ${route} ${code} ${example.label}`);
          }
        }
      }
    }
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

  it("matches the live error envelope", async () => {
    const result = await call(app, "/api/tickets/my");
    expect(result.status).toBe(401);
    for (const key of spec.components.schemas.ErrorBody.required) {
      expect(result.data).toHaveProperty(key);
    }
  });

  it("matches the live validation payload", async () => {
    const result = await call(app, "/api/auth/register", {
      method: "POST",
      body: { email: "a@b.c", password: "short", fullName: "X" },
    });
    expect(result.status).toBe(422);
    for (const key of spec.components.schemas.ValidationError.required) {
      expect(result.data).toHaveProperty(key);
    }
  });
});
