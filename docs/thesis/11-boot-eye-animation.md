# ARGUS eye boot / shutdown ceremony

Creative full-screen **awaken / standby** animation built from the same panopticon emblem as `ArgusLogo` (cyan–magenta frame, four watcher nodes, red pupil). Documented for the thesis PDF and for implementation consistency.

## Concept

ARGUS is an all-seeing guardian. Boot and soft-shutdown should feel like the guardian **opening** and **closing** its eye — not a generic spinner or fade.

| Mode | Narrative | Trigger |
|------|-----------|---------|
| **Awaken (boot)** | Perimeter watchers light → lids part → iris blooms → wordmark → UI | Every full page load (kiosk Chromium start after Pi boot) |
| **Standby (shutdown)** | Gaze holds → lids meet → iris dies → nodes extinguish → black | Sign-out (sidebar Logout + Settings → Sign out); Settings preview |

**Important thesis note:** A hard Raspberry Pi / OS power-off cannot reliably finish a browser animation (Chromium is killed with the session). The “shutdown” ceremony is therefore a **soft standby / session end** inside ARGUS. True power-off still uses the OS; the creative eye-close is what the operator sees when leaving the session or previewing standby.

## Visual language (must stay consistent)

Reuse exact ARGUS palette and geometry from `src/components/ArgusLogo.tsx`:

- Frame gradient: `#8ec5ff` → `#00e5ff` → `#ff1a4b`
- Iris radial: cyan → deep teal → near-black
- Pupil: `#ff0033` → dark red → black + white catchlight
- Four cardinal nodes: cyan ring + red core (N → E → S → W)
- Background: `#020408` with light scanlines / vignette (same cyberpunk HUD feel)

Do **not** introduce purple-glow generic AI aesthetics, extra badges, or a different eye shape.

## Timing (current)

| Phase | Boot (~3.4 s) | Shutdown (~2.6 s) |
|-------|---------------|-------------------|
| Overlay | Solid black from t=0; fades out at ~2.85 s | Fades in over UI (~0.35 s) |
| Outer ring | Stroke draws in (~0.15–1.0 s) | Fades / undraws after lids close |
| Watcher nodes | Light N→E→S→W (~0.45–0.9 s) | Extinguish in order (~1.35–1.74 s) |
| Eye lids | Start closed (translated to midline) → open (~1.1–2.2 s) | Open → closed (~0.3–1.3 s) |
| Iris / pupil | `scaleY` from slit → full (~1.15–2.3 s) | Collapse to slit |
| Closed slit line | Visible while shut; hides as lids open | Appears as lids meet |
| Wordmark | “ARGUS” + “awakening perimeter watch” | “entering standby” then fade |

Constants: `BOOT_MS = 3400`, `SHUTDOWN_MS = 2600` in `ArgusEyeCeremony.tsx`.

`prefers-reduced-motion: reduce` → skip animation, complete immediately.

## Code map

| File | Role |
|------|------|
| `src/components/ArgusEyeCeremony.tsx` | Full-viewport SVG ceremony (boot / shutdown) |
| `src/components/CeremonyProvider.tsx` | Mounts ceremony; `runShutdown(after)`, `runPreview(mode)` |
| `src/App.tsx` | Wraps routes in `CeremonyProvider` (boot on first paint) |
| `src/components/AppShell.tsx` | Logout → eye-close → disconnect / reload |
| `src/pages/SettingsPage.tsx` | Preview Awaken / Preview Standby + Sign out ceremony |
| `src/styles/cyberpunk.css` | `.argus-ceremony*` keyframes |

Navbar / favicon logo stays on static `ArgusLogo` — ceremony is overlay-only so icons stay sharp and unchanged.

## Operator guide (Pi kiosk)

1. Deploy ARGUS build that includes the ceremony (`argus-update build` or equivalent).
2. Reboot Pi (or restart Chromium kiosk) → fullscreen black → eye **opens** → dashboard / connect UI.
3. Settings → **Boot ceremony** → **PREVIEW AWAKEN** / **PREVIEW STANDBY** for thesis screen recording without rebooting.
4. Sidebar **Logout** or Settings **SIGN OUT** → eye **closes** → session cleared.

See also [`10-argus-kiosk-startup.md`](10-argus-kiosk-startup.md) for Chromium kiosk install.

## Thesis screenshots / video

| ID | Shot |
|----|------|
| P-EYE-BOOT | Touch Display: mid-open eye during awaken (lids parting, iris visible) |
| P-EYE-OPEN | End of awaken / full open emblem before UI fade |
| P-EYE-CLOSE | Lids meeting / slit during standby |
| — | Optional short screen recording: boot → UI → sign-out close (10–15 s) |

Place stills under `docs/thesis/photos/` when captured (placeholders until then).

## Future ideas (not implemented)

- True “standby until tap”: stay on black after close; tap runs awaken without reload.
- Sync node pulse with alarm armed state during ceremony.
- Optional HA script / MQTT “ARGUS sleep” that only triggers soft standby (still not OS power-off).
