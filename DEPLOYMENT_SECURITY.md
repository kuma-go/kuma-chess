# Deployment and AdSense Checklist

## Before every deployment

1. Confirm no secrets are present: API keys, OAuth secrets, cookies, tokens, `.env` files, signing keys, or private user data.
   Run `node scripts/security-check.mjs --history` to scan both current files and reachable Git history.
2. Run JavaScript syntax checks and the puzzle validator.
3. Keep dependencies local and pinned. Review changes to `phaser.js` and `vendor-chess.js` deliberately.
4. Deploy over HTTPS only.
5. Review the browser console and network panel for unexpected third-party requests.

## Recommended HTTP headers

GitHub Pages does not provide repository-controlled response headers. The HTML includes a CSP fallback, but production hosting should set these as real response headers through Cloudflare Pages, Netlify, or another configurable host:

```text
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; ...
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin-allow-popups
```

AdSense domains must remain in the final CSP after ads are enabled. Test ad delivery before making the policy stricter.

## Enabling AdSense

1. Complete AdSense site review and configure Privacy & messaging / a Google-certified CMP where required.
2. Update `ads-config.js` with the issued `ca-pub-...` client and numeric top banner slot.
3. Set `enabled: true`; use `testMode: true` only during permitted testing.
4. Copy `ads.txt.example` to `ads.txt` and replace `pub-REPLACE_ME` with the issued publisher ID.
5. Never click your own ads or encourage users to click ads.
6. Verify the banner is visually separated from game controls and never overlays interactive chess UI.

## Public repository warning

Any file committed to a public repository or sent to a browser can be copied. Keep master artwork and commercial source files private, and publish only the compressed assets needed at runtime.

Commit author names and email addresses are also public metadata. Configure this repository with a GitHub `noreply` address before committing. Removing an address from existing commits requires a coordinated history rewrite and force-push; changing the current file contents alone does not remove it from old commits.

For better casual-leak resistance, keep the development repository private and publish a separate runtime-only branch or artifact. `robots.txt`, `X-Robots-Tag`, and `Cross-Origin-Resource-Policy` reduce indexing and cross-site embedding on supported hosts, but they are not access control and cannot stop a determined downloader.
