# KUMA CHESS Agent Guide

## Source of truth

- This repository is the runtime and deployment source of truth.
- Original design and source art live in `/Users/koseulki/Desktop/KUMA_Factory/kuma-chess`.
- Treat the Desktop source-art folder as read-only unless the user explicitly asks to edit source assets.
- Do not work from `releases`, `outputs`, ZIP files, or older `work/kuma-chess` copies.
- Read `docs/PROJECT_CONTEXT.md` before substantial work and update the relevant document under `docs/` when a product decision changes.

## Working safely

- Run `git status --short --branch` before editing. The worktree may contain active user changes.
- Preserve unrelated modifications. Never reset, checkout, or overwrite changes you did not make.
- Do not commit or push unless the user explicitly asks.
- Stage only intended paths. Do not use `git add -A` in a mixed worktree.
- Use `apply_patch` for manual file edits.
- Keep source-art masters, PSD files, private notes, credentials, signing keys, and unreleased assets out of this public repository.
- Public AdSense publisher and slot IDs may appear in client code; account credentials and API secrets may not.

## Product boundaries

- Current product: portrait web/PWA chess with 100 puzzles, AI difficulty, face-to-face local play, collectible piece sets, coins, medals, daily missions, settings, sound, vibration, and local progress.
- Planned product: KUMA CHESS WORLD hub and reusable-asset mini-games. These are plans, not implemented features.
- Shared coins and collection progress must remain fair. Never add pay-to-win advantages to local or future online PvP.
- Browser `localStorage` is convenience storage, not trusted server data.
- Preserve migrations whenever the local storage schema changes.
- Every coin, mission, medal, and install reward must have a stable claim or event ID so it can be granted only once.

## Design rules

- Logical game canvas: `720 x 1280`, portrait first.
- `project.config` contains stale landscape metadata; do not use it as the runtime dimension source.
- Use Pretendard for UI/body text and Noto Serif KR Bold for large primary game buttons.
- Keep exact square alignment, bottom-center anchors, and layer order for chess pieces.
- Selection and move indicators sit below pieces and match one board square exactly.
- In face-to-face PvP, the board does not swap sides. Turn-facing pieces, black-side text, captured pieces, and black promotion UI orient toward the black player.
- Use supplied runtime art under `assets/kuma/`; do not approximate an available asset with CSS.
- Verify modal blur/dim, safe-area insets, long translations, touch targets, and portrait/landscape transitions.

## Run and validate

Start locally:

```bash
python3 -m http.server 8005
```

Open `http://localhost:8005/`; `file://` is unsupported.

Run before reporting completion:

```bash
find src -name '*.js' -print0 | xargs -0 -n1 node --check
node scripts/validate-puzzles.mjs
node scripts/validate-player-state.mjs
node scripts/validate-piece-assets.mjs
node scripts/validate-medals.mjs
node scripts/validate-daily-missions.mjs
node scripts/security-check.mjs
```

Before a requested public push, also run:

```bash
node scripts/security-check.mjs --history
```

Use the in-app browser for visual QA at desktop and mobile portrait sizes. For board or motion work, inspect screenshots at representative game states rather than validating only the menu.

## Change scope

- Prefer the existing Phaser 3, local `chess.js`, scene, state, and UI helper patterns.
- Keep cache/version strings coordinated across `index.html`, imported module URLs, and `sw.js` when shipping runtime changes.
- Treat vibration, wake lock, and orientation lock as best-effort browser features. Unsupported or rejected calls must not break gameplay.
- Do not replace `phaser.js` or `vendor-chess.js`, or move them to a CDN, without a deliberate dependency and license review.
- Add dependencies only when they materially reduce risk or implement proven game logic.
- Measure load size and decode cost before introducing texture atlases. Preserve separate source assets even if optimized runtime atlases are later generated.
- Update `docs/DECISIONS.md` for durable choices and `docs/ROADMAP.md` when priorities or status change.
