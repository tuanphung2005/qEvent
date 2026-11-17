#!/usr/bin/env node
/**
 * Fails CI when a feature or component breaks the visual rules that keep the
 * four owners consistent: hex colours, borders, blur and pale grey text.
 * Tokens live in src/styles/tokens.css and nowhere else.
 *
 * Escape hatch (rare, with a reason on the line): `lint-design-allow`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
// src/components/ui holds shadcn components copied in by CLI; they are thin
// wrappers over design tokens, so the rule applies to the code we author on
// top of them. shadcn's own generated internals (chart selectors) are exempt.
const TARGETS = ["src/features", "src/components/app", "src/app"];
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".jsx", ".js"]);

const RULES = [
  { name: "hex-colour", pattern: /#[0-9a-fA-F]{3,8}\b/, message: "dùng token Tailwind, không hex" },
  {
    name: "border",
    pattern: /\bborder(?:-(?:top|right|bottom|left|width|style|color))?\s*:/,
    message: "không dùng border, phân tầng bằng nền",
  },
  { name: "borderWidth", pattern: /\bborderWidth\s*:/, message: "không dùng borderWidth" },
  { name: "blur", pattern: /\b(?:backdrop-)?blur\(/, message: "không blur / glassmorphism" },
  { name: "backdrop-filter", pattern: /backdrop-filter\s*:/, message: "không backdrop-filter" },
  { name: "pale-grey", pattern: /#94a3b8|#cbd5e1|#9ca3af/i, message: "không dùng chữ xám nhạt" },
  { name: "outline", pattern: /\boutline\s*:/, message: "focus dùng box-shadow, không outline" },
  {
    name: "raw-palette",
    pattern:
      /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b/,
    message: "dùng token ngữ nghĩa (success/warning/destructive/...), không màu Tailwind thô",
  },
  {
    name: "raw-primitive",
    pattern: /<(?:button|input|select|textarea|table|dialog|label)\b/,
    message: "dùng primitive shadcn (Button/Input/Select/Textarea/Table/Dialog/Label)",
  },
];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      yield* walk(full);
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      yield full;
    }
  }
}

const findings = [];

for (const target of TARGETS) {
  for (const file of walk(join(ROOT, target))) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes("lint-design-allow")) return;
      for (const rule of RULES) {
        if (rule.pattern.test(line)) {
          findings.push({
            file: relative(ROOT, file),
            line: index + 1,
            rule: rule.name,
            message: rule.message,
            text: line.trim().slice(0, 120),
          });
        }
      }
    });
  }
}

if (findings.length === 0) {
  console.log(
    "lint:design ✓ không có hex / border / blur / xám nhạt / màu thô / HTML primitive trong features và components",
  );
  process.exit(0);
}

for (const finding of findings) {
  console.error(`${finding.file}:${finding.line}  [${finding.rule}] ${finding.message}`);
  console.error(`  ${finding.text}`);
}
console.error(`\nlint:design ✗ ${findings.length} vi phạm`);
process.exit(1);
