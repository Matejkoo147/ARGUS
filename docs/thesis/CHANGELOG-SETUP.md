# Setup changelog (chronological)

Append every real step. Short entries are fine.

## 2026-08-05 — Planning

- Defined target: Pi 5 16 GB + active cooler + Touch Display 2 landscape; HA + ARGUS on Pi; Ollama on mato-server only.
- Constraint: microSD available, **no SD card reader** → prefer USB SSD flash or cheap USB reader.
- Created `docs/thesis/` living documentation for later PDF export.
- Architecture recommendation recorded: **Raspberry Pi OS + Docker (Option B)** for landscape kiosk feasibility; HAOS (Option A) noted as alternative if supervisor requires the name.
- Prior stack documented: ARGUS + HA Docker on mato-server (`DEPLOY.md`, `HA_SETUP.md`); UI work through v1.0.5 (portrait HUD, Voice TEST in conversation).

## Next actions

1. Confirm Option A vs B with thesis supervisor (or accept B).
2. Acquire USB SSD or USB SD reader; 27 W PSU if missing.
3. Photograph unboxing / cooler / DSI (photo checklist).
4. Flash OS; log image version and Pi IP here.
5. Apply landscape rotation; verify 1280×720.
6. Install Docker + HA + ARGUS; point Ollama to mato-server.
7. Kiosk autostart; end-to-end Voice TEST screenshot.
