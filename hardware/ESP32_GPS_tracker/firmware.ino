/*
 * ASchool SafeRide — ESP32 GPS Bus Tracker Firmware
 *
 * Hardware:
 *   - ESP32 Dev Board
 *   - NEO-6M GPS Module (UART1: RX=16, TX=17)
 *   - SIM800L GSM Module (UART2: RX=26, TX=27)
 *   - Li-ion battery + 12V buck converter
 *
 * Total cost per bus: ~Rs. 2,500-3,100
 * Monthly cost: Rs. 150 (SIM data only)
 *
 * Data flow:
 *   ESP32 → (every 15s) → Firebase Realtime DB
 *   Firebase → Backend Celery beat poller "poll-firebase-gps" (15s → PostgreSQL
 *   history + Socket.IO gps_update broadcast → web live map & parent app)
 */

#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ═══════ CONFIGURATION — Set per device ═══════
const char* BUS_ID     = "BUS_001";
const char* SCHOOL_ID  = "SCHOOL_ID_HERE";

// Firebase Realtime Database
const char* FIREBASE_HOST   = "aschool-gps-default-rtdb.firebaseio.com";
const char* FIREBASE_SECRET = "FIREBASE_SECRET_HERE";

// WiFi fallback (optional — primarily uses SIM800L GPRS)
const char* WIFI_SSID     = "";
const char* WIFI_PASSWORD = "";

// SIM800L APN (NTC Nepal)
const char* APN      = "ntc";
const char* APN_USER = "";
const char* APN_PASS = "";

// ═══════ TIMING ═══════
const unsigned long SEND_INTERVAL    = 15000;  // 15 seconds
const unsigned long GPS_TIMEOUT      = 5000;   // GPS fix timeout
const unsigned long HEARTBEAT_INTERVAL = 60000; // 1 minute heartbeat

// ═══════ PINS ═══════
#define GPS_RX 16
#define GPS_TX 17
#define GSM_RX 26
#define GSM_TX 27
#define LED_PIN 2  // Built-in LED

// ═══════ GLOBALS ═══════
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
HardwareSerial gsmSerial(2);

unsigned long lastSend = 0;
unsigned long lastHeartbeat = 0;
bool useWiFi = false;
int failCount = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("[ASchool SafeRide] Starting...");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // ── Configuration guard: refuse to run with placeholder identity/secrets.
  // A device reporting under SCHOOL_ID_HERE would silently poison tenant data.
  if (String(SCHOOL_ID) == "SCHOOL_ID_HERE" ||
      String(FIREBASE_SECRET) == "FIREBASE_SECRET_HERE" ||
      String(BUS_ID) == "BUS_001") {
    Serial.println("[CONFIG] ERROR: per-device configuration incomplete!");
    Serial.println("[CONFIG] Set BUS_ID, SCHOOL_ID and FIREBASE_SECRET before deployment.");
    while (true) {  // SOS blink forever — visible failure, no bogus data
      for (int i = 0; i < 3; i++) { digitalWrite(LED_PIN, HIGH); delay(150); digitalWrite(LED_PIN, LOW); delay(150); }
      delay(300);
    }
  }

  // Initialize GPS on UART1
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println("[GPS] Initialized on UART1");

  // Initialize GSM on UART2
  gsmSerial.begin(9600, SERIAL_8N1, GSM_RX, GSM_TX);
  Serial.println("[GSM] Initializing SIM800L...");
  initGSM();

  // Try WiFi if configured
  if (strlen(WIFI_SSID) > 0) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long wifiStart = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 10000) {
      delay(500);
    }
    if (WiFi.status() == WL_CONNECTED) {
      useWiFi = true;
      Serial.println("[WiFi] Connected: " + WiFi.localIP().toString());
    }
  }

  // Blink LED to indicate ready
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }

  Serial.println("[ASchool SafeRide] Ready!");
}

void loop() {
  // Feed GPS data
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  unsigned long now = millis();

  // Send location at interval
  if (now - lastSend >= SEND_INTERVAL) {
    if (gps.location.isValid() && gps.location.age() < GPS_TIMEOUT) {
      sendLocation(
        gps.location.lat(),
        gps.location.lng(),
        gps.speed.kmph(),
        gps.course.deg(),
        gps.hdop.value(),
        gps.satellites.value()
      );
      lastSend = now;
      failCount = 0;
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
    } else {
      Serial.println("[GPS] No valid fix. Satellites: " +
                     String(gps.satellites.value()));
      failCount++;
    }
  }

  // Heartbeat (even without GPS fix)
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = now;
  }

  // If too many failures, restart GSM
  if (failCount > 20) {
    Serial.println("[GSM] Too many failures, reinitializing...");
    initGSM();
    failCount = 0;
  }
}

void sendLocation(double lat, double lng, double speed,
                   double heading, int hdop, int satellites) {
  String path = "/schools/" + String(SCHOOL_ID) +
                "/buses/" + String(BUS_ID) + "/location.json";

  // Real UTC timestamp from the GPS fix (falls back to a null ts and lets the
  // server stamp arrival time). millis() is uptime only — never an epoch.
  String iso;
  if (gps.date.isValid() && gps.time.isValid()) {
    char buf[24];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             gps.date.year(), gps.date.month(), gps.date.day(),
             gps.time.hour(), gps.time.minute(), gps.time.second());
    iso = String(buf);
  }

  String payload = "{";
  payload += "\"lat\":" + String(lat, 7);
  payload += ",\"lng\":" + String(lng, 7);
  payload += ",\"speed\":" + String(speed, 1);
  payload += ",\"heading\":" + String(heading, 1);
  payload += ",\"hdop\":" + String(hdop);
  payload += ",\"satellites\":" + String(satellites);
  if (iso.length()) {
    payload += ",\"ts\":\"" + iso + "\"";
  }
  payload += ",\"bus_id\":\"" + String(BUS_ID) + "\"";
  payload += "}";

  if (useWiFi && WiFi.status() == WL_CONNECTED) {
    sendViaWiFi(path, payload);   // HTTP PUT → replaces location node
  } else {
    sendViaGPRS(path, payload);   // HTTP POST → appends child; poller picks latest by ts
  }

  Serial.println("[LOC] " + String(lat, 6) + "," + String(lng, 6) +
                 " spd:" + String(speed, 1) + " sat:" + String(satellites));
}

void sendViaWiFi(String path, String payload) {
  HTTPClient http;
  String url = "https://" + String(FIREBASE_HOST) + path +
               "?auth=" + String(FIREBASE_SECRET);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int code = http.PUT(payload);

  if (code > 0) {
    Serial.println("[WiFi] Sent OK: " + String(code));
  } else {
    Serial.println("[WiFi] Error: " + http.errorToString(code));
    failCount++;
  }
  http.end();
}

void sendViaGPRS(String path, String payload) {
  // HTTP POST via SIM800L AT commands.
  // NOTE: SIM800L HTTPACTION supports only GET(0)/POST(1)/HEAD(2) — there is
  // no PUT. POST to RTDB appends a push-child instead of replacing the node,
  // so the backend poller reads the whole node and takes the newest child by
  // "ts". Over WiFi we PUT directly, which replaces the flat object.
  sendAT("AT+HTTPTERM", 1000);
  sendAT("AT+HTTPINIT", 1000);
  sendAT("AT+HTTPPARA=\"CID\",1", 1000);

  String url = "https://" + String(FIREBASE_HOST) + path +
               "?auth=" + String(FIREBASE_SECRET);
  sendAT("AT+HTTPPARA=\"URL\",\"" + url + "\"", 2000);
  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 1000);

  // Write data
  sendAT("AT+HTTPDATA=" + String(payload.length()) + ",10000", 2000);
  gsmSerial.print(payload);
  delay(2000);

  // POST request and CHECK the result status.
  sendAT("AT+HTTPACTION=1", 10000);  // 1 = POST
  String actionResp = readSerialResponse(3000);
  int codeIdx = actionResp.indexOf("+HTTPACTION:");
  if (codeIdx >= 0) {
    // Format: +HTTPACTION: <method>,<status>,<len>
    String rest = actionResp.substring(codeIdx);
    int c1 = rest.indexOf(',');
    int c2 = rest.indexOf(',', c1 + 1);
    if (c1 > 0 && c2 > c1) {
      long status = rest.substring(c1 + 1, c2).toInt();
      if (status == 200) {
        Serial.println("[GPRS] Location sent OK");
        failCount = 0;
      } else {
        Serial.println("[GPRS] Server returned " + String(status));
        failCount++;
      }
    }
  } else {
    Serial.println("[GPRS] No HTTPACTION response — treating as failure");
    failCount++;
  }

  sendAT("AT+HTTPTERM", 1000);
}

void sendHeartbeat() {
  String path = "/schools/" + String(SCHOOL_ID) +
                "/buses/" + String(BUS_ID) + "/heartbeat.json";
  String payload = "{\"ts\":" + String(millis()) +
                   ",\"gps_fix\":" + String(gps.location.isValid() ? "true" : "false") +
                   ",\"satellites\":" + String(gps.satellites.value()) +
                   ",\"uptime\":" + String(millis() / 1000) + "}";

  if (useWiFi && WiFi.status() == WL_CONNECTED) {
    sendViaWiFi(path, payload);
  } else {
    sendViaGPRS(path, payload);
  }
}

void initGSM() {
  sendAT("AT", 2000);
  sendAT("AT+CPIN?", 2000);
  sendAT("AT+CREG?", 2000);
  sendAT("AT+CGATT=1", 5000);

  // Configure GPRS
  sendAT("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\"", 2000);
  sendAT("AT+SAPBR=3,1,\"APN\",\"" + String(APN) + "\"", 2000);
  if (strlen(APN_USER) > 0) {
    sendAT("AT+SAPBR=3,1,\"USER\",\"" + String(APN_USER) + "\"", 2000);
    sendAT("AT+SAPBR=3,1,\"PWD\",\"" + String(APN_PASS) + "\"", 2000);
  }
  sendAT("AT+SAPBR=1,1", 5000);
  sendAT("AT+SAPBR=2,1", 2000);

  // SSL setup
  sendAT("AT+HTTPSSL=1", 2000);

  Serial.println("[GSM] GPRS initialized");
}

// Drain the GSM serial line for up to `timeout` ms and return what arrives.
String readSerialResponse(unsigned long timeout) {
  String response = "";
  unsigned long start = millis();
  while (millis() - start < timeout) {
    while (gsmSerial.available()) {
      response += (char)gsmSerial.read();
    }
  }
  return response;
}

String sendAT(String cmd, unsigned long timeout) {
  gsmSerial.println(cmd);
  unsigned long start = millis();
  String response = "";
  while (millis() - start < timeout) {
    while (gsmSerial.available()) {
      response += (char)gsmSerial.read();
    }
    if (response.indexOf("OK") >= 0 || response.indexOf("ERROR") >= 0) {
      break;
    }
  }
  if (response.length() > 0) {
    Serial.println("[AT] " + cmd + " → " + response);
  }
  return response;
}
