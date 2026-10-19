# Code scan and live QA — 2026-10-19

## Current result

**Gateway connection is fixed locally. The pixel office renders the actual map and live agent.** Native Electron interactions and GPU-backed 3D rendering are not certified by this run.

### Root cause and correction

CDP showed the `/_next/webpack-hmr` WebSocket sending its handshake but never receiving a response. Chromium created the gateway socket but never sent its handshake before timeout. Suppressing only HMR in an isolated diagnostic browser let the gateway connect immediately.

Studio's custom server uses Next 16.1.7. Its `app.getUpgradeHandler()` delegates to a no-op NextNodeServer handler, while the custom server also removes Next's automatic upgrade listener. The prepared router's handler serves HMR. Corrected `/root/hermes3d/server/index.js` to use:

```js
const handleUpgrade = app.upgradeHandler ?? app.getUpgradeHandler();
```

Restarted only Studio; Desktop and Hermes backend were left running. `scripts/fix-studio-hmr.mjs` reproduces this fix, saves a backup, is idempotent, and refuses unknown Next versions or changed source. This is version-bound compatibility, not a guarantee for future Next versions.

### Improvements and verification

- **13 unit tests pass**, including four new patch-routing/idempotency/refusal tests.
- **16 Chromium integration checks pass**, now including embedded live-backend connection, nonempty agent roster, and a visible office canvas.
- Live runtime probe: `connected: true`, `timedOut: false`, no captured console or socket errors.
- Replaced the fixed 35-second runtime delay with readiness polling plus a brief settling period.
- Pixel-renderer browser tests now disable WebGL to avoid repeated software-GPU initialization during iframe remounts. This tests the supported 2D canvas fallback, not 3D performance.
- `git diff --check` passed; `npm audit` reported zero vulnerabilities.
- Graft index refreshed: 8 files, 22 nodes, 45 edges; freshness passed.
- `qa/office-2d.png` was visually inspected: rooms, desks, office map and the Default agent are visible. Generated captures/results remain git-ignored.

The integration harness uses a real plugin, Studio and backend, but SDK-shaped host stubs for registration/storage/OS. Test preferences change only isolated browser storage. No chats were sent, agents created or credentials changed.

### Remaining limits

Forced-3D probes reached a connected runtime but produced blank/unstable captures and software-WebGL screenshot timeouts; **this is not a 3D scene pass**. No speculative upstream graphics edits were made. A software-WebGL toolbar test also timed out; the final 2D-fallback suite passed. Native Electron menu clicks remain unverified because Desktop CDP was unavailable.

Changes in this pass are local and not pushed. Prior GitHub CI success does not cover these changes.

---

# Historical scan — 2026-10-17 (superseded by current results above)

## Verdict

**Plugin regression suite passes; full connected-office end-to-end is NOT green.**

Scope: the public `hermes3d-desktop` integration and its installed local copy, with a live Studio on `127.0.0.1:3000` and Hermes backend on `127.0.0.1:9120`. Review baseline: initial commit `c100b2e`.

## Fixed in this revision

| Finding | Severity | Fix |
|---|---|---|
| Frame timeout captures stale `loaded` state; reload after success can disable timeout detection | Medium | Keyed frame lifecycle; timeout uses a functional status update; slow loads can finish |
| Only URL prefix was validated; malformed URLs and embedded credentials accepted | Medium | URL parser, HTTP(S)-only, reject credentials/query/fragment; validate saved settings too |
| Save errors silently ignored; synchronous storage implementations could throw on `.catch` | High | Independent review confirmed the real SDK `storage.set()` returns void, so saving always threw after writing; await storage without chaining `.catch`, handle failures, and test against a synchronous SDK-shaped stub |
| Shared mutable `_ctx` can point mounted pages at a later registration | Medium | Capture context per registered page |
| No accessible input label/cancel button; toolbar can overflow narrow panes | Low | Named URL input, form Enter/Escape behavior, Cancel, wrapping layout |
| Clipboard read/write delegation unnecessary for an office viewer | Low | Remove delegated clipboard privileges; no-referrer policy |
| Dynamic plugin Tailwind classes may be missing from host's compiled CSS | Medium | Essential layout expressed in inline styles using host theme variables |
| Frame load was treated as proof of availability | Medium | Explicitly distinguish frame load from Studio/gateway health; persistent troubleshooting and browser actions |
| Default opened app root rather than office route | Low | Default and bare-origin normalization target `/office` |
| No reproducible regression suite or CI | Medium | Unit tests, Chromium integration harness, separate failing live-runtime probe, CI unit gate |

A non-sandboxed frame remains deliberate for a trusted Studio deployment's storage/WebGL compatibility. This is documented prominently; this plugin is not a safe viewer for arbitrary untrusted sites. URL settings are app-level, not per gateway profile.

## Actual execution results

- `npm test`: **9 passed, 0 failed**.
- `npm run test:e2e`: **14 passed**, no uncaught page exceptions in that run.
- Chromium exercised sidebar and palette registration/navigation, live Studio iframe, timeout regression, malformed URL rejection, persistence, failed save, failed browser action, remount, Escape, delayed-response recovery, corrupted saved settings, and 390px layout.
- Browser integration uses the real plugin and live Studio, but a **test-double SDK host** for registrations, storage and OS calls. The delayed response is an explicit fixture, not fabricated Studio output.
- `hermes plugins validate`: passed; skipped Python probe is expected for a Desktop-only plugin.
- `git diff --check`: passed.
- `npm audit`: 0 vulnerabilities reported.
- Direct authenticated backend WebSocket probes to both `localhost:9120` and `127.0.0.1:9120` received a gateway event. Persisted Studio token matched the running backend token; no tokens were logged.

## Remaining live-system blocker

**High / Functional — Studio fails to reach a connected office in a fresh Chromium context.**

Reproduce: run `node tests/runtime.mjs` with the two local servers running. This creates an isolated browser context, dismisses onboarding using only that context's storage, loads `/office`, and observes for 35 seconds.

Observed:

- `connected: false`
- `timedOut: true`
- Console: `Maximum update depth exceeded` (React state/effect loop)
- WebSocket: `WebSocket is closed before the connection is established.`

The same failure reproduces on Studio directly, without the Desktop plugin. Captured stack reaches `OfficeScreen.useEffect` at its gym cooldown state updater (`/root/hermes3d/src/features/office/screens/OfficeScreen.tsx:2999` in this checkout); this is **a stack location, not a proven root cause**. Direct backend auth succeeds, so this is not established as a bad-token or backend-down issue. No speculative upstream source edits were made. Runtime test correctly exits 1 instead of hiding the failure behind HTTP 200.

Evidence: local `qa/runtime-results.json`, `qa/runtime.png`; plugin harness evidence: `qa/results.json`, `qa/office.png`. Generated screenshots/results are excluded from git.

## Not verified

- Native Electron menu click/hot-reload: live Desktop CDP endpoint was unavailable. The user's app was not restarted or disrupted.
- Connected 3D scene, agent roster, chat execution or approval flows: blocked by the Studio runtime failure. No chats sent, agents created, or server credentials changed during QA.
- Public hosting / remote gateway topology and Windows/macOS browser launch behavior.
- GitHub Actions status must be checked after publication; local green is not CI green.
