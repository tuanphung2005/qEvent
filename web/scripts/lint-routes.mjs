#!/usr/bin/env node
/**
 * One route, one owner. Reads every features/<name>/routes.tsx and fails when
 * two features register the same path (literal or via lib/routes).
 * Static on purpose: parsing the declaration is enough and keeps CI fast.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const FEATURES_DIR = join(ROOT, "src", "features");

const PATTERN = /\bpath:\s*(?:paths\.([a-zA-Z]+)\s*\(|"([^"]*)")/g;

const seen = new Map();

for (const feature of readdirSync(FEATURES_DIR)) {
  const file = join(FEATURES_DIR, feature, "routes.tsx");
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const match of source.matchAll(PATTERN)) {
    const key = match[1] ? `lib/routes.${match[1]}` : `"${match[2]}"`;
    const where = `${relative(ROOT, file)}`;
    const existing = seen.get(key);
    if (existing) {
      console.error(`lint:routes ✗ ${key} được khai báo 2 lần: ${existing} và ${where}`);
      process.exitCode = 1;
    } else {
      seen.set(key, where);
    }
  }
}

if (process.exitCode !== 1) {
  console.log(`lint:routes ✓ ${seen.size} route, không trùng`);
}
