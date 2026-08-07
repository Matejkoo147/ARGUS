# Landscape mode — Raspberry Pi Touch Display 2

## Facts

| Property | Value |
|----------|--------|
| Product | Raspberry Pi Touch Display 2 (7″) |
| Native panel | **720 × 1280** (portrait) |
| ARGUS / thesis UI | **1280 × 720** landscape |
| Connection | DSI ribbon to Pi 5 |

ARGUS CSS already has a kiosk layout for `(min-width: 900px) and (max-height: 820px)`. Rotate in the OS so the browser reports landscape.

## Rotate (Bookworm desktop)

1. **Preferences → Screen Configuration**  
2. Right-click DSI / Touch Display → **Orientation** → **Right** or **Left**  
3. Apply; confirm touch still lines up  
4. Reboot once to confirm it persists  

## ARGUS as startup screen

After ARGUS is running on `:9080`, install the kiosk:

→ **[`10-argus-kiosk-startup.md`](10-argus-kiosk-startup.md)**  
→ scripts: `scripts/pi-install-kiosk.sh`, `scripts/pi-argus-kiosk.sh`

HA (`:8123`) is **not** shown on the panel — only used as backend / setup from a laptop if needed.

## Verification

| Check | Pass |
|-------|------|
| Landscape after reboot | [ ] |
| ARGUS kiosk on boot | [ ] |
| Touch hits correct controls | [ ] |
| HA reachable on `:8123` from laptop only | [ ] |
