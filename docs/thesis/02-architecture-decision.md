# Architecture decision — HA OS vs Raspberry Pi OS

This choice affects **install difficulty**, **touch kiosk feasibility**, and how you describe the system in the thesis.

## Goal checklist

- [x] Home Assistant on Pi 5 (16 GB)
- [x] ARGUS UI on the same Pi
- [x] 7″ Touch Display 2 in **landscape only**
- [x] Ollama **only** on mato-server
- [x] Install **without** an SD card reader (or with a cheap USB reader / USB SSD)

## Option A — Home Assistant OS (HAOS) on the Pi

**Pros**

- Official HA recommendation; Supervisor, add-ons, easy updates.
- Strong “appliance” story for a security / smart-home thesis.

**Cons for *this* project**

- HAOS is **headless-first**. There is no normal desktop to run Chromium kiosk easily.
- Landscape rotation of Touch Display 2 under HAOS is poorly supported compared to Raspberry Pi OS.
- Running custom ARGUS (nginx + SPA + proxies) means a **custom add-on** or Supervisor Docker hacks — more brittle to document and defend in an exam.

**When to pick A:** HA backend only on the Pi; ARGUS/kiosk on another device (not your stated goal).

## Option B — Raspberry Pi OS + Docker (recommended for ARGUS + 7″ landscape)

**Stack**

1. Raspberry Pi OS (Bookworm) 64-bit on USB SSD or microSD  
2. Docker: **Home Assistant Container** (or Supervised if you need add-ons)  
3. Docker: **ARGUS** (same compose pattern as mato-server)  
4. Chromium **kiosk** autostart, display rotated to landscape  
5. Ollama upstream = mato-server IP / WireGuard

**Pros**

- Full control of DSI rotation (`dtoverlay` / Wayland / `wlr-randr`).
- ARGUS deploy stays close to existing `DEPLOY.md` (Docker + nginx).
- Honest, reproducible master’s write-up: clear layers (OS → Docker → UI → AI).

**Cons**

- You manage OS updates yourself (document the procedure).
- “HA Container” ≠ HAOS Supervisor/add-on store (state that clearly in the thesis).

## Option C — Hybrid

- HAOS on Pi for HA only  
- Separate small board / old phone as ARGUS kiosk  

Rejected for your goal: one Pi + one display.

---

## Decision for ARGUS thesis (default)

**Recommended: Option B — Raspberry Pi OS + Docker HA + ARGUS + landscape kiosk.**

In the thesis, frame it as:

> *Edge node (Raspberry Pi 5) runs Home Assistant and the ARGUS command UI on a local 7″ landscape touch panel. Large-language-model inference (Ollama) remains on a separate home server to isolate GPU/CPU load and keep the edge device responsive.*

If your supervisor **requires** the words “Home Assistant OS”, we can still try Option A with a custom add-on — but expect extra weeks of display/kiosk pain. Confirm with them before locking Option A.

| Decision | Value | Date |
|----------|--------|------|
| Chosen option | **B — Raspberry Pi OS + Docker** | 2026-08-05 |
| First install | **USB stick via PC Imager + SSH** (no keyboard on Pi) | 2026-08-05 |
| Not used yet | Network Install (needs keyboard) | |
| Later upgrade | Larger USB SSD / reader when purchased | |
| AI host | mato-server Ollama | |
