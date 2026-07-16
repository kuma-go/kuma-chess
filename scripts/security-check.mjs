import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanHistory = process.argv.includes("--history");
const allowedExtensions = new Set([
  ".js", ".mjs", ".cjs", ".html", ".css", ".json", ".md", ".txt",
  ".yml", ".yaml", ".toml", ".xml", ".ini", ".conf", ".cfg",
  ".sh", ".bash", ".zsh", ".fish", ".ps1",
]);
const ignoredDirectories = new Set([".git", "node_modules", "__MACOSX"]);
const secretPatterns = [
  { name: "Google API key", expression: /AIza[0-9A-Za-z_-]{30,}/g },
  { name: "AWS access key", expression: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: "GitHub token", expression: /(?:gh[pousr]_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{20,})/g },
  { name: "OpenAI-style secret", expression: /\bsk-[0-9A-Za-z_-]{24,}/g },
  { name: "Slack token", expression: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
  { name: "SendGrid key", expression: /\bSG\.[0-9A-Za-z_-]{16,}\.[0-9A-Za-z_-]{16,}\b/g },
  { name: "private key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: "hard-coded credential",
    expression: /(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password|passwd|secret)\s*[:=]\s*["'`][0-9A-Za-z+/_=.:-]{16,}["'`]/gi,
  },
];
const sensitivePathPatterns = [
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:\.npmrc|\.pypirc|\.netrc|\.envrc)$/i,
  /(^|\/)\.aws\/credentials$/i,
  /(^|\/)(?:credentials?|secrets?|service[-_]?account)(?:\.|[-_])/i,
  /firebase-adminsdk/i,
  /\.(?:pem|key|p12|pfx|jks|keystore|mobileprovision)$/i,
];

function isSensitivePath(relative) {
  if (relative === ".env.example") return false;
  return sensitivePathPatterns.some((pattern) => pattern.test(relative));
}

function isScannablePath(relative) {
  return isSensitivePath(relative) || allowedExtensions.has(path.extname(relative).toLowerCase());
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else files.push(absolute);
  }
  return files;
}

const findings = [];
const warnings = [];

function scanContent(label, content) {
  if (content.includes("\0")) return;
  for (const pattern of secretPatterns) {
    pattern.expression.lastIndex = 0;
    if (pattern.expression.test(content)) findings.push(`${label}: possible ${pattern.name}`);
  }
}

for (const file of walk(root)) {
  const relative = path.relative(root, file);
  if (isSensitivePath(relative)) findings.push(`${relative}: sensitive filename must not be committed`);
  if (!isScannablePath(relative)) continue;
  scanContent(relative, fs.readFileSync(file, "utf8"));
}

if (scanHistory) {
  const objectLines = execFileSync("git", ["rev-list", "--objects", "--all"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).split("\n");
  const scannedBlobs = new Set();

  for (const line of objectLines) {
    const separator = line.indexOf(" ");
    if (separator < 0) continue;
    const objectId = line.slice(0, separator);
    const relative = line.slice(separator + 1);
    if (!relative || !isScannablePath(relative)) continue;
    if (isSensitivePath(relative)) findings.push(`history:${relative}: sensitive filename was committed`);
    if (scannedBlobs.has(objectId)) continue;
    scannedBlobs.add(objectId);

    const content = execFileSync("git", ["cat-file", "-p", objectId], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    scanContent(`history:${relative}@${objectId.slice(0, 12)}`, content);
  }

  const authorEmails = new Set(execFileSync("git", ["log", "--all", "--format=%ae%n%ce"], {
    cwd: root,
    encoding: "utf8",
  }).split("\n").map((email) => email.trim()).filter(Boolean));
  const exposedEmails = [...authorEmails].filter((email) => !email.endsWith("@users.noreply.github.com") && email !== "noreply@github.com");
  if (exposedEmails.length) {
    warnings.push(`Git history exposes commit email metadata: ${exposedEmails.join(", ")}`);
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
  console.error([...new Set(findings)].join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Security check passed: no known secret patterns found${scanHistory ? " in the working tree or Git history" : ""}, and required browser policies are present.`);
}

if (warnings.length) console.warn(warnings.join("\n"));
