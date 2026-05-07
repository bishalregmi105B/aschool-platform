# ASchool Hardware — GPS Bus Tracking

## Overview

Low-cost GPS bus tracking solution for Nepali schools using ESP32 microcontroller.
Each bus gets a self-contained tracker unit that reports location every 15 seconds
to Firebase Realtime Database, which the Parent Flutter app consumes in real-time.

## Architecture

```
ESP32 + NEO-6M + SIM800L
        │
        │ (GPRS / WiFi — every 15s)
        ▼
Firebase Realtime DB
    /schools/{school_id}/buses/{bus_id}/location
        │
        ├──► Parent Flutter App (real-time listener)
        │
        └──► Celery Worker (polls every 30s)
                │
                └──► PostgreSQL (location history, geofence checks)
```

## Total Cost

| Item | Cost |
|------|------|
| Hardware per bus | Rs. 2,900 (one-time) |
| SIM data per month | Rs. 150 |
| Firebase (free tier) | Rs. 0 (up to 100 buses) |

## Directory Structure

```
hardware/
├── README.md                          ← This file
└── ESP32_GPS_tracker/
    ├── firmware.ino                   ← Arduino/ESP32 firmware
    └── wiring_diagram.md             ← Component list & wiring
```

## Setup Instructions

### 1. Flash Firmware

1. Install [Arduino IDE](https://www.arduino.cc/en/software) or PlatformIO.
2. Add ESP32 board support: `https://dl.espressif.com/dl/package_esp32_index.json`
3. Install library: **TinyGPS++** by Mikal Hart.
4. Edit `firmware.ino`:
   - Set `BUS_ID` to the bus identifier (e.g., `"BUS_001"`).
   - Set `SCHOOL_ID` to the school's database ID.
   - Set `FIREBASE_HOST` and `FIREBASE_SECRET` from Firebase project settings.
   - Set `APN` to your carrier's APN (`ntc` for NTC, `ncell` for Ncell).
5. Upload to ESP32 via USB.

### 2. Firebase Setup

1. Create a Firebase project (free Spark plan is sufficient for < 100 buses).
2. Enable Realtime Database.
3. Set security rules:
   ```json
   {
     "rules": {
       "schools": {
         "$school_id": {
           "buses": {
             "$bus_id": {
               "location": {
                 ".write": "auth != null",
                 ".read": "auth != null"
               }
             }
           }
         }
       }
     }
   }
   ```
4. Generate a database secret for the ESP32 (or use a service account).

### 3. Backend Integration

The Celery worker (`backend/tasks/gps_tasks.py`) polls Firebase every 30 seconds:
- Stores location history in `bus_locations` table.
- Checks geofences and triggers notifications.
- Updates ETA calculations.

### 4. Parent App Integration

The Flutter Parent app (`flutter_parent/lib/features/bus_tracking/bus_tracking_screen.dart`)
subscribes to Firebase Realtime DB for live location updates and renders on FlutterMap
with OpenStreetMap tiles.

## LED Status Codes

| Pattern | Meaning |
|---------|---------|
| 3 quick blinks | Boot complete, ready |
| Single blink every 15s | Location sent successfully |
| No blinks | No GPS fix or GSM error |
| Continuous on | Sending data |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No GPS fix | Move to open sky; wait 2-5 min for cold start |
| SIM800L not responding | Check power supply (needs 4.2V, 2A capable) |
| GPRS connection fails | Verify APN settings; check SIM balance |
| Firebase write fails | Verify auth token; check Firebase rules |
| ESP32 restarting | Add capacitor; check power stability |
