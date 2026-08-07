# ARGUS eye boot / shutdown ceremony

Creative full-screen **awaken / standby** animation built from the same panopticon emblem as `ArgusLogo` (cyan–magenta frame, four watcher nodes, red pupil). Documented for the thesis PDF and for implementation consistency.

## How it works on the Pi (what you see after reboot)

```
Pi power on / reboot
   → Raspberry Pi OS + desktop auto-login
   → Docker starts ARGUS (:9080) + Home Assistant
   → labwc autostart runs ~/bin/pi-argus-kiosk.sh
   → script waits until http://127.0.0.1:9080 answers
   → Chromium opens fullscreen:  …/?kiosk=1
   → ARGUS React loads → detects kiosk flag → eye OPENS → UI
```

So yes: **every Pi reboot that brings up the kiosk shows the awaken ceremony.**  
It is not a separate OS splash screen — it is the first thing inside the ARGUS web UI once Chromium loads.

Laptop / phone browsers open ARGUS **without** `?kiosk=1`, so they **do not** auto-play the eye on every refresh. Use Settings → Preview if you want to record it off the Pi.

## Concept

ARGUS is an all-seeing guardian. Boot and soft-shutdown should feel like the guardian **opening** and **closing** its eye — not a generic spinner or fade.

| Mode | Narrative | Trigger |
|------|-----------|---------|
| **Awaken (boot)** | Perimeter watchers light → lids part → iris blooms → wordmark → UI | **Kiosk only** — Chromium started with `?kiosk=1` (Pi reboot / kiosk script) |
| **Standby (shutdown)** | Gaze holds → lids meet → iris dies → nodes extinguish → black | Sign-out (sidebar Logout + Settings → Sign out); Settings preview |

**Important thesis note:** A hard Raspberry Pi / OS power-off cannot reliably finish a browser animation (Chromium is killed with the session). The “shutdown” ceremony is therefore a **soft standby / session end** inside ARGUS. True power-off still uses the OS; the creative eye-close is what the operator sees when leaving the session or previewing standby.

## Kiosk flag

| Piece | Detail |
|-------|--------|
| Default kiosk URL | `http://127.0.0.1:9080/?kiosk=1` (`scripts/pi-argus-kiosk.sh`) |
| Detection | `src/lib/kiosk.ts` — query `kiosk=1` (stored in `sessionStorage` for that Chromium session) |
| Auto-awaken | `CeremonyProvider` starts in `boot` **only** if `isKioskMode()` |
| Preview | Settings always can force awaken/standby without the flag |

Re-install kiosk after pull so `~/bin/pi-argus-kiosk.sh` gets the new URL:

```bash
cd ~/apps/argus && git pull && ./scripts/pi-install-kiosk.sh
```

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
| Eye lids | Start closed → open (~1.1–2.2 s) | Open → closed (~0.3–1.3 s) |
| Iris / pupil | `scaleY` from slit → full | Collapse to slit |
| Wordmark | “awakening perimeter watch” | “entering standby” |

Constants: `BOOT_MS = 3400`, `SHUTDOWN_MS = 2600` in `ArgusEyeCeremony.tsx`.

`prefers-reduced-motion: reduce` → skip animation, complete immediately.

## Code map

| File | Role |
|------|------|
| `src/lib/kiosk.ts` | Detect `?kiosk=1` / session flag |
| `src/components/ArgusEyeCeremony.tsx` | Full-viewport SVG ceremony |
| `src/components/CeremonyProvider.tsx` | Auto-boot only in kiosk |
| `scripts/pi-argus-kiosk.sh` | Opens Chromium with `?kiosk=1` |
| `src/styles/cyberpunk.css` | `.argus-ceremony*` keyframes |

## Operator guide (Pi kiosk)

1. Deploy ARGUS (`argus-update build` or equivalent).
2. Re-run `./scripts/pi-install-kiosk.sh` so the kiosk URL includes `?kiosk=1`.
3. Reboot Pi → Chromium kiosk → eye **opens** → UI.
4. Settings → **PREVIEW AWAKEN** / **PREVIEW STANDBY** without rebooting.
5. **Logout** → eye **closes** → session cleared.

See also [`10-argus-kiosk-startup.md`](10-argus-kiosk-startup.md).

## Thesis screenshots / video

| ID | Shot |
|----|------|
| P-EYE-BOOT | Touch Display: mid-open eye during awaken |
| P-EYE-OPEN | Full open emblem before UI fade |
| P-EYE-CLOSE | Lids meeting / slit during standby |
| — | Optional clip: Pi reboot → eye open → UI |

## Future ideas (not implemented)

- True “standby until tap”: stay on black after close; tap runs awaken without reload.
- Optional HA / MQTT “ARGUS sleep” soft standby (still not OS power-off).
