# Install without an SD card reader

You have a microSD but **no reader**. Use one of these paths (document which one you used).

## Path 1 — Flash a USB SSD / USB stick from the PC (recommended)

Works for **Raspberry Pi OS** and can work for **HAOS** images via Raspberry Pi Imager.

### Steps

1. On Windows: install [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. Plug USB SSD or USB 3 stick into the PC.
3. Imager → **Raspberry Pi 5** → choose OS:
   - **Option B stack:** Raspberry Pi OS (64-bit) — Lite if you want minimal; Desktop if you want easier kiosk debugging.
   - **Option A stack:** Other specific-purpose OS → Home Assistant → HAOS for Pi 5.
4. Choose the USB drive as storage → Write.
5. On Pi 5: connect USB SSD to a **blue USB 3** port, Ethernet, display, cooler, then 27 W power.
6. If USB boot fails: one-time bootloader update may be required (needs *any* bootable SD once — borrow a reader or buy a €5 adapter). Imager → Misc utility images → Bootloader → USB Boot.

**Thesis note:** Photograph Imager settings screen and the USB SSD plugged into the Pi.

## Path 2 — Buy / borrow a USB microSD reader

Official HA docs assume this. Fastest if you want classic HAOS-on-SD.

1. Flash microSD with Imager (HAOS or Pi OS).
2. Insert into Pi → Ethernet → power.

## Path 3 — “Network install” (Raspberry Pi Imager network install)

Raspberry Pi **EEPROM network installer** can load Imager over Ethernet (hold Shift at power-on on supported firmware). Useful when the board can boot enough to fetch an OS **without** pre-flashed media — but:

- Needs working Ethernet + compatible bootloader.
- You still choose and write an OS image during the flow.
- Document exact Imager version and bootloader version if you use this.

## Path 4 — rpiboot mass-storage (NVMe HAT, advanced)

If you later add an M.2 NVMe HAT: hold Pi 5 power button, USB-C to PC, `rpiboot` mass-storage gadget, flash NVMe from Imager. No SD reader. Overkill unless you already have NVMe.

---

## First-boot checklist (any path)

| Step | Check | Notes |
|------|--------|------|
| 1 | Ethernet link LEDs | Same LAN as laptop |
| 2 | Find Pi IP | Router DHCP list, or `ping raspberrypi.local` / `homeassistant.local` |
| 3 | SSH (Pi OS) or HA onboarding (`:8123`) | Screenshot for thesis |
| 4 | Display shows something | Then apply landscape (see `04-landscape-touch-display.md`) |
| 5 | Update OS / HA | Record versions in `CHANGELOG-SETUP.md` |

## Chosen path (fill in)

- **Path used:** _______________________
- **Date:** _______________________
- **Image / version:** _______________________
- **Boot medium:** USB SSD / microSD / NVMe / other
- **Problems & fixes:** _(log below)_
