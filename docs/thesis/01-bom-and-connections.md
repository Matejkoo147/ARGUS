# Bill of materials & physical connections

> Mark `[x]` when verified. Photograph every step for the thesis PDF.

## Hardware BOM

| # | Item | Spec / notes | Status |
|---|------|--------------|--------|
| 1 | Raspberry Pi 5 | **16 GB** RAM | [ ] |
| 2 | Active Cooler | Official Raspberry Pi Active Cooler for Pi 5 | [ ] |
| 3 | Power supply | Official **27 W** USB-C PSU | [ ] |
| 4 | microSD | 32 GB+ **A2** recommended | [ ] |
| 5 | USB microSD reader | For flashing on PC (thesis path) | [ ] |
| 6 | Ethernet cable | Pi ↔ router | [ ] |
| 7 | Touch Display 2 | Official **7″** (720×1280 native) | [ ] |
| 8 | FFC ribbon | **22-way ↔ 15-way** (included for Pi 5) | [ ] |
| 9 | GPIO power cable | Display J1 ↔ Pi 5V/GND (included) | [ ] |
| 10 | USB keyboard | Optional for wizard / thesis photos | [ ] |
| 11 | Case / landscape stand | Whole unit oriented for **1280×720** UI | [ ] |

### Home server

| Item | Role |
|------|------|
| mato-server | **Ollama only** (ARGUS Voice / Odysseus) |

---

## Order of assembly (power always last)

```
1. Active Cooler on Pi 5
2. Touch Display 2 FFC (DSI) + GPIO power
3. (Optional) Mount Pi to display stand-offs
4. Flash microSD on PC → insert into Pi
5. Ethernet cable
6. 27 W USB-C power  ← LAST
```

```
                    [ Touch Display 2 — 7″ ]
                    panel 720×1280 (rotate OS → landscape UI)
                         │                    │
              22↔15 FFC (DSI)         GPIO cable (5V + GND)
                         │                    │
                         ▼                    ▼
              ┌─────────────────────────────────────────┐
              │  Raspberry Pi 5 (16 GB)                 │
              │  • Active Cooler on SoC + fan header    │
              │  • DISP/DSI-1 ← FFC                     │
              │  • GPIO pins 2 & 6 ← display power      │
              │  • microSD slot                         │
              │  • Ethernet ← router                    │
              │  • USB-C ← 27 W PSU                     │
              └─────────────────────────────────────────┘
```

---

## A) Active Cooler — how to connect

Official cooler = aluminium heatsink + blower fan. It mounts **before** the display if the cooler would be hard to reach afterward.

### Parts

- Heatsink with **pre-applied thermal pads** (do not peel dirt into them; do not reuse pads if removed)  
- Spring-loaded **push pins**  
- Short **4-pin fan cable** → Pi **FAN** header (JST, next to GPIO / USB area)

### Steps (power disconnected)

1. Place the Pi on a clean, non-conductive surface. Identify the SoC (main chip under where the cooler sits) and the **4-pin fan connector**.  
2. Align the cooler so the thermal pads sit on the SoC / PMIC pads as designed (blower exhaust should not be blocked).  
3. Press the **spring push pins** through the mounting holes until they click on the underside. Pins should sit flush and secure — do not force crooked.  
4. Plug the cooler's **4-pin connector** into the Pi **FAN** header. Orientation is keyed; do not force.  
5. Photograph top and side (`P-COOLER`).

**Official note:** Prefer not to remove the cooler once fitted — pins and pads degrade.

### When does the fan start working?

| Phase | What happens |
|-------|----------------|
| Cooler mounted, **no power** | Nothing — fan is off. |
| Power applied (any bootable state) | Fan is driven by the **Pi 5 firmware** via the FAN header (PWM). You may see a **brief spin** at power-on as a check. |
| Idle / cool | Fan often **stays off** (silent). The **heatsink still cools passively** as soon as the board is powered. |
| CPU warms up | Firmware turns the fan on around **~60 °C**, speeds up ~**67.5 °C**, full speed ~**75 °C**, then spins down as it cools. |

So: you do **not** wait until Raspberry Pi OS is “fully installed” for the cooler to be useful.

- **Heatsink:** works whenever the board has power.  
- **Fan:** controlled by **board firmware** (works with Raspberry Pi OS; thresholds are the official defaults). Under light load the fan may never spin — that is normal.  
- After OS is up you can check temperature: `vcgencmd measure_temp` and confirm the fan node exists under `/sys/class/thermal/` / cooling devices.

For the thesis: “Active cooling is firmware-managed on the Pi 5 FAN header; the blower engages above firmware temperature thresholds while the aluminium heatsink provides continuous passive dissipation.”

---

## B) Touch Display 2 — how to connect (Pi 5)

**Always disconnect USB-C power before connecting cables.**

### Cables (from the kit)

| Cable | Use on Pi 5 |
|-------|-------------|
| **22-way to 15-way FFC** | Video/touch data (DSI). **Larger (15-way) end → display; smaller (22-way) end → Pi.** |
| GPIO power cable | 5 V + GND from Pi GPIO → display **J1** |

Do **not** use the 15↔15 cable meant for older Pis when wiring a Pi 5.

### B1 — FFC to the display

1. On the back of Touch Display 2, find the FFC connector.  
2. Gently lift / slide the **retaining clips** outward on both sides.  
3. Insert the **larger 15-way** end with **metal contacts facing up / away from the display panel** (contacts away from the screen).  
4. Push both retaining clips down so the cable is locked flat — no angle, no wrinkles.  
5. Photo (`P-DSI` — display side).

### B2 — FFC to the Pi 5

1. On the Pi 5, find the connector labelled **DISPLAY** / **DISP** (prefer **CAM/DISP 1** if there are two).  
2. Lift the retaining clips.  
3. Insert the **smaller 22-way** end with **metal contacts facing toward the Ethernet and USB-A ports**.  
4. Lock the clips. Cable should lie flat without sharp bends.  
5. Photo (`P-DSI` — Pi side).

### B3 — GPIO power to the display

1. Plug the small connector into display port **J1**.  
2. On the Pi 40-pin header (Ethernet/USB facing down toward you, header at the top of the board):  
   - **Red (5 V)** → **pin 2** (outer corner pin, top-right)  
   - **Black (GND)** → **pin 6**  
   - (Cable may also seat on pin 4; follow the included keyed housing — red = 5 V, black = GND.)  
3. Photo of GPIO (`P-DSI` power).

### B4 — Optional mechanical mount

Align Pi stand-offs with the display mounting points; use M2.5 screws. Do not pinch the FFC.

### B5 — Orientation for ARGUS

Panel native resolution is **720×1280 (portrait)**. Physically mount the assembly so the long edge is horizontal for the demo, then set **OS landscape rotation** so the desktop/browser reports ~**1280×720** (see `04-landscape-touch-display.md`).

---

## Connection checklist (thesis)

| Step | Action | Photo ID | Done |
|------|--------|----------|------|
| 1 | Active Cooler seated + FAN header plugged | P-COOLER | [ ] |
| 2 | FFC display end locked (15-way) | P-DSI | [ ] |
| 3 | FFC Pi DISP1 locked (22-way) | P-DSI | [ ] |
| 4 | GPIO 5V/GND to J1 | P-DSI | [ ] |
| 5 | Landscape mount / stand | P-MOUNT | [ ] |
| 6 | Flashed microSD inserted | P-STORAGE | [ ] |
| 7 | Ethernet connected | P-ETH | [ ] |
| 8 | 27 W PSU connected last | P-PSU | [ ] |
| 9 | First boot on display | P-BOOT | [ ] |

**Safety**

- Power **last**; unplug before changing FFC/GPIO.  
- Do not crease the FFC.  
- 27 W PSU for Pi 5 + display + cooler.  
- Leave airflow path for the blower.

---

## Software roles

| From | To | Path |
|------|-----|------|
| Touch kiosk | ARGUS on Pi | localhost `:9080` / `:9443` |
| ARGUS | Home Assistant on Pi | `/api/ha` → `:8123` |
| ARGUS Voice | mato-server Ollama | `/api/ollama` |
| Laptop | Pi | SSH + git deploy |
