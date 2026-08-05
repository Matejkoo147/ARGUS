# Install — thesis path (microSD reader + Ethernet)

## Locked install method (for screenshots & write-up)

This is the **official, reproducible** path for the master’s thesis:

| Item | Role |
|------|------|
| USB **microSD card reader** | Flash the card on the Windows PC |
| microSD (32 GB+ A2 recommended) | Boot / OS storage |
| **Ethernet** cable | Pi ↔ router (reliable first boot + HA later) |
| Raspberry Pi Imager | Write Raspberry Pi OS 64-bit Desktop |
| Keyboard (USB) | Optional on first boot if SSH is pre-enabled; useful for thesis photos of the wizard |

**Do not use** Wi‑Fi-only or USB-stick boot for the thesis primary narrative — keep those as appendix fallbacks only.

**Chosen stack remains Option B:** Raspberry Pi OS + Docker (HA + ARGUS). Ollama stays on mato-server.

---

## What to buy / bring home

- [ ] USB microSD reader  
- [ ] Ethernet cable  
- [ ] Official 27 W USB-C PSU (if not already)  
- [ ] Optional: USB keyboard for on-screen wizard photos  

Hardware assembly (cooler + Touch Display 2) is in [`01-bom-and-connections.md`](01-bom-and-connections.md) — **assemble before first power-on**, then flash & boot.

---

## Step-by-step (at home)

### 1) Assemble hardware (power off)

Follow detailed steps in `01-bom-and-connections.md`:

1. Mount **Active Cooler**  
2. Connect **Touch Display 2** (FFC + GPIO power)  
3. Insert **microSD** only after flashing (step 2)  
4. Plug **Ethernet**  
5. Power **last**

Photograph each step (`06-photo-checklist.md`).

### 2) Flash microSD on the PC

1. Insert microSD into the **USB reader** → PC.  
2. Open [Raspberry Pi Imager](https://www.raspberrypi.com/software/).  
3. **Device:** Raspberry Pi 5  
4. **OS:** Raspberry Pi OS (64-bit) — **Desktop**  
5. **Storage:** the microSD (verify the drive letter)  
6. **OS customisation** → Edit settings:

   | Setting | Value |
   |---------|--------|
   | Hostname | e.g. `argus-pi` |
   | Username / password | Your thesis login (write down) |
   | Wireless LAN | Optional — Ethernet is primary |
   | Locale | Europe/Bratislava (or yours) |
   | **SSH** | **Enabled** (password) |

7. Screenshot Imager screens for thesis (`P-IMAGER`).  
8. Write → Verify → Eject safely.

### 3) First boot with Ethernet

1. Insert flashed microSD into the Pi.  
2. Ethernet → router (same LAN as laptop).  
3. Display already connected.  
4. Plug **27 W** USB-C **last**.  
5. Wait for desktop / first-boot wizard on the Touch Display.  
6. Screenshot boot + desktop (`P-BOOT`).  
7. From laptop:

```powershell
ssh YOUR_USERNAME@argus-pi.local
```

Or use the IP from the router / on-screen network info.

8. Update:

```bash
sudo apt update && sudo apt full-upgrade -y
```

Record hostname, IP, OS version in `CHANGELOG-SETUP.md`.

### 4) After OS is up

1. Landscape rotation → `04-landscape-touch-display.md`  
2. Docker + HA + ARGUS → `05-argus-and-ollama.md`  
3. Kiosk + Voice TEST screenshot  

---

## Appendix — not the thesis primary path

| Alternative | When |
|-------------|------|
| USB stick boot | Temporary if no SD reader |
| Wi‑Fi-only Imager | Temporary if no Ethernet |
| Network Install (Shift) | Needs keyboard + Ethernet; optional anecdote |

---

## Chosen path (locked)

- **Path:** microSD via USB reader + Raspberry Pi Imager + **Ethernet**  
- **OS:** Raspberry Pi OS 64-bit Desktop  
- **Architecture:** Option B (Docker HA + ARGUS on Pi; Ollama on mato-server)  
- **Date locked:** 2026-08-05  
- **Problems & fixes:** _(append when you install at home)_
