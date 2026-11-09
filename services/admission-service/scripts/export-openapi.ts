import path from "node:path";
import { createApp } from "../src/app";

const { app } = createApp();
const response = await app.handle(new Request("http://localhost/swagger/json"));
if (!response.ok) {
  throw new Error(`Swagger JSON export failed with status ${response.status}`);
}

const spec = await response.json();
const jsonTarget = path.resolve(import.meta.dir, "../openapi.json");
const yamlTarget = path.resolve(import.meta.dir, "../openapi.yaml");

await Bun.write(jsonTarget, `${JSON.stringify(spec, null, 2)}\n`);
await Bun.write(yamlTarget, `${Bun.YAML.stringify(spec, null, 2)}\n`);

console.log(`Wrote ${jsonTarget}`);
console.log(`Wrote ${yamlTarget}`);
process.exit(0);
