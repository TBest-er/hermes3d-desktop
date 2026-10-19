# Hermes3D Desktop plugin

Adds a **Hermes3D** sidebar row and **Hermes3D: Open the 3D office** palette command to Hermes Desktop. Both open an embedded Studio page, with editable URL, reload, browser action and troubleshooting help.

This is an unofficial Desktop integration for [Hermes3D](https://github.com/iamlukethedev/Hermes3D), not the Studio server itself. Studio and its Hermes gateway must run separately. No Python entry point is required for this Desktop-only plugin.

## Install

```sh
hermes plugins install TBest-er/hermes3d-desktop
hermes plugins enable hermes3d
```

Enable the Desktop half under **Settings → Plugins** if it is off. Standalone alternative: copy `desktop/plugin.js` to `$HERMES_HOME/desktop-plugins/hermes3d/plugin.js` (normally `~/.hermes/desktop-plugins/hermes3d/plugin.js`). Do not edit core Desktop files.

The page defaults to `http://127.0.0.1:3000/office`. Use **Change URL** to point to your running Studio. A bare origin is normalized to `/office`. Settings persist through the plugin's app-level storage, not per gateway profile. Invalid saved settings fall back safely; failed saves leave the current page unchanged.

## Trust and connectivity

- Embed only a Studio deployment you trust. The frame deliberately is **not sandboxed**, because Studio requires normal origin storage and WebGL. Scripts execute with the Studio origin; never point this at arbitrary untrusted content.
- URLs must be HTTP(S), without embedded credentials, query strings or fragments. Configure gateway credentials in Studio, never in this URL. Clipboard permissions are not delegated.
- `localhost` means the machine running Desktop, **not** a remote gateway server. Use a reachable trusted Studio URL or a secure tunnel for remote deployments.
- Studio must permit framing by Desktop. Relax framing headers only on a loopback/private deployment; do not broadly expose an unprotected server.
- **Frame loaded is not a health check.** Browsers can fire iframe `load` for error pages; cross-origin access prevents inspecting Studio health from the plugin. Verify Studio's own gateway indicator. **Help** and **Open in browser** remain available for diagnosis.
- Slow responses show a warning after eight seconds but keep the frame mounted, so a delayed Next.js compile can still finish. **Reload** starts a fresh attempt.

## Development and QA

```sh
npm ci
npx playwright install chromium
npm test
npm run test:e2e
```

The browser suite requires a running Studio on `127.0.0.1:3000`. It uses real Chromium and the real plugin, with an explicitly mocked SDK host for registration, OS and storage. Studio is a live iframe; the slow-network response is a labelled test fixture. These tests do not automate the native Electron menu or prove the Studio gateway works.

For a separate live gateway/renderer check:

```sh
node tests/runtime.mjs
```

### Studio / Next 16.1.7 HMR compatibility

If Studio's gateway times out while its `/_next/webpack-hmr` WebSocket never finishes the handshake, the inspected custom server routes HMR through a no-op Next server handler. Chromium can queue the gateway WebSocket behind that unfinished connection. The reviewed compatibility script switches to the prepared router's upgrade handler:

```sh
node scripts/fix-studio-hmr.mjs /path/to/Hermes3D
```

Restart **only Studio** after applying. The script is idempotent, saves a backup, and refuses unreviewed Next versions or changed server layouts. It has been applied and live-tested on the local Studio deployment; it does not change authentication, gateway credentials, or Next dependencies. This is a narrowly version-bound compatibility patch, not a permanent framework API guarantee.

The runtime test skips onboarding **only in an isolated browser context**, captures console errors, and fails unless a connected runtime indicator appears. It does not send chats, create agents or change server settings. See `qa/report.md` for the verified results and remaining limitations.
