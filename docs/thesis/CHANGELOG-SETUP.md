# Setup changelog (chronological)

## 2026-08-05 — Planning

- Locked **Option B:** Raspberry Pi OS + Docker (HA + ARGUS + landscape kiosk); Ollama on mato-server.
- Locked **thesis install path:** flash **microSD** with USB **card reader** on PC + **Ethernet** first boot.
- Documented Active Cooler + Touch Display 2 connections; fan is firmware PWM.

## 2026-08-06 — Case / cover logo (CAD)

- ARGUS emblem vectors for engraving into RPi wall-mount `pi_cover` (Printables STLs).
- Files under `Diplomová práca/3D model - RPI wall mount s logom/logo/`.

## 2026-08-07 — Hardware live + Pi OS

- Active Cooler installed; Touch Display 2 on; touch working; Ethernet working.
- Raspberry Pi OS on microSD; apt upgraded.
- Documented teardown of ARGUS/HA on mato-server → **Ollama only** (`08-mato-server-ollama-only.md`).

## Next actions

1. Catch-up thesis photos → landscape → Docker on Pi.
2. HA + ARGUS on Pi.
3. On mato-server: backup HA if needed, then stop/remove ARGUS+HA; keep Ollama reachable from Pi LAN.
