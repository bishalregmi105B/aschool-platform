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
 *   Firebase → Parent Flutter App (real-time listener)
 *   Firebase → Backend Celery (polls every 30s → PostgreSQL history)
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

  String payload = "{";
  payload += "\"lat\":" + String(lat, 7);
  payload += ",\"lng\":" + String(lng, 7);
  payload += ",\"speed\":" + String(speed, 1);
  payload += ",\"heading\":" + String(heading, 1);
  payload += ",\"hdop\":" + String(hdop);
  payload += ",\"satellites\":" + String(satellites);
  payload += ",\"ts\":" + String(millis());
  payload += ",\"bus_id\":\"" + String(BUS_ID) + "\"";
  payload += "}";

  if (useWiFi && WiFi.status() == WL_CONNECTED) {
    sendViaWiFi(path, payload);
  } else {
    sendViaGPRS(path, payload);
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
  // HTTP PUT via SIM800L AT commands
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

  // PUT request (custom method via SIM800L — use POST as fallback)
  sendAT("AT+HTTPACTION=1", 10000);  // 1 = POST

  Serial.println("[GPRS] Location sent");
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
