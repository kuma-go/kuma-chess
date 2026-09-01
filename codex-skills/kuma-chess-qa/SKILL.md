---
name: kuma-chess-qa
description: Choose and run proportional, token-conscious QA for KUMA CHESS code or UI changes. Use when verifying changes, checking a screen, reviewing regressions, or preparing a release in the kuma-chess-publish repository.
---

# KUMA CHESS QA

Read `docs/QA_WORKFLOW.md`, then select the smallest QA tier that matches the actual risk.

- Use `npm run qa:quick -- <target>` for visual spacing, copy, coordinates, or a single asset change that does not alter state.
- Use `npm run qa:feature -- <target>` for interaction, persistence, purchase, reward, profile, or gameplay behavior.
- Use `npm run qa:full` for broad shared changes and release candidates. Use `npm run qa:release` immediately before a requested public push.

For quick QA, inspect only the changed screen and do not use a subagent. Add a second viewport only when the change can affect responsive layout. For feature QA, exercise the changed success and failure/cancel paths and inspect only affected screens. Use independent agents only for a requested full audit, cross-system high-risk work, or ambiguity that deterministic checks and direct inspection cannot resolve.

Keep successful output terse. Report the tier, targeted screen or feature, checks run, and any untested risk. Do not rerun a higher tier after a cosmetic follow-up when the earlier broader checks still cover the unchanged logic.
