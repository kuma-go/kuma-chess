import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const output = path.resolve("firebase-client.js");

await build({
  entryPoints: ["src/firebaseClientEntry.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  minify: true,
  outfile: output,
});

const bundled = fs.readFileSync(output, "utf8").replace(/[ \t]+$/gm, "");
fs.writeFileSync(output, bundled);
