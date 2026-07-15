import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedExtensions = new Set([".js", ".mjs", ".html", ".css", ".json", ".md", ".txt"]);
const ignoredDirectories = new Set([".git", "node_modules", "__MACOSX"]);
const secretPatterns = [
  { name: "Google API key", expression: /AIza[0-9A-Za-z_-]{30,}/g },
  { name: "GitHub token", expression: /gh[pousr]_[0-9A-Za-z]{30,}/g },
  { name: "OpenAI-style secret", expression: /\bsk-[0-9A-Za-z_-]{24,}/g },
  { name: "private key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (allowedExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

const findings = [];
for (const file of walk(root)) {
  const relative = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of secretPatterns) {
    pattern.expression.lastIndex = 0;
    if (pattern.expression.test(content)) findings.push(`${relative}: possible ${pattern.name}`);
  }
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (!index.includes("Content-Security-Policy")) findings.push("index.html: missing CSP");
if (!index.includes('name="referrer"')) findings.push("index.html: missing referrer policy");
const csp = index.match(/Content-Security-Policy"\s+content="([^"]+)/)?.[1] || "";
const scriptPolicy = csp.match(/script-src\s+([^;]+)/)?.[1] || "";
if (scriptPolicy.includes("'unsafe-inline'")) findings.push("index.html: script-src allows unsafe-inline");

const adsConfig = fs.readFileSync(path.join(root, "ads-config.js"), "utf8");
if (/enabled:\s*true/.test(adsConfig) && !/ca-pub-\d+/.test(adsConfig)) {
  findings.push("ads-config.js: ads enabled without a valid publisher id");
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Security check passed: no known secret patterns and required browser policies are present.");
}
