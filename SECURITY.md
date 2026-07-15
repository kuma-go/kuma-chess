# Security Policy

## Supported version

Security fixes are applied to the latest deployed version of KUMA CHESS.

## Reporting a vulnerability

Please report vulnerabilities privately to `carksk@naver.com`. Do not include passwords, tokens, personal data, or exploit payloads from other users. Allow reasonable time for investigation before public disclosure.

## Security model

- KUMA CHESS is a static, local-first web application.
- Game progress is stored in browser `localStorage` and is not treated as trusted server data.
- No secret key, service credential, or private API token may be committed to this repository or shipped to the browser.
- AdSense publisher and slot IDs are public identifiers. Account credentials must stay in the AdSense console.
- Client-side validation protects gameplay UX only. It cannot prevent a user from editing their own local progress.
- Browser-delivered JavaScript and image assets can be inspected and downloaded. Minification or obfuscation is not a security boundary.

## Repository and asset guidance

This repository is public. Keep original PSD files, source artwork, private build notes, signing keys, and unreleased assets in a separate private repository. Publish only optimized runtime assets required by the game.
