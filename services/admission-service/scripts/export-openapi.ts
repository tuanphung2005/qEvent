import path from "node:path";
import { createApp } from "../src/app";

const { app } = createApp();
const response = await app.handle(new Request("http://localhost/swagger/json"));
if (!response.ok) {
  throw new Error(`Swagger JSON export failed with status ${response.status}`);
}

const spec = await response.json();
const target = path.resolve(import.meta.dir, "../openapi.json");
await Bun.write(target, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Wrote ${target}`);
process.exit(0);
