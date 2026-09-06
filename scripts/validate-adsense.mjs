#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const fail = (message) => {
  console.error(`AdSense validation failed: ${message}`);
  process.exit(1);
};
const requireMatch = (value, pattern, message) => {
  if (!pattern.test(value)) fail(message);
};

const config = read("ads-config.js");
const publisherMatch = config.match(/client:\s*"(ca-pub-\d+)"/);
if (!publisherMatch) fail("ads-config.js needs a valid publisher ID.");

const publisherId = publisherMatch[1];
const adsTxtPublisherId = publisherId.replace(/^ca-/, "");
const ownershipMeta = `<meta name="google-adsense-account" content="${publisherId}" />`;

requireMatch(config, /enabled:\s*false/, "ads must remain disabled during site review.");
for (const slot of ["topSlot", "sideSlot", "inlineSlot"]) {
  requireMatch(config, new RegExp(`${slot}:\\s*""`), `${slot} must remain empty during site review.`);
}

const adsTxt = read("ads.txt").trim();
const expectedAdsTxt = `google.com, ${adsTxtPublisherId}, DIRECT, f08c47fec0942fa0`;
if (adsTxt !== expectedAdsTxt) fail(`ads.txt must contain exactly: ${expectedAdsTxt}`);

for (const page of ["index.html", "guide.html", "privacy.html"]) {
  const html = read(page);
  if (!html.includes(ownershipMeta)) fail(`${page} is missing the AdSense ownership meta tag.`);
  if (/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/.test(html)) {
    fail(`${page} must not load the AdSense script while ad slots are disabled.`);
  }
}

const index = read("index.html");
requireMatch(index, /href="#guide"/, "the home page needs a visible game-guide navigation link.");
requireMatch(index, /href="\.\/privacy\.html"/, "the home page needs a visible privacy-policy link.");
requireMatch(index, /<h1[^>]*>[\s\S]*?KUMA CHESS[\s\S]*?<\/h1>/, "the home page needs a KUMA CHESS h1.");

const privacy = read("privacy.html");
for (const keyword of ["AdSense", "Cookie", "CMP", "carksk@naver.com"]) {
  if (!privacy.includes(keyword)) fail(`privacy.html must explain ${keyword}.`);
}

const robots = read("robots.txt");
for (const crawler of ["Mediapartners-Google", "Google-Display-Ads-Bot"]) {
  requireMatch(
    robots,
    new RegExp(`User-agent:\\s*${crawler}\\s*\\nAllow:\\s*\\/`, "m"),
    `robots.txt must explicitly allow ${crawler}.`,
  );
}
requireMatch(robots, /User-agent:\s*\*\s*\nAllow:\s*\//m, "robots.txt must allow general search crawlers.");
if (/Disallow:\s*\/(?:assets|src)\//.test(robots)) {
  fail("robots.txt must not block public rendering resources.");
}

console.log(`AdSense review readiness passed for ${publisherId} (ads remain disabled).`);
