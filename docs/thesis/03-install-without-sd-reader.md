# Install without an SD card reader / keyboard

## Locked approach (right now)

| Constraint | Solution |
|------------|----------|
| No SD card reader | Flash a **USB stick** on the Windows PC |
| No keyboard on the Pi | Pre-enable **SSH** in Raspberry Pi Imager → control from laptop |
| Touch display only | Fine for watching boot; setup is done over SSH (touch later for kiosk) |
| Network Install (Shift) | **Skip for now** — needs a USB keyboard |

**Chosen path: Path 1 — USB flash from PC + headless SSH**

Buy a keyboard later only if you want local typing; it is **not** required to get ARGUS running.

---

## Path 1 — Do this now (USB + laptop, no keyboard)

### What you need

| Item | Required? |
|------|-----------|
| Windows PC | Yes — flash with Imager |
| USB stick (or USB SSD) | Yes — 16 GB+ recommended (32 GB+ better for HA) |
| Pi 5 + 27 W PSU + cooler | Yes |
| Touch Display 2 connected | Yes (optional for install, useful to see boot) |
| Ethernet cable Pi → router | **Yes** (most reliable; same LAN as laptop) |
| Keyboard | **No** |
| microSD | Leave **out** so the Pi boots from USB |

### A) Flash on Windows

1. Install [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. Plug the USB stick into the PC.
3. Imager:
   - **Device:** Raspberry Pi 5  
   - **OS:** Raspberry Pi OS (64-bit) — **Desktop** (easier first)  
   - **Storage:** your USB stick (**double-check** — wrong disk = data loss)
4. When asked to edit **OS customisation** → **Edit settings** (do not skip):

   **General**
   - Hostname: e.g. `argus-pi`
   - Username + password: pick and **write them down** (needed for SSH)
   - Wireless LAN: skip if using Ethernet; fill only if you have no cable
   - Locale: Europe/Bratislava (or your zone), keyboard layout SK/US as you prefer

   **Services / Remote access**
   - **Enable SSH**
   - Use **password** authentication (simplest)

5. Apply → Write → wait until verify finishes.
6. Eject USB safely.

**Thesis:** screenshot Imager customisation (`P-IMAGER`).

### B) Boot the Pi (still no keyboard)

1. **Remove microSD** from the Pi (if inserted) so it prefers USB boot.
2. Plug USB stick into a **blue USB 3** port on the Pi.
3. Ethernet → router. Display ribbon OK. Cooler mounted.
4. Plug **27 W** USB-C power **last**.
5. Wait **2–3 minutes** on first boot (resizing filesystem). Touch screen may show desktop or rainbow/boot — either is fine.
6. On your laptop (same Wi‑Fi/LAN as the Pi):

```powershell
ssh YOUR_USERNAME@argus-pi.local
```

If `.local` fails, find the IP in the router DHCP list, then:

```powershell
ssh YOUR_USERNAME@192.168.x.x
```

7. First login: `sudo apt update && sudo apt full-upgrade -y`

### If USB does not boot

- Confirm stick is in USB **3** (blue).
- Try without microSD inserted.
- Power: must be solid 27 W supply.
- Rare: bootloader needs “USB boot” preference — that utility image normally needs an SD once; borrow a keyboard+reader later or ask for help if this happens.

---

## Path 3 — Network Install (only if you get a keyboard)

Hold **Shift** at power-on, Imager downloads over Ethernet, write to microSD in the Pi.  
**Does not work without a keyboard.** Keep as backup / thesis alternative.

---

## Path 2 — USB microSD reader (buy later)

Flash the microSD on the PC the same way as Path 1 (same SSH customisation).

---

## After first SSH — next thesis steps

1. Record hostname, IP, OS version in `CHANGELOG-SETUP.md`
2. Landscape display → `04-landscape-touch-display.md`
3. Docker + HA + ARGUS → `05-argus-and-ollama.md`
4. Later: migrate to a bigger USB SSD when you buy one

## Chosen path (locked)

- **Path:** **1 — USB from PC + SSH (no keyboard)**
- **OS:** Raspberry Pi OS 64-bit Desktop
- **Date:** 2026-08-05
- **Problems & fixes:** _(append below)_
