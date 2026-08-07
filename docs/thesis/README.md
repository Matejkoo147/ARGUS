# ARGUS — Master's thesis setup log

Living documentation for hardware/software deployment of **ARGUS**. Source for a later **PDF** with photos.

## Target architecture (locked)

```
┌─────────────────────────────────────────────────────────────┐
│  Raspberry Pi 5 (16 GB) + Active Cooler                     │
│  + Touch Display 2 (7″) — OS landscape ≈ 1280×720           │
│                                                             │
│   Home Assistant (Docker)  ←→  ARGUS (Docker / nginx)       │
│                                    └── Chromium kiosk       │
└───────────────┬────────────────────┬────────────────────────┘
                │ Ethernet LAN       │ /api/ollama
                ▼                    ▼
         sensors / cameras     mato-server → Ollama only
```

| Component | Where |
|-----------|--------|
| Raspberry Pi OS + Docker | **Pi 5** |
| Home Assistant + ARGUS + touch kiosk | **Pi 5** |
| Ollama / Odysseus AI | **mato-server only** |

### Install method (locked for thesis)

**microSD flashed on PC with a USB card reader + Ethernet** on first boot.  
See [`03-install-without-sd-reader.md`](03-install-without-sd-reader.md) (filename kept; content is the official thesis path).

### Physical assembly

Detailed cooler + Touch Display 2 wiring: [`01-bom-and-connections.md`](01-bom-and-connections.md).

---

## Documents

| File | Purpose |
|------|---------|
| [01-bom-and-connections.md](01-bom-and-connections.md) | BOM, cooler, display, fan behaviour |
| [02-architecture-decision.md](02-architecture-decision.md) | Option B locked |
| [03-install-without-sd-reader.md](03-install-without-sd-reader.md) | microSD reader + Ethernet install |
| [04-landscape-touch-display.md](04-landscape-touch-display.md) | Landscape 1280×720 |
| [05-argus-and-ollama.md](05-argus-and-ollama.md) | ARGUS on Pi, Ollama on server |
| [06-photo-checklist.md](06-photo-checklist.md) | Photos for PDF |
| [07-session-after-os.md](07-session-after-os.md) | What to do after Pi OS + when to screenshot |
| [08-mato-server-ollama-only.md](08-mato-server-ollama-only.md) | Remove ARGUS/HA from home server; keep Ollama |
| [10-argus-kiosk-startup.md](10-argus-kiosk-startup.md) | ARGUS fullscreen on Pi boot (HA backend only) |
| [11-boot-eye-animation.md](11-boot-eye-animation.md) | Eye open/close boot & standby ceremony |
| [CHANGELOG-SETUP.md](CHANGELOG-SETUP.md) | Chronological log |

## Previous setup (migration chapter)

mato-server used to run ARGUS + HA Docker; now **Ollama only**. See `08-mato-server-ollama-only.md`, root `DEPLOY.md`, `HA_SETUP.md`.
