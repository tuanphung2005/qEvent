/**
 * Guards against the classic double-encoding bug (UTF-8 read as Latin-1),
 * which turns "vận hành" into "váº­n hÃ nh" and ships silently.
 * Run: node scripts/check-encoding.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "test", "e2e", "scripts", "index.html"];
const SELF = join("scripts", "check-encoding.mjs");
const BAD = /Ã[\u0080-\u00bf]|â€|Ä‘|áº/;

function walk(path) {
  const stats = statSync(path);
  if (!stats.isDirectory()) return [path];
  return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
}

const files = ROOTS.flatMap((root) => {
  try {
    return walk(root);
  } catch {
    return [];
  }
}).filter((file) => /\.(ts|tsx|mjs|json|html)$/.test(file) && file !== SELF);

let count = 0;
for (const file of files) {
  const hits = readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => BAD.test(line));
  if (hits.length > 0) {
    count += 1;
    console.log(`${file} (${hits.length} dòng)`);
    console.log(`   ${hits[0].trim().slice(0, 120)}`);
  }
}

console.log(count === 0 ? "encoding ✓ không có chuỗi bị lỗi" : `encoding ✗ ${count} file`);
process.exit(count === 0 ? 0 : 1);
