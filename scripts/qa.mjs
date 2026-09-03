#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rawArgs = process.argv.slice(2);
const positional = rawArgs.filter((arg) => !arg.startsWith("--"));
const mode = positional[0] || "quick";
const target = positional[1] || "core";
const includeHistory = rawArgs.includes("--history");

const validators = {
  ai: ["validate-challenge-ai.mjs", "validate-medals.mjs", "validate-player-state.mjs"],
  core: ["validate-player-state.mjs"],
  crown: ["validate-crown-clash.mjs"],
  daily: ["validate-daily-missions.mjs", "validate-player-state.mjs"],
  firebase: ["validate-firebase.mjs", "validate-player-state.mjs", "security-check.mjs"],
  ranking: ["validate-firebase.mjs", "validate-online.mjs", "validate-medals.mjs", "security-check.mjs"],
  main: ["validate-main-home.mjs"],
  medals: ["validate-medals.mjs", "validate-player-state.mjs"],
  online: ["validate-online.mjs", "validate-firebase.mjs", "validate-player-state.mjs", "security-check.mjs"],
  pieces: ["validate-piece-assets.mjs"],
  profile: ["validate-profile-assets.mjs", "validate-player-state.mjs", "validate-firebase.mjs"],
  puzzle: ["validate-puzzles.mjs", "validate-player-state.mjs"],
  road: ["validate-royal-road.mjs", "validate-royal-road-puzzle.mjs"],
  siege: ["validate-siege.mjs"],
  tug: ["validate-tug.mjs"],
};

const fullSuite = [
  "validate-puzzles.mjs",
  "validate-player-state.mjs",
  "validate-piece-assets.mjs",
  "validate-medals.mjs",
  "validate-daily-missions.mjs",
  "validate-challenge-ai.mjs",
  "validate-crown-clash.mjs",
  "validate-firebase.mjs",
  "validate-online.mjs",
  "validate-main-home.mjs",
  "validate-profile-assets.mjs",
  "validate-royal-road-puzzle.mjs",
  "validate-royal-road.mjs",
  "validate-siege.mjs",
  "validate-tug.mjs",
  "security-check.mjs",
];

function collectJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    timeout: 120_000,
  });

  if (result.status === 0) return;

  console.error(`\n[FAIL] ${label}`);
  if (result.stdout?.trim()) console.error(result.stdout.trim());
  if (result.stderr?.trim()) console.error(result.stderr.trim());
  process.exit(result.status || 1);
}

if (!new Set(["quick", "feature", "full"]).has(mode)) {
  console.error("Usage: node scripts/qa.mjs <quick|feature|full> [target] [--history]");
  process.exit(2);
}

if (mode !== "full" && !validators[target]) {
  console.error(`Unknown QA target: ${target}`);
  console.error(`Targets: ${Object.keys(validators).join(", ")}`);
  process.exit(2);
}

const jsFiles = collectJavaScriptFiles(join(root, "src"));
for (const file of jsFiles) {
  run(process.execPath, ["--check", file], `syntax: ${relative(root, file)}`);
}
for (const file of ["index.js", "ranking.js", "ranking.test.js"].map((name) => join(root, "functions", name))) {
  run(process.execPath, ["--check", file], `syntax: ${relative(root, file)}`);
}
run("git", ["diff", "--check"], "git diff --check");

let selectedValidators = [];
if (mode === "feature") selectedValidators = validators[target];
if (mode === "full") selectedValidators = fullSuite;
if (mode === "quick" && target !== "core") selectedValidators = validators[target].slice(0, 1);

for (const script of [...new Set(selectedValidators)]) {
  const args = [join(root, "scripts", script)];
  if (script === "security-check.mjs" && includeHistory) args.push("--history");
  run(process.execPath, args, script);
}

if (mode === "full" || ["firebase", "online", "ranking"].includes(target)) {
  run("npm", ["--prefix", "functions", "test"], "functions ranking tests");
}

const detail = [
  `${jsFiles.length} syntax checks`,
  "diff check",
  `${new Set(selectedValidators).size} validators`,
].join(", ");
console.log(`QA ${mode}${mode === "full" ? "" : `:${target}`} passed (${detail}).`);
