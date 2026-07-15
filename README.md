# KUMA CHESS

KUMA CHESS is a portrait web chess game with tactical puzzles, selectable AI difficulty, local two-player play, collectible white/black animal piece sets, and local progress tracking.

## Local run

```bash
python3 -m http.server 8005
```

Open `http://localhost:8005/`. Directly opening `index.html` with `file://` is not supported because the game uses JavaScript modules and a service worker.

Production domain and AdSense setup instructions are in [DOMAIN_ADS_SETUP_KO.md](./DOMAIN_ADS_SETUP_KO.md). The canonical production URL is `https://kumachess.com/`.

## Validation

```bash
find src -name '*.js' -print0 | xargs -0 -n1 node --check
node scripts/validate-puzzles.mjs
node scripts/validate-player-state.mjs
node scripts/validate-piece-assets.mjs
node scripts/security-check.mjs
```

## Privacy and security

- Progress is stored in the current browser only.
- Do not add API secrets, tokens, private keys, or personal data to client code.
- AdSense remains disabled until valid public publisher/slot IDs and consent settings are configured.
- See `SECURITY.md`, `DEPLOYMENT_SECURITY.md`, and `privacy.html`.

## Copyright

Original KUMA CHESS artwork and branding are not open assets. See `ASSET_LICENSE.md`. Third-party libraries and fonts retain their respective licenses.
