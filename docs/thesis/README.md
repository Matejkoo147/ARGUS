# ARGUS — Master's thesis setup log

Living documentation for the hardware/software deployment of **ARGUS** (cyberpunk Home Assistant security UI).  
This folder is the source for a later **PDF** (with photos, diagrams, and step-by-step procedures).

## Target architecture (decision)

```
┌─────────────────────────────────────────────────────────────┐
│  Raspberry Pi 5 (16 GB) + active cooler                     │
│  + Raspberry Pi Touch Display 2 (7″) — LANDSCAPE 1280×720   │
│                                                             │
│   Home Assistant  ←→  ARGUS (Docker / nginx SPA)             │
│        │                    │                               │
│        │                    └── kiosk Chromium fullscreen   │
│        │                        on the 7″ touch panel       │
└────────┼────────────────────┼───────────────────────────────┘
         │ LAN / VPN          │ HTTPS proxy /api/ollama
         ▼                    ▼
   Sensors / cameras     mato-server (home server)
   (ReoLink, BLE, …)         └── Ollama only (AI models)
```

| Component | Where it runs | Notes |
|-----------|---------------|--------|
| Home Assistant | **Pi 5** | Core of the smart-home / security backend |
| ARGUS web UI | **Pi 5** | Served locally; shown fullscreen on the 7″ display |
| Touch kiosk | **Pi 5** | Landscape-only browser (no desktop chrome) |
| Ollama / Odysseus AI | **mato-server** | Only AI stays on the home server |
| Dev / git | Windows laptop | Push → pull & rebuild on Pi |

### Why landscape is mandatory

Touch Display 2 panel is **720 × 1280** in native portrait. ARGUS and the thesis demo assume **1280 × 720 landscape** (kiosk). Rotation is configured in the OS / display stack, not only in CSS.

### Install constraint (no SD card reader yet)

You have a microSD but **no reader / USB SSD yet** (buying later).

**Locked path:** Raspberry Pi **Network Install** (hold Shift) → Imager in RAM → write **Raspberry Pi OS** onto the microSD in the Pi. Needs Ethernet + USB keyboard + display. SSD migration comes later for HA write durability.

---

## Documents in this folder

| File | Purpose |
|------|---------|
| [01-bom-and-connections.md](01-bom-and-connections.md) | Hardware list + physical wiring |
| [02-architecture-decision.md](02-architecture-decision.md) | HA OS vs Pi OS + Docker (thesis trade-offs) |
| [03-install-without-sd-reader.md](03-install-without-sd-reader.md) | Network / USB install paths |
| [04-landscape-touch-display.md](04-landscape-touch-display.md) | Force landscape 1280×720 |
| [05-argus-and-ollama.md](05-argus-and-ollama.md) | ARGUS on Pi, Ollama on mato-server |
| [06-photo-checklist.md](06-photo-checklist.md) | Photos to shoot for the PDF |
| [CHANGELOG-SETUP.md](CHANGELOG-SETUP.md) | Chronological log of what you did |

Update these as you build. Do not invent photos — use placeholders until you shoot them.

---

## Previous setup (before this migration)

Documented for the thesis “evolution” chapter:

- **mato-server** (Ubuntu + WireGuard): ARGUS Docker `:9080` / HTTPS `:9443`, HA in Docker, Ollama on same host.
- Dev on Windows; deploy via `git pull && argus-update build`.
- See repo root: `DEPLOY.md`, `HA_SETUP.md`.

New goal: **Pi 5 = HA + ARGUS + touch kiosk**; **mato-server = Ollama only** (plus optional VPN/backup).
