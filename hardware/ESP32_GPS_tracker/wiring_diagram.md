# ESP32 GPS Bus Tracker — Wiring Diagram

## Components

| Component | Model | Est. Cost (NPR) |
|-----------|-------|-----------------|
| MCU | ESP32 DevKit V1 | Rs. 900 |
| GPS | NEO-6M Module | Rs. 500 |
| GSM | SIM800L Module | Rs. 600 |
| Antenna | GPS ceramic + GSM helical | Rs. 200 |
| Power | LM2596 DC-DC Buck Converter | Rs. 150 |
| Battery | 18650 Li-ion + holder (backup) | Rs. 350 |
| Enclosure | IP65 waterproof box | Rs. 200 |
| **Total** | | **Rs. 2,900** |

## Wiring Connections

```
┌─────────────────────────────────────────────────────────┐
│                     ESP32 DevKit                         │
│                                                          │
│  3V3 ──────────── NEO-6M VCC                            │
│  GND ──────────── NEO-6M GND                            │
│  GPIO16 (RX) ──── NEO-6M TX                             │
│  GPIO17 (TX) ──── NEO-6M RX                             │
│                                                          │
│  GPIO26 (RX) ──── SIM800L TX                            │
│  GPIO27 (TX) ──── SIM800L RX                            │
│  GND ──────────── SIM800L GND                           │
│                                                          │
│  GPIO2 ────────── Built-in LED (status indicator)       │
│                                                          │
└─────────────────────────────────────────────────────────┘

                    ┌──────────┐
  12V Vehicle ────► │ LM2596   │ ────► 5V ────► ESP32 VIN
  Battery           │ DC-DC    │ ────► 4.2V ──► SIM800L VCC
                    │ Converter│       (! SIM800L needs 3.4-4.4V)
                    └──────────┘

  NOTE: SIM800L power spikes up to 2A during transmission.
  Use a 1000µF capacitor across SIM800L VCC-GND.
```

## Power Considerations

- **SIM800L** requires 3.4V–4.4V and can spike to 2A. Do NOT power from ESP32 3v3 pin.
- Use a dedicated 4.2V rail from LM2596 or a separate LDO (AMS1117-3.3 won't work — use a LM317 set to 4.0V).
- Add **1000µF electrolytic capacitor** across SIM800L power pins.
- Total steady-state current: ~250mA. Peak: ~2.2A.

## GPS Antenna Placement

- Mount GPS antenna **facing sky** on bus roof or dashboard.
- Keep GPS antenna away from metal and GSM antenna (>10cm separation).
- First cold fix takes 1–5 minutes; warm fix ~30 seconds.

## SIM Card

- Use **NTC Data SIM** (Nepal Telecom) or Ncell Data SIM.
- APN: `ntc` (NTC) or `ncell` (Ncell).
- Monthly data usage: ~50MB (coordinate push every 15s).
- Estimated monthly cost: **Rs. 150** (200MB data pack).

## Enclosure Mounting

```
┌─────────────────────────────┐
│  GPS Antenna (top, sky-facing)│
│  ┌───────────────────────┐  │
│  │     ESP32 Board       │  │
│  │     + SIM800L         │  │
│  │     + NEO-6M          │  │
│  └───────────────────────┘  │
│  Capacitor       Buck Conv  │
│  GSM Antenna (side)         │
│         │ 12V Power Cable   │
└─────────┼───────────────────┘
          └──► Vehicle 12V
```

- Use IP65 rated enclosure.
- Route cables through waterproof glands.
- Mount under dashboard or in engine bay (covered area).
- Secure with zip ties or double-sided mounting tape.
