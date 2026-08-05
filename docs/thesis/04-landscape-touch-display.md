# Landscape mode — Raspberry Pi Touch Display 2

## Facts

| Property | Value |
|----------|--------|
| Product | Raspberry Pi Touch Display 2 (7″) |
| Native panel | **720 × 1280** (portrait) |
| ARGUS / thesis UI | **1280 × 720** landscape |
| Connection | DSI ribbon to Pi 5 |

ARGUS CSS already has a kiosk-oriented layout for `(min-width: 900px) and (max-height: 820px)`. The **panel must be rotated in the OS** so the browser reports ~1280×720, not portrait stacking.

## Raspberry Pi OS (Option B) — approach

Exact commands depend on Bookworm (labwc / Wayland) vs older X11. Plan:

1. Confirm display is detected: `kmsprint` / Screen Configuration.
2. Rotate **90° or 270°** so the physical stand is landscape and touch axes match.
3. Persist rotation across reboot (labwc config or `cmdline` / overlay — record the final file contents here).
4. Calibrate / verify touch: taps match icons after rotation (critical).
5. Chromium kiosk:
   ```bash
   chromium-browser --kiosk --noerrdialogs --disable-infobars \
     --app=http://127.0.0.1:9080
   ```
   Autostart via `wayfire.ini` / labwc autostart / systemd user service.

### Placeholder — final working config

```
# Paste the working rotation + kiosk unit here after it works
```

## HAOS (Option A)

If you insist on HAOS: landscape + fullscreen ARGUS on DSI is **non-trivial**. Options researched for the thesis appendix:

- Custom kiosk add-on (community, may break on updates)
- External browser device (breaks “one Pi” story)

Document whichever path you actually ran; do not claim HAOS kiosk without screenshots.

## Verification for thesis

| Check | Pass |
|-------|------|
| `window.innerWidth` ≈ 1280 in browser console | [ ] |
| `window.innerHeight` ≈ 720 | [ ] |
| ARGUS bottom nav **not** used (left sidebar visible) | [ ] |
| Touch targets align with icons | [ ] |
| Cooler not blocked by display mount | [ ] |
