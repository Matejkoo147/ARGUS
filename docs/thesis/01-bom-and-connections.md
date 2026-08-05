# Bill of materials & physical connections

> Fill in purchase links / serials as you unbox. Mark `[x]` when verified.

## Hardware BOM

| # | Item | Spec / notes | Status |
|---|------|--------------|--------|
| 1 | Raspberry Pi 5 | **16 GB** RAM | [ ] |
| 2 | Active cooler | Official or compatible Pi 5 active cooler | [ ] |
| 3 | Power supply | Official **27 W** USB-C PSU (required for Pi 5 + display + SSD) | [ ] |
| 4 | Storage | microSD (have) **and/or** USB SSD / NVMe HAT | [ ] |
| 5 | Touch display | **Raspberry Pi Touch Display 2** 7″ — panel 720×1280 | [ ] |
| 6 | Display ribbon / FPC | From display kit to Pi DSI | [ ] |
| 7 | Ethernet cable | Strongly recommended for first boot / install | [ ] |
| 8 | USB microSD reader | Optional if flashing SD from PC | [ ] |
| 9 | USB SSD / stick | Preferred if no SD reader | [ ] |
| 10 | Case / stand | Landscape orientation for 7″ panel | [ ] |

### Home server (unchanged role for AI)

| Item | Role |
|------|------|
| mato-server | **Ollama only** for ARGUS Voice / Odysseus |
| WireGuard (optional) | Remote access from laptop |

---

## Physical connections (Pi 5 + Touch Display 2)

Draw / photograph this; text checklist for the thesis:

```
                    [ 7″ Touch Display 2 ]
                    native 720×1280 (portrait panel)
                              │
                    FPC / DSI ribbon cable
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ Raspberry Pi 5 (16 GB)                                   │
│  • DSI connector ← display                               │
│  • USB-C ← 27 W PSU                                      │
│  • Ethernet ← router/switch                              │
│  • microSD or USB boot storage                           │
│  • Active cooler mounted on SoC                          │
│  • Orientation: whole assembly rotated for LANDSCAPE UI  │
└──────────────────────────────────────────────────────────┘
```

### Connection steps (fill dates when done)

| Step | Action | Photo ID | Done |
|------|--------|----------|------|
| 1 | Mount active cooler on Pi 5 (thermal pad, screws) | P-COOLER | [ ] |
| 2 | Connect Touch Display 2 ribbon to **DSI** (orientation!) | P-DSI | [ ] |
| 3 | Secure display / Pi in landscape stand or case | P-MOUNT | [ ] |
| 4 | Insert storage (SD or USB SSD) | P-STORAGE | [ ] |
| 5 | Plug Ethernet | P-ETH | [ ] |
| 6 | Plug 27 W USB-C power last | P-PSU | [ ] |
| 7 | First boot LED / display activity | P-BOOT | [ ] |

**Safety notes for the write-up**

- Power **last**.
- Do not flex the FPC ribbon sharply.
- Official 27 W supply avoids brown-outs with cooler + display + USB storage.
- Keep airflow clear around the active cooler.

---

## Software roles (who talks to whom)

| From | To | Protocol / path |
|------|-----|-----------------|
| Touch kiosk (Chromium) | ARGUS on localhost | `https://127.0.0.1:9443` or HTTP local port |
| ARGUS | Home Assistant | `/api/ha` proxy → HA `:8123` |
| ARGUS Voice | mato-server Ollama | `/api/ollama` → upstream Ollama |
| Laptop (dev) | Pi | SSH + git deploy |
| Laptop | mato-server | WireGuard / LAN for Ollama admin |
