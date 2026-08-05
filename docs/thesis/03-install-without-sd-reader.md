# Install without an SD card reader

You have a **microSD** but **no USB reader / USB SSD yet** (buying later).  
**Chosen now: Path 3 — Network Install** → write Raspberry Pi OS onto the microSD **from the Pi itself**.

---

## Path 3 — Network Install (chosen for first boot)

The Pi 5 bootloader can download **Raspberry Pi Imager into RAM** over **wired Ethernet**. You then flash the OS onto the microSD that is already in the Pi. No PC card reader required.

### What you need on the desk

| Item | Required? | Notes |
|------|-----------|--------|
| Pi 5 16 GB + cooler | Yes | |
| Touch Display 2 (or any HDMI/DSI screen) | Yes | See landscape doc after OS is up |
| USB keyboard | Yes | For holding **Shift** and using Imager |
| Ethernet cable → router | Yes | **Wi‑Fi will not work** for Network Install |
| Blank / unused microSD | Yes | Inserted in the Pi (not pre-flashed) |
| Official 27 W USB-C PSU | Yes | |
| USB SSD / SD reader | No (later) | Optional upgrade after first install |

### Step-by-step

1. **Assemble** cooler, display ribbon (DSI), keyboard, Ethernet. Insert microSD. Do **not** power yet.
2. Power on while holding the **left Shift** key on the USB keyboard.
3. Screen should show the Network Installer (often red/white). It downloads Imager over the internet — wait.
4. If prompted, press **Space** / follow on-screen confirm.
5. In Imager on the Pi:
   - **Raspberry Pi 5**
   - **OS:** Raspberry Pi OS (64-bit) — **Desktop** recommended first (easier landscape + kiosk debugging). Lite later if you want a leaner thesis build.
   - **Storage:** the microSD card
6. Write + verify (can take several minutes — leave Ethernet connected).
7. Pi reboots into Raspberry Pi OS. Complete the first-boot wizard (locale, user, password). **Enable SSH** in the wizard or later via `raspi-config`.
8. Photograph: installer screen, OS choice, first desktop (thesis `P-IMAGER`, `P-BOOT`).

### If Shift does nothing / no installer

| Cause | Fix |
|-------|-----|
| Card already has a bootable OS | Hold Shift earlier, or temporarily remove card until installer UI, then insert — or wipe card later when you have a reader |
| No Ethernet / no DHCP | Use cable to router; check link lights |
| Old bootloader | Rare on new Pi 5; may need bootloader update via a flashed utility image (then you need a reader once) |
| Keyboard not ready | Use a wired USB keyboard; try again |

### After OS is installed (same day)

1. `sudo apt update && sudo apt full-upgrade -y`
2. Note hostname / IP (`hostname -I`) in `CHANGELOG-SETUP.md`
3. Landscape rotation → `04-landscape-touch-display.md`
4. Docker + HA + ARGUS → `05-argus-and-ollama.md`

---

## Path 1 — USB SSD from PC (buy later)

When you have a USB SSD/stick + optional reader:

1. Flash Raspberry Pi OS (or clone the working SD) onto USB SSD with Imager on the PC.
2. Boot from USB 3 (blue port). Faster + longer life than microSD for HA database writes.
3. Thesis: document migration SD → SSD as a reliability improvement.

## Path 2 — USB microSD reader (buy later)

Classic: flash on PC. Useful for recovery images / bootloader utilities.

## Path 4 — rpiboot + NVMe (optional later)

Only if you add an M.2 HAT.

---

## First-boot checklist

| Step | Check | Notes |
|------|--------|------|
| 1 | Ethernet link LEDs | Same LAN as laptop |
| 2 | Network Install completed | Pi OS on microSD |
| 3 | Find Pi IP | Router DHCP or `ping <hostname>.local` |
| 4 | SSH from laptop | `ssh user@pi-ip` |
| 5 | Display works | Then landscape |
| 6 | OS version recorded | `CHANGELOG-SETUP.md` |

## Chosen path (locked)

- **Path used:** **3 — Network Install**
- **OS target:** Raspberry Pi OS 64-bit (Desktop first)
- **Boot medium (now):** microSD in Pi
- **Boot medium (later):** USB SSD when purchased
- **Date started:** 2026-08-05
- **Problems & fixes:** _(append below as you go)_
