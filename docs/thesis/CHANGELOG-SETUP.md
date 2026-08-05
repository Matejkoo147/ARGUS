# Setup changelog (chronological)

Append every real step. Short entries are fine.

## 2026-08-05 — Planning

- Locked **Option B:** Raspberry Pi OS + Docker (HA + ARGUS + landscape kiosk); Ollama on mato-server.
- **No keyboard:** Network Install deferred. **Do now:** flash USB on Windows Imager with SSH pre-enabled; boot Pi from USB + Ethernet; SSH from laptop. Touch display only for viewing.
- Later: USB SSD upgrade; optional keyboard for local use.

## Next actions

1. Flash USB with Raspberry Pi OS 64-bit Desktop + SSH customisation.
2. Boot Pi (no microSD, USB in blue port, Ethernet, 27 W).
3. `ssh user@argus-pi.local` — record IP in this changelog.
4. Landscape → Docker → HA → ARGUS.
