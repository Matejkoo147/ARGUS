# ARGUS as Pi startup screen (kiosk)

HA stays the **backend** only (`:8123`). The Touch Display shows **ARGUS** fullscreen on every boot.

## Prerequisites

1. Landscape rotation already working  
2. ARGUS Docker up: `http://127.0.0.1:9080`  
3. Desktop user auto-login (Pi OS Desktop)

## One-shot install (on the Pi)

```bash
cd ~/apps/argus
git pull
chmod +x scripts/pi-argus-kiosk.sh scripts/pi-install-kiosk.sh
./scripts/pi-install-kiosk.sh
```

This:

- Copies `pi-argus-kiosk.sh` → `~/bin/pi-argus-kiosk.sh`  
- Appends it to `~/.config/labwc/autostart` (Bookworm+ labwc)  
- Tries to set boot to desktop auto-login (`raspi-config` B4)  
- Waits for ARGUS HTTP before opening Chromium (so Docker can finish starting)  
- Uses `--kiosk` + `--password-store=basic` (avoids keyring popup)

## Manual check without reboot

```bash
~/bin/pi-argus-kiosk.sh &
```

You should get fullscreen ARGUS. Exit kiosk: `Alt+F4` or SSH and `pkill chromium`.

## Ensure containers start on boot

```bash
cd ~/apps/homeassistant && docker compose up -d
cd ~/apps/argus && docker compose up -d
# restart policy is usually unless-stopped in compose already
docker ps
```

## Disable / remove kiosk later

Edit `~/.config/labwc/autostart` and delete the block between:

```
# --- ARGUS kiosk begin ---
# --- ARGUS kiosk end ---
```

## Thesis screenshots

| ID | Shot |
|----|------|
| P-ARGUS | ARGUS fullscreen on Touch Display after reboot (no desktop icons visible under kiosk) |
| P-EYE-BOOT | Eye awaken mid-animation on kiosk boot (see `11-boot-eye-animation.md`) |
| P-EYE-CLOSE | Eye standby / sign-out close |
| — | Optional: HA `:8123` on laptop only — “backend, not the operator UI” |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Desktop appears, no browser | `cat ~/.config/labwc/autostart` — is ARGUS block there? `journalctl` / `~/.cache/argus-kiosk.log` |
| Keyring password prompt | Ensure `--password-store=basic` in script |
| Blank / connection refused | ARGUS not up yet — check `docker ps`, log wait loop; increase wait in script if needed |
| Not labwc (old OS) | Use Wayfire or LXDE autostart instead — see Raspberry Pi forum “labwc autostart” |
| Need to reach desktop | SSH in, `pkill -f chromium`, or temporarily comment kiosk block |
