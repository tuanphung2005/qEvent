/**
 * Generates src/lib/api/generated.ts from the three service contracts.
 * Run: bun run gen:api  (never hand-edit the output)
 *
 * The gateway merges three OpenAPI documents, so shared component names
 * (ErrorBody, ValidationError, HealthResponse) are prefixed with their service
 * name in the second and third document instead of being silently overwritten.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

type Json = Record<string, unknown>;

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const outFile = fileURLToPath(new URL("../src/lib/api/generated.ts", import.meta.url));

const SERVICES = [
  { name: "event", file: "services/event-service/openapi.json" },
  { name: "admission", file: "services/admission-service/openapi.json" },
  { name: "engagement", file: "services/engagement-service/openapi.json" },
] as const;

const COMPONENT_KEYS = [
  "schemas",
  "responses",
  "parameters",
  "requestBodies",
  "securitySchemes",
  "headers",
] as const;

function readDoc(file: string): Json {
  return JSON.parse(readFileSync(`${repoRoot}${file}`, "utf8")) as Json;
}

function components(doc: Json): Record<string, Record<string, unknown>> {
  return (doc.components as Record<string, Record<string, unknown>> | undefined) ?? {};
}

function pascal(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Rewrites every "#/components/<kind>/<name>" pointer according to `rename`. */
function rewriteRefs(node: unknown, rename: (ref: string) => string): unknown {
  if (Array.isArray(node)) return node.map((item) => rewriteRefs(item, rename));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "$ref" && typeof value === "string") {
        out[key] = rename(value);
      } else {
        out[key] = rewriteRefs(value, rename);
      }
    }
    return out;
  }
  return node;
}

const docs = SERVICES.map((service) => ({ ...service, doc: readDoc(service.file) }));

// Count how often each component name appears, so only real collisions rename.
const seen = new Map<string, number>();
for (const { doc } of docs) {
  for (const kind of COMPONENT_KEYS) {
    for (const name of Object.keys(components(doc)[kind] ?? {})) {
      const key = `${kind}/${name}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
}

const merged: Json = {
  openapi: "3.1.0",
  info: {
    title: "qEvent staff API",
    version: "1.0.0",
    description: "Merged contracts of event, admission and engagement services behind the gateway.",
  },
  servers: [{ url: "" }],
  paths: {},
  components: Object.fromEntries(COMPONENT_KEYS.map((kind) => [kind, {}])),
};

const mergedComponents = merged.components as Record<string, Record<string, unknown>>;
const mergedPaths = merged.paths as Record<string, unknown>;

for (const [index, { name, doc }] of docs.entries()) {
  const renamed = new Map<string, string>();

  for (const kind of COMPONENT_KEYS) {
    for (const componentName of Object.keys(components(doc)[kind] ?? {})) {
      const collides = (seen.get(`${kind}/${componentName}`) ?? 0) > 1;
      if (collides && index > 0) {
        renamed.set(`${kind}/${componentName}`, `${pascal(name)}${componentName}`);
      }
    }
  }

  const renameRef = (ref: string): string => {
    const match = /^#\/components\/([^/]+)\/(.+)$/.exec(ref);
    if (!match) return ref;
    const [, kind, componentName] = match;
    const next = renamed.get(`${kind}/${componentName}`);
    return next ? `#/components/${kind}/${next}` : ref;
  };

  const docWithRefs = rewriteRefs(doc, renameRef) as Json;

  for (const kind of COMPONENT_KEYS) {
    for (const [componentName, value] of Object.entries(components(docWithRefs)[kind] ?? {})) {
      const target = renamed.get(`${kind}/${componentName}`) ?? componentName;
      mergedComponents[kind] ??= {};
      mergedComponents[kind][target] = value;
    }
  }

  for (const [path, value] of Object.entries(
    (docWithRefs.paths as Record<string, unknown>) ?? {},
  )) {
    if (mergedPaths[path] !== undefined) {
      if (path === "/health") continue; // every service exposes it; one copy is enough
      throw new Error(
        `Path collision on ${path} (${name}); resolve the contract instead of guessing.`,
      );
    }
    mergedPaths[path] = value;
  }
}

const ast = await openapiTS(JSON.stringify(merged));
const header = [
  "/**",
  " * GENERATED FILE — do not edit. Run `bun run gen:api` instead.",
  " * Source: services/{event,admission,engagement}-service/openapi.json",
  " */",
  "",
].join("\n");

writeFileSync(outFile, `${header}${astToString(ast)}\n`, "utf8");
console.log(`generated ${outFile}`);
