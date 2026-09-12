# SchoolBusTrack v2.3 — Deep Competitor Audit (Transport Benchmark)

**Audited:** `Other Projects/SchoolBusTrack v2.3/SchoolBusTrack v2.3/` (Code/AdminPanel Laravel+Vue, Code/Apps two Flutter apps, Documentation, UpgradeGuide)
**Compared against:** ASchool gps_tracking plugin + transport pages + parent app bus_tracker
**Audit date:** 2026-09-11. All SchoolBusTrack paths are relative to the product root unless prefixed `ASchool:`.

**What it is:** a CodeCanyon-style dedicated school-transport SaaS. A superadmin hosts many schools; each school manages routes/stops/buses/drivers/students; parents (guardians) track buses in real time and pay per-ride with a coins wallet. The driver's phone is the GPS tracker (no hardware device). This is the most complete transport lifecycle we have audited: schedule → publish → reserve seats → track → board/alight → missed-student alerts → drop-off history. It is the benchmark our gps_tracking plugin should be measured against.

## Deep re-audit (v2) — implementation-level (2026-09-12)

- **v2 status**: covered routes/api.php (full), Console/Kernel.php, TripController.php (2,568 lines, full), TripUtils.php + UserUtils.php (full), UserController.php (2,592 lines, full), ReservationController, SettingController, DriverController, StopController (setPickupDropOff/getClosestStops/setPickupDropOffLocation), models + migrations + EventTypesSeeder, Event/broadcasting files; guardian app: this_application_view_model.dart, track_school_bus_screen.dart, notifications_settings_screen.dart, trip timeline widgets; driver app: running_trip_screen.dart, running_trip_simple_mode_screen.dart (end-trip path), start_trip_screen.dart, qrcode_scanner_screen.dart, pick_up_screen.dart, driver VM start/update-location wrappers; all listed ASchool files. remaining: none (Skia/Composer internals and unreferenced screens deliberately out of scope).

This pass replaces impression with line numbers. Competitor paths are relative to the product root (`Other Projects/SchoolBusTrack v2.3/SchoolBusTrack v2.3/`); ASchool paths are repo paths.

### V2.1 Coverage: what the full read added

- `Code/AdminPanel/routes/api.php` — 8 payment routes ship with **no auth middleware at all** (`/users/capture-braintree-parent` :156, `/fetch-plan-details-for-parent` :159, flutterwave :162-163, razorpay :166-168, stripe :170-171, paystack :172), plus `/users/admin-info` :38, `GET /routes/{id}` :202, `GET /stops/{id}` :209, `POST /planned-trips/test-set-last-position` :258 and the `test/` group :409-412. The middleware matrix is real but incomplete exactly where money and spoofing are possible.
- `Code/AdminPanel/app/Console/Kernel.php` :34-45 — daily `scheduleDriverTrips()`; one everyMinute closure running `deleteAccounts()`, `endTrips()`, `publishTrips()`, `assignStudentsToTrips()` **with no `withoutOverlapping()` mutex** — the root of the race findings below.
- `Code/AdminPanel/app/Traits/TripUtils.php` (853 lines) + `UserUtils.php` (494) — the actual engine lives in traits, not controllers; `TripController` keeps ~700 lines of commented-out legacy (`startStopDriverTrip*`, :924-1594).
- Schema correction to the v1 report: the per-student ride table is **`student_trips`**, and `App\Models\Reservation` is a *second Eloquent model over the same table* (`Code/AdminPanel/app/Models/Reservation.php` :12 `protected $table = 'student_trips'`). `ride_status` is documented in the migration as `0 not ride, 1 ride, 2 miss ride, 3 drop off, 4 cancelled by admin` (`database/migrations/2019_10_12_000012_create_student_trips_table.php`); status 4 has no writer in v2.3 code.
- Driver app GPS parameters confirmed exactly: `LocationSettings(accuracy: high)` with **no distanceFilter/timeInterval** (`Code/Apps/school-trip-track-driver/lib/gui/screens/running_trip_screen.dart` :150-153, :209-210), ≥3 s POST throttle *and* in-flight guard (:225-243), `WakelockPlus.enable()` for the whole trip (:190, disabled :262).

### V2.2 Trace A — Trip lifecycle state machine (exact rules)

**Object hierarchy:** `trips` (recurring definition: `channel` `uniqid()`, `effective_date`, `repetition_period` days, `first_stop_time`, `last_stop_time`, `stop_to_stop_avg_time`, `status_id` 1 active / 3 trashed, `driver_id`) → per-stop `trip_details` (`stop_id`, `planned_timestamp` cumulative from `inter_time[]`, `TripController::createEdit` :441-455) → daily `planned_trips` (UNIQUE `(trip_id, planned_date)`; copies `channel`, `driver_id`, and `bus_id = $trip->driver->bus->id` — the driver's *current* bus, not the trip's; `started_at`/`ended_at`; `last_position_lat/lng` single row) → per-stop `planned_trip_details` (`planned_timestamp` and `actual_timestamp`, both **TIME columns** — the date component of an arrival is unrecoverable) → per-student rides in `student_trips` (`ride_status`, `planned_start_time`, `riding_date`, `start_stop_id`, `end_stop_id`).

**Statuses and their writers:**

| Value | Meaning | Written by |
|---|---|---|
| `trips.status_id` 1 / 3 | active / trashed | `trashRestore` toggle (`TripController` :474-488) |
| `planned_trips.started_at` / `ended_at` | running / done | driver `startStopPlannedTrip` (:1674, :1699); force-end by `UserUtils::endTrips` (`app/Traits/UserUtils.php` :110-123, only for `planned_date <= now-1day`) |
| `planned_trip_details.actual_timestamp` | stop visited | auto-arrival in `setLastPosition` (:1920-1923), `dismissNextStop` (:2438), implicit on start in simple mode (order rewrite) |
| `student_trips.ride_status` 0→1 | waiting→onboard | `pickUp` scan (:2343) |
| 0→2 | waiting→missed | `pickUp` missed variant (:2318) and no-ticket branch (:2380), `dismissNextStop` (:2449) |
| 1→3 | onboard→dropped | `dropOff` bulk (:2513) |
| 4 | cancelled-by-admin | **no writer** (dead value; `ReservationController::cancel` :103-206 refunds wallets but has no route in `routes/api.php`) |
| `users.status_id` 5 | out of coins | `assignStudentsToTrips` (`app/Traits/TripUtils.php` :504-510); reset to 1 on recovery :514-520 |

**`publishTrips()`** (`TripUtils.php` :675-755, everyMinute): horizon is **today only** (`$publish_trips_future_days = 0` :678) — parents can never see tomorrow's instance. It creates a `planned_trip` + detail copies only for trips with `status_id=1` and a driver (:680), skipping suspended occurrences via `checkSuspendedTrip` (:815-841 — note suspensions themselves repeat: `date >= suspend_date && diff % suspension.repetition_period == 0`). Pruning: instances older than yesterday **with zero reservations** are deleted (:732-748), then instances with `driver_id IS NULL OR bus_id IS NULL` are deleted **regardless of reservations** (:750-754) — a driver unassignment mid-day silently destroys a day that students are already reserved on (V2-11).

**`assignStudentsToTrips()`** (`TripUtils.php` :448-673, everyMinute): per student — skip if `absent_on == today` (:467), clear stale absence (:472-478); **coins gate before seat assignment**: school `balance > 0` else parent (role 4) `balance > 0`, else `status_id = 5` and skip (:480-511); create `student_trips` row (ride_status 0) for pickup and drop-off if absent (:576-622); on creation debit **1 coin** from school balance, else parent balance, + one `consumptions` row `amount=1` (:625-657). Metering is per *created ride*, not per *consumed ride* — a missed ride (status 2) is still charged.

**Start/stop:** `startStopPlannedTrip` (:1614-1730). Start (mode 1): in simple mode the submitted `trip_details` order **replaces** all `planned_trip_detail` rows (delete + recreate, :1663-1672) then stamps `started_at`; advanced mode just stamps. End (mode 0): **refused while any `student_trips.ride_status == 1`** ("There are passengers to be dropped off", :1690-1696) — the safety guard; in simple mode ending also **deletes the ad-hoc route and all its stops** (:1708-1718). Driver ownership check is **commented out** (:1636-1638) — see V2-01. Simple-mode ad-hoc generation is `scheduleDriverTrip` (`TripUtils.php` :76-357): per driver+direction, stops = `student_settings.pickup_lat/lng` (AM) or `drop_off_lat/lng` (PM) merged on identical lat-lng, ordered by distance to school (AM reversed, school appended last; PM school first), straight 2-point polylines, `repetition_period = 0`, all times `00:00:00` — honors per-school off-days (`SchoolSetting` sunday..saturday, :98-103) and absence. If the driver never ends the trip, the generated route/stops are never cleaned (V2-12).

**Comparison — trip lifecycle:**

| Competitor (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|
| `trips`→`planned_trips`→`planned_trip_details`→`student_trips` 4-layer model (`app/Traits/TripUtils.php` :675, :448) | Nothing — `backend/app/models/transport.py` (80 lines) has only Route/Bus/BusStop/GPSLog; no instance, no ride row | Entire lifecycle missing | **Adopt** (schema in V2.7) |
| everyMinute publish/assign/end crons (`app/Console/Kernel.php` :39-45) | No scheduler; `process_gps_data` is the only pipeline task (`backend/app/tasks/gps_processing.py` :42) | No daily materialization at all | **Adopt as Celery beat** (with mutex — their omission is a bug, V2-07) |
| End blocked while `ride_status=1` (`TripController` :1690-1696) | No concept of onboard | Safety guard missing | **Adopt verbatim** |
| `student_trips.ride_status` 0/1/2/3(+4) (`database/migrations/2019_10_12_000012_create_student_trips_table.php`) | No ride rows; attendance impossible | Attendance-on-bus missing | **Adopt** |
| Coin gate before reservation (`TripUtils.php` :480-511) | No gating; transport is free/unwired (`backend/app/models/fee.py` `FeeCollection.payment_status` exists but transport never checks it) | Replace coins with fee status, keep the *gate* | **Adapt** |
| `actual_timestamp` TIME-only, `last_position_*` single row (`database/migrations/2021_08_01_000034…`, `…000009_create_planned_trips_table.php`) | Full `GPSLog` history (`backend/app/models/transport.py` :68-80) | We are strictly better; don't copy their lossy columns | **Reject** (use DateTime) |

### V2.3 Trace B — Geofence + notification engine (`setLastPosition`, TripController :1791-2077)

1. Ingest: `POST /planned-trips/set-last-position` (`planned_trip_id, lat, lng, speed`), caller must be the assigned driver (:1812). Persists **only** last position (:1829-1832), broadcasts `TripPositionUpdated($channel, json {lat,lng,speed})` on a **public** channel (:1839; `app/Events/TripPositionUpdated.php` `broadcastOn()` returns `new Channel($channelId)`, and `routes/channels.php` authorizes only `App.Models.User.{id}`) — smell re-verified at line level.
2. Haversine: `TripUtils::distance` (:844-852, km, ×1000 to meters) from bus to the **first `planned_trip_detail` with `actual_timestamp == null`** — strictly ordered stops (:1848-1850, :1858).
3. Radii — one global `settings` row (`Setting::where('id',1)` at :1816; also `TripUtils.php` :29/:677, `calcPrice` :781): `distance_to_stop_to_mark_arrived` **default 100 m** (`database/migrations/2019_10_12_000010_create_settings_table.php` :23), `distance_to_pick_up` 100, `distance_to_drop_off` 100, `distance_to_slow_down` 1000, `max_search_radius` 1000 (`database/migrations/2021_08_01_000049_add_distances_to_settings_table.php`). Validation forces slow-down to exceed pickup/drop-off by 100 m (`SettingController::update` :74-77). Per-school `SchoolSetting` holds only off-days + school location — radii cannot differ per school (V2-08).
4. Trigger matrix per waiting passenger (`ride_status=0 && start_stop_id == next_stop`, :1861-1863): (a) `next_stop_is_your_pickup_location_notification_on_off` — fires unconditionally while the stop is next (:1872-1875); (b) `bus_near_pickup_location_notification_by_distance` — **per-student integer radius** compared to live distance (:1877-1884); (c) `bus_arrived_at_pickup_location_notification_on_off` — fires when distance < global mark-arrived radius (:1886-1892). Mirrored for drop-off passengers (`ride_status=1 && end_stop_id == next_stop`): `bus_near_drop_off_location_notification_on_off` (:1907-1910) and `bus_arrived_at_drop_off_location_notification_on_off` (:1912-1918). The 8th toggle, `bus_arrived_at_school_notification_on_off`, is **never fired anywhere** (grep over `app/` finds only the seeder and the settings reader `UserUtils.php` :325; the UI toggle is commented out in `notifications_settings_screen.dart` :337-344) — a dead switch (V2-10).
5. Arrival auto-mark: `actual_timestamp = now` only when inside mark-arrived radius AND **zero passengers waiting to board AND zero to alight** at that stop (:1920-1923) — the anti-false-arrival guard; explicit driver actions stamp it otherwise.
6. Delivery: `sendStudentNotificationBasedOnSetting` (:1743-1788) resolves `event_types` by `notification_name`, picks `title_{parent.locale}` (8 locales seeded in `database/seeders/EventTypesTableSeeder.php` :19-106), then dedups: one event per (student, event_type) per **30 minutes** (:1776-1787). `UserUtils::sendNotificationToUser` (:452-494) fans a student event out to **all guardians**, creating an in-app `notifications` row per guardian and sending FCM via `sendSingleNotification` (kreait `CloudMessage`, `apns-priority: 10`, sound :376-412) with duplicate-token suppression (`isTokenUsed` :365-373).
7. Dead branch: the `else` block (:1948-2071) behind `if(true)` at :1845 is the legacy "closest unvisited stop" engine — the file carries both designs.
8. The driver-facing response returns `next_stop`, `distance_to_next_stop`, counts (:1927-1934) — the server *is* the coaching brain; the app only renders it.

**Comparison — geofence/notifications:**

| Competitor (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|
| Ordered next-stop haversine, 100 m arrival radius (`TripController` :1848-1858, migration default 100) | `check_geofence_alerts` uses **min distance to ANY stop > 2 km** as "deviation" (`backend/app/tasks/gps_processing.py` :159, :167) — 20× coarser and wrong-shaped | Stop-radius logic vs corridor blob | **Adopt** the 100 m-class stop radii; keep corridor check as a *separate* deviation alert using our `GPSLog` |
| 8 per-student toggles incl. per-student approach radius (`student_settings` migration `2019_10_12_000012`; UI `notifications_settings_screen.dart` :297-362) | Exactly one alert, to school roles only (`gps_processing.py` :172-177); parents get nothing | Parents-first notification design missing | **Adopt** as `transport_notification_prefs` (V2.7); drop their dead `arrived_at_school` toggle or actually fire it |
| 30-min per-(student,event) dedup (`TripController` :1776-1787) | No dedup (deviation alert can re-fire each poll) | Alerts spam | **Adopt** |
| FCM push + in-app row + guardian fan-out (`UserUtils.php` :376-494) | `send_push_to_school.delay` only (`gps_processing.py` :172) | No per-recipient pipeline | **Adapt** to our push_notifications task |
| Public `new Channel($channelId)` broadcast (`app/Events/TripPositionUpdated.php`; `routes/channels.php`) | Socket.IO `room=f"school-{bus.school_id}"` behind JWT (`gps_processing.py` :31, :103) | Ours is room-scoped but still school-wide, not per-trip | **Keep ours**, add per-instance room |

### V2.4 Trace C — Board/alight flow

- **QR ticket lifecycle:** `student_identification` is set at student creation (parent form `UserController::addEditStudent` :1685, CSV `uploadStudents` :2475, school `Edit` :626) → printed/emailed as a QR PDF encoding exactly that string (`printStudentCard` :2258-2261, `resources/views/student_card.blade.php`) → shown in-app via `qr_flutter` → scanned by driver (`qrcode_scanner_screen.dart` :84-113, `mobile_scanner`, QR-only, 5 s same-code re-scan throttle :92-97, haptic+ringtone) → `POST /planned-trips/pick-up {ticket_number, planned_trip_id, lat, lng, speed, missed?}`.
- **pickUp** (`TripController` :2255-2402): resolves student by `student_identification` (:2285) → finds `student_trips` row `ride_status=0` for that planned trip (:2291-2298) → driver must own the trip (:2306) → "already picked up" guard (:2310). `missed=1`: if the driver is inside mark-arrived radius of the student's `firstStop`, `ride_status=2` + missed notification (:2314-2333); otherwise the normal path **geofence-validates the driver** against the student's own stop — `distance > radius` ⇒ 500 "Passenger is not near the stop" (:2337-2341) — then `ride_status=1` (:2343) + picked-up notification gated by toggle (:2347-2351). The no-ticket branch (`ticket_number == "null"` string) marks **every** waiting reservation whose stop is within radius as missed (:2358-2393) — that is the "Students do not show up" button (`qrcode_scanner_screen.dart` :146-187, `missed=1`). Both paths chain into `setLastPosition($request)` so counts refresh (:2355, :2400).
- **dropOff** (`:2474-2524`): bulk — all `ride_status=1` reservations whose `endStop` is within the arrival radius become `ride_status=3` (:2506-2517). **No identity check, no notification** (no "student dropped off" toggle exists) — the child-safety hole the v1 report flagged, now confirmed: anyone at the right place gets marked dropped.
- **dismissNextStop** (`:2405-2471`): stamps the next unvisited stop `actual_timestamp` and marks all waiters there `ride_status=2` + notifications — **with no geofence check at all**, so a driver can dismiss a stop from across town.
- **Manifests:** `getStudentsToBePickedUp` (:2184-2202) waits at the *next* stop only; `getAllStudentsOnTrip` (:2205-2252) returns parallel arrays `students/start_stops/end_stops/planned_start_times` for the roster screen; both driver-gated.
- The legacy camera variant `pick_up_screen.dart` still ships, and in `Config.localTest` posts the hardcoded ticket `"123456789"` (`pick_up_screen.dart` :292-302) — a test hook wired into a production flow (V2-14).

**Comparison — board/alight:**

| Competitor (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|
| Scan-to-board with server geofence validation of driver vs *student's* stop (`TripController` :2337-2341) | Nothing; `backend/app/models/dismissal.py` covers at-school handoff only | Boarding attendance missing | **Adopt**; add what they lack — drop-off identity verification via our `AuthorizedPickup`/`DismissalRecord` (`dismissal.py` :10-44) |
| Missed variants + missed-pickup FCM (`:2314-2333`, `:2448-2461`) | Nothing | The single most parent-relevant event | **Adopt** |
| End-trip guard while onboard (`:1690-1696`) | Nothing | Safety guard | **Adopt verbatim** |
| Bulk drop-off, no identity check (`:2506-2517`) | dismissal QR verification exists for at-school | Theirs is weaker than our dismissal plugin | **Reject as-is**; merge: bus arrival event → dismissal queue |

### V2.5 Trace D — Wallet/coins economy

- **Plans:** `plans.plan_type` 0 = school-plans, 1 = parent-plans (`UserController::validatePlan` :701-719; `getAvailablePlans` `UserUtils.php` :196-223 also hides one-time plans already bought). A plan purchase = one `charges` row (price, coin_count, plan_id, school_id or parent_id) + `users.balance += coin_count` (`finalizePayment` :798-852).
- **Ledger tables:** `charges` (money in), `consumptions` (1 coin per auto-created ride, `TripUtils.php` :635-655), `user_refunds` (legacy cancel flow), plus redemption/payment tables for the driver payout side. Coins live as a single `users.balance` integer — no per-transaction balance history beyond these rows.
- **7 gateways** (`UserController`): Braintree `captureBraintree` :1366-1474 (server-side sale from nonce; skips payment entirely if `plan->price == 0` and still grants coins — that is how `requestCoins` :1516-1575 works, emailing a pay-link at :1559-1572); Razorpay :757-957 (order + signature-verified capture); Flutterwave :722-1041; Paytabs :1044-1127; Paystack :1130-1224 (plan_id rides in gateway metadata :1158-1160); Stripe :1227-1348 (payment-intent retrieve + amount check); PayPal rides Braintree's nonce type check :1446-1448.
- **Balance gating in reservation:** `assignStudentsToTrips` refuses to create the day's rides when school AND parent balance ≤ 0 and flips the student to `status_id=5` (`TripUtils.php` :480-511). Transport is literally pre-paid.
- **How a ride is metered:** plan purchase → balance → everyMinute job creates `student_trips` and debits exactly 1 coin per new ride row (+`consumptions` row). There is **no debit at pickup** and **no refund on miss** — metering on creation, not consumption (V2-07).

**Comparison — wallet:**

| Competitor (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|
| Coins per ride, gate before assignment (`TripUtils.php` :480-511) | `FeeCollection.payment_status` paid/pending/partial… exists (`backend/app/models/fee.py` :74-80) but transport never consults it | Business model differs; *gate pattern* is the transferable part | **Adapt**: gate instance allocation on transport-fee status from `app/api/v1/fees.py` |
| Idempotency: Flutterwave/Paytabs/Paystack dedup tables (`UserController` :984-988, :1055-1059, :1140-1144) but **Stripe/Razorpay/Braintree have none** | `PaymentInitiation` anchors every callback to an initiated row for idempotency (`backend/app/models/fee.py` :155-180) | Their payments are half-idempotent; ours is the right pattern | **Reject their design; keep ours** (see V2-02 replay attack) |
| School→parent `transferCoins` (`UserController` :2522-2574) | Fee items + receipts | N/A for our model | **Reject** |

### V2.6 Trace E — Parent tracking UX end-to-end (guardian app)

- **Entry:** `track_school_bus_screen.dart` takes `(student, morning)`; `initState` → `getReservationDetailsEndpoint` (`view_models/this_application_view_model.dart` :1299-1322) which calls `GET /reservations/get-reservation-details?student_id&morning` (`ReservationController` :209-291 — returns latest reservation per direction incl. route polylines decoded from `route_stop_directions.overview_path` :256-277, driver tel fallback from `driver_information` :278-286) and, on success, subscribes Echo: `listenToEcho(reservation.trip.channel, 'TripPositionUpdated')` (:1314-1317).
- **Echo path:** `initEcho` builds a raw `socket_io_client` websocket + Laravel Echo (`this_application_view_model.dart` :102-137); `listenToEcho` (:156-185) parses `{lat,lng,speed}` (string-or-number tolerant) into VM fields and `notifyListeners()`. No polling anywhere — pure push.
- **Fallback:** when `echoConnected == false`, the map re-pins the bus from the reservation's persisted `trip.lastPositionLat/Lng` and shows the red "Error tracking bus location" banner (`track_school_bus_screen.dart` :101-108, :180-202) — last-known-position fallback, re-verified.
- **Map widget tree:** custom bus PNG marker with live speed in the info window (`getBytesFromAsset` :456-475, `updateBusMarkerPosition` :477-506), red stop markers with name+address (:140-149), route polylines colored with `Random()` **per build** (:122-124 — bug confirmed), camera bounds fitting via 3D centroid (`calculateCenterPoint` :435-454, `adjustBounds` :357-362), bottom card = bus icon + dashed line + **live distance-to-student's-stop in km** computed client-side (`Tools.calculateDistance`, :496-501) + planned pickup/drop-off time + stop name/address (:226-291), call-driver FAB (`tel:` launch, toast when number missing, :400-415, :526-546; the in-card duplicate is commented out :276-290), zoom-fit FAB. Explicit empty states "Trip is not available" / "Trip has not started yet" / "Trip has ended" (`tripNotStartedScreen` :548-574, keyed on `startedAt`/`endedAt`). Channel is left on `dispose` (:52-58).
- **Timelines:** `trip_time_line.dart` / `full_trip_time_line.dart` (`lib/gui/widgets/`) render `timeline_tile` stop lists — numbered circles green for the completed span (`index >= startStopIndex && endStopIndex >= index+1`), grey ahead, red marker on the drop-off stop — consumed by `trip_timeline_screen.dart` (live) and `planned_trip_timeline_screen.dart` (upcoming).
- **Notification settings UI:** `notifications_settings_screen.dart` builds 7 cards from `allNotificationsSettings` (:297-362 — `bus_arrived_at_school` block commented out :337-344); six boolean `Switch`es + one int row opening a picker with **Off / 100 / 500 / 1000 / 1500 / 2000 m** (:134-189); save posts key/value pairs to `POST /users/update-notification-settings`.
- **Ride history:** `getReservationsEndpoint` (:1274-1294) splits active vs past on `rideStatus != 0 || plannedDate < today || trip.endedAt != null` — a parent can reconstruct each day's pickup/drop-off/missed events from `ride_status` + planned/actual times.

**Comparison — parent UX:**

| Competitor (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|
| Echo push per position + last-known fallback banner (`this_application_view_model.dart` :102-185; `track_school_bus_screen.dart` :101-202) | 15 s `Timer.periodic` poll of `/parent/bus-info` (`flutter_parent/lib/features/bus_tracker/bus_tracking_screen.dart` :34-35); web is push (`frontend/app/dashboard/transport/map/page.tsx` :13, :41, :71 `joinSchoolRoom`/`onGPSUpdate`) | Mobile lacks push; both lack per-trip scoping | **Adopt** push-on-mobile + stale banner; **Adapt** rooms to per-instance |
| Live km-to-stop, no ETA (`track_school_bus_screen.dart` :496-501) | `"eta_minutes": bus.route.estimated_time_mins` — a static route constant shown as ETA (`backend/app/api/v1/parent_app.py` :681, :724, :736) | Ours is *misleading*, theirs is merely incomplete | **Reject theirs; replace ours** with haversine-to-next-stop now, OSRM later (we have `GPSLog` to train it) |
| Trip-not-started/ended empty states, call-driver, green/grey timeline | None on mobile tracker | Pure UX polish | **Adopt outright** |
| 7-toggle per-student notification screen with radius picker | No parent preferences anywhere | Parent agency missing | **Adopt** (feeds V2.7 prefs table) |
| Random polyline colors per build (:122-124) | Deterministic colors | Trivial | **Reject** |

### V2.7 Concrete schema ASchool needs (trip-model adoption, A-10/A-11)

All tables `SchoolModel`-based (school_id + soft delete), Postgres, matching `backend/app/models/transport.py` conventions:

```sql
-- 1) Recurring definition (their `trips`)
transport_trips: id, school_id, route_id → routes, bus_id → buses, driver_id → users,
  channel uuid (per-instance suffix applied at publish), effective_date date,
  repetition_period_days int (0 = one-off), direction enum('am','pm'),
  status enum('active','trashed') default 'active'

-- 2) Daily instance (their `planned_trips`)  — UNIQUE(school_id, transport_trip_id, instance_date)
transport_trip_instances: id, school_id, transport_trip_id, instance_date date,
  bus_id (snapshot), driver_id (snapshot), status enum('planned','running','completed','missed')
  default 'planned', started_at timestamptz, ended_at timestamptz,
  last_lat numeric(10,7), last_lng numeric(10,7), last_speed_kmh, last_fix_at timestamptz,
  socket_room text  -- f"trip-{instance.id}", JWT-scoped join, NOT school-wide

-- 3) Per-instance stop rows (their `planned_trip_details`) — planned_ts must be TIMESTAMPTZ, not TIME
transport_trip_instance_stops: id, instance_id → transport_trip_instances,
  stop_id → bus_stops, sequence int, planned_ts timestamptz, actual_ts timestamptz NULL

-- 4) Participation + attendance (their `student_trips`) — ride_status mirrors theirs 0..3,
--    plus 4 = cancelled (they document it but never write it)
transport_trip_reservations: id, instance_id, student_id → students,
  start_stop_id, end_stop_id, planned_start_ts timestamptz,
  ride_status smallint default 0  -- 0 waiting, 1 onboard, 2 missed, 3 dropped, 4 cancelled
  boarded_at timestamptz, dropped_at timestamptz, missed_reason text,
  fee_status enum('ok','unpaid')  -- the coin-gate replacement: set from fees plugin at publish

-- 5) Per-student notification prefs (their student_settings toggles, normalized)
transport_notification_prefs: id, student_id (UNIQUE), near_pickup_radius_m int NULL,
  notify_next_stop_pickup bool, notify_arrived_pickup bool, notify_picked_up bool,
  notify_missed bool, notify_near_dropoff bool, notify_arrived_dropoff bool,
  notify_departed bool  -- replaces their dead arrived_at_school toggle with one we WILL fire

-- 6) Event dedup (their events/event_types)
transport_alert_log: id, student_id, alert_type text, fired_at timestamptz
  -- UNIQUE(student_id, alert_type, date_trunc('hour', fired_at)) ≈ their 30-min dedup
```

**Dual ingest into one `process_gps_data`:** today only the ESP32 path exists — `poll_firebase_gps` (15 s beat, 14 s `task_lock`, `backend/app/tasks/gps_firebase_poller.py`) → `process_gps_data` (`gps_processing.py` :42-111) which resolves bus by UUID-or-`gps_device_id`, writes `GPSLog`, emits `gps_update`. Add `POST /transport/instances/{id}/position` (driver JWT, driver-of-instance check): accepts `{lat,lng,speed}` with **server-side ≥3 s throttle** (cache `last_fix_at` per instance, mirroring their client guard), writes the same `GPSLog`, updates the instance's `last_*` cache, and calls the shared `process_gps_data` continuation — one geofence engine regardless of source; hardware and phone become interchangeable. Cron set: beat every minute → `publish_todays_instances` (publish + prune, `without-overlap` equivalent via a `task_lock`), `assign_students_to_instances` (fee-status gate → create reservations), `force_end_stale_instances` (started but >1 day old). End-instance endpoint refuses while any reservation has `ride_status=1` (port of `TripController` :1690-1696).

### V2.8 New v2 findings (V2-01…) — all verified at line level

- **V2-01 Driver-ownership check commented out on start/stop.** `Code/AdminPanel/app/Http/Controllers/Api/TripController.php` :1636-1638 — the `planned_trip->driver_id != $user_id` 401 block is commented, unlike `setLastPosition` :1812. Any authenticated driver can start/end/refill any planned trip of any school (route middleware is `auth:sanctum, driver` only, `routes/api.php` :253). Simple mode makes this worse: the forged `trip_details` rewrite :1663-1672 lets an attacker reorder or (via repeat delete/create) effectively truncate another school's route.
- **V2-02 Coins double-spend via unauthenticated parent payment routes.** `routes/api.php` :156-172 mount `capture-braintree-parent`, `create-razorpay-order-parent`, `capture-razorpay-payment-parent`, `initialize/capture-flutterwave-…-parent`, `initialize/capture-stripe-…-parent`, `capture-paystack-payment-parent` and `fetch-plan-details-for-parent` with **no middleware**; each capture falls back to a caller-supplied `parent_id` when unauthenticated (e.g. `UserController.php` :869-882, :1283-1295, :1374-1387). Stripe (:1273-1348) and Razorpay (:855-957) have **no transaction dedup table** (unlike Flutterwave :984-988, Paytabs :1055-1059, Paystack :1140-1144), so one legitimately-paid intent can be replayed for unlimited `balance += coins` credited to any parent. Braintree's `price == 0` short-circuit (:1423-1425) grants coins with no charge at all.
- **V2-03 Unauthenticated position spoof + broadcast.** `routes/api.php` :258 `POST /planned-trips/test-set-last-position` (no middleware) → `TripController::setLastPositionTest` :2079-2125 persists last position on **any** `planned_trip_id` and broadcasts `TripPositionUpdated`; `POST /api/test/test-send-student-notification` :409-412 similarly fires notifications (`TripController` :1733-1741).
- **V2-04 Mass-assignment on "notification settings".** `UserController::updateNotificationSettings` :1579-1630 collapses arbitrary `key_name => value` pairs and passes them straight to `student_settings` update — a parent can write **any** column of that table (`morning_bus_id`, `pickup_trip_id`, `absent_on`, another student's radius), not just the 8 toggles.
- **V2-05 `deleteStudent` authorization is vacuous.** `UserController.php` :1893-1897 — `$this->studentGuardianRepository->findByWhere(...)` returns a Collection, which is truthy even when empty, so `if(!$guardianStudent)` never fires: any parent can delete any student by id (cascades `student_trips` deletion :1907-1910).
- **V2-06 Cross-family PII reads.** `GET /reservations/get-reservation-details` (`ReservationController` :209-291) and `GET /users/get-student-details/{id}` (`UserController` :1975-1986) trust the client-supplied `student_id` with only role middleware — any guardian can read any student's stops, addresses, timetable and driver phone.
- **V2-07 Scheduler race + metering-on-creation.** `app/Console/Kernel.php` :39-45 runs four jobs everyMinute with no overlap mutex; `assignStudentsToTrips` reads balances **outside** its per-student transaction (`TripUtils.php` :480-503 vs `DB::beginTransaction` :569), so overlapping runs can double-debit; and the coin is charged when the ride *row* is created — missed rides (status 2) are never refunded. (Their wallet also has no balance-history table, only `consumptions`.)
- **V2-08 Global settings row is load-bearing everywhere.** `Setting::where('id',1)` in `TripUtils.php` :29/:677 and `TripController.php` :781/:1816/:2270/:2487; `GET /settings/user` hands the whole row to any authenticated user (`SettingController` :201-205). Multi-school SaaS operators cannot vary radii per school — v1 finding now pinned to lines.
- **V2-09 Lossy schema.** `planned_trip_details.actual_timestamp` is a TIME column (`database/migrations/2021_08_01_000034_create_planned_trip_details_table.php`) — arrival *dates* are unrecoverable; `planned_trips.last_position_lat/lng` is the only telemetry (`…000009_create_planned_trips_table.php`); `reserved_seats` column exists but is never written. ASchool's `GPSLog` (`backend/app/models/transport.py` :68-80) is the structural advantage — do not copy their columns.
- **V2-10 Dead notification toggle.** `bus_arrived_at_school_notification_on_off` is seeded (`database/seeders/EventTypesTableSeeder.php` :79-82) and read (`UserUtils.php` :325) but never emitted; the UI entry is commented out (`notifications_settings_screen.dart` :337-344).
- **V2-11 `publishTrips` can delete a day students are reserved on.** `TripUtils.php` :750-754 deletes planned trips lacking driver/bus **without checking reservations** (the older-than-yesterday prune does check, :736-744); the instance also snapshots `bus_id` from the driver's *current* bus (:705), so reassigning a driver's bus mid-schedule silently moves every future instance.
- **V2-12 Simple-mode litter.** `scheduleDriverTrip` creates a fresh Route/Stop/RouteStop/RouteStopDirection/Trip set daily (`TripUtils.php` :234-321) and only the *end-trip* path deletes them (`TripController` :1708-1718); a driver who never ends the trip leaks a route+stops set per day forever (publishTrips prunes `planned_trips`, not routes/stops).
- **V2-13 Hardcoded default password `12345678`** for guardians and CSV-imported parents, in both DB and Firebase Auth (`UserController.php` :2099/:2107-2108 and :2444/:2451-2452).
- **V2-14 Test hooks in production flows.** `pick_up_screen.dart` :292-302 posts hardcoded ticket `"123456789"` when `Config.localTest`; `all_apis.dart` `startEndTrip` :1245-1247 fakes a 1 s success on the same flag.
- **V2-15 Dead-endpoint crash.** `DriverController::getWalletPayments` :563-571 references undefined `$setting` (only `$settings` is defined :561) — the route `GET /drivers/wallet-payments` (`routes/api.php` :345) errors before returning the settings block.
- **V2-16 Two models, one table.** `App\Models\Reservation` sets `protected $table = 'student_trips'` (`app/Models/Reservation.php` :12) while `StudentTrip` maps the same table — divergent fillable/guarded and relation sets are a latent bug factory.
- **V2-17 Public channel shared across all days of a schedule.** `planned_trips.channel` is copied verbatim from `trips.channel` (`TripUtils.php` :700) and broadcast on a public `Channel` (`app/Events/TripPositionUpdated.php` `broadcastOn()`; `routes/channels.php` covers only `App.Models.User.{id}`) — one leaked channel string yields every position of every future day of that schedule. Unauthenticated `GET /routes/{id}` :202, `GET /stops/{id}` :209 and `GET /users/admin-info` :38 widen the leak.
- **V2-18 Drop-off has zero verification or notification.** `dropOff` marks by radius only (`TripController` :2506-2517) and no "student dropped off" event type exists; `dismissNextStop` (:2435-2462) marks students missed with **no** proximity check.
- **V2-19 Driver assignment skips conflict checking.** The `isDriverAvailable` call in `assignDriver` is commented out (`TripController` :591-595); conflicts are only discoverable post-hoc via `GET /drivers/conflicts`, which itself only flags same-direction overlaps (`DriverController` :107-114).

### V2.9 Driver-app minimum viable feature set for ASchool

Target: `flutter_user` (or a transport tab) + three new endpoints; parameters lifted from their code, fixes for their bugs noted.

**Screens (5):**
1. **Today's trips list** — `GET /transport/instances/today` (driver's instances with stop counts; port of `DriverController::getDriverTrips` :465-502). Start button → screen 2.
2. **Start trip** — map preview + stops; Start calls `POST /transport/instances/{id}/start` with optional submitted stop order (port of `start-stop` mode 1 + `trip_details` reorder, `all_apis.dart` :1235-1243; `running_trip_screen.dart` end button reuses mode 0 :897-916). Keep their 50 m proximity-to-first-stop check idea (`this_application_view_model.dart` `startTrip`) but make it configurable.
3. **Running trip** — `flutter_map` + OSM tiles; GPS stream `Geolocator.getPositionStream(LocationSettings(accuracy: high, distanceFilter: 10))` (add the `distanceFilter` they omitted, `running_trip_screen.dart` :150-153), POST every **≥3 s** and never while a POST is in flight (:225-243), `WakelockPlus.enable()` for the trip only (:190), **plus** an offline store-and-forward queue (their biggest gap — fixes are silently dropped on HTTP failure); next-stop banner card fed by the ingest response (port of `setLastPosition`'s return payload :1927-1934) with slow-down/arrived/missed banners + audio (5 s replay throttle, `BannerData` :63-88); End-trip blocked while `ride_status=1` passengers exist.
4. **Board (QR)** — `mobile_scanner` QR-only with 5 s same-code throttle and a manual roster fallback (`qrcode_scanner_screen.dart` :84-113, :199-236); "students did not show up" marks the stop's waiters missed (`missed=1`); **no** `Config.localTest` shortcut.
5. **Drop-off** — list of onboard students grouped by next stop; bulk "drop off all" (geofence-validated server-side) plus per-student confirm; require dismissal-style verification at school (our `AuthorizedPickup`).

**Endpoints (4):** `POST /transport/instances/{id}/start|end` (one route, mode param), `POST /transport/instances/{id}/position` (throttled ingest into `process_gps_data`), `POST /transport/instances/{id}/board` (`student_code` or `missed_stop=true`), `POST /transport/instances/{id}/dropoff`. All driver-JWT + instance-ownership checks **server-side** (fix V2-01).

**GPS/wakelock parameters:** accuracy `high`; `distanceFilter` 10 m; min POST interval 3 s; in-flight guard; wakelock on during instance; cancel stream in `dispose`; queue fixes offline (SQLite box) and flush with original timestamps so `GPSLog` stays truthful.

**Bottom line:** the five traces confirm v1's shape but move the concrete adoption set to — (1) the 4-table instance/ride schema of V2.7 with TIMESTAMPTZ columns and full GPSLog (reject their lossy stores); (2) the ride_status machine + end-trip guard + missed-student flow verbatim; (3) per-student notification prefs with 30-min dedup, minus their dead toggle; (4) fee-status gate instead of coins, with our `PaymentInitiation` idempotency (their payment surface is unauthenticated and replayable — V2-02/03 are the deepest security findings of either audit pass).

---

### 0. Scorecard at a glance

| Capability | SchoolBusTrack v2.3 | ASchool today |
|---|---|---|
| Route/bus/stop CRUD | Full (with Google polylines) | Full (OSM, simpler) |
| Recurring schedule → daily trip instances | Yes (`trips`→`planned_trips`) | Missing |
| Student→bus/stop assignment | Yes (AM/PM, parent stop choice) | Partial (orphaned pages) |
| Live tracking | Driver phone → server → Echo push | ESP32 → Firebase → poll/Socket.IO |
| GPS history | None (last position only) | Full (`gps_logs`) |
| Board/alight (attendance on bus) | Yes (ride_status 0/1/2/3 + QR scan) | Missing |
| Missed-student detection & alerts | Yes (auto + driver actions + FCM) | Missing |
| Parent notifications | 8 per-student toggles, per-student radius | One admin-facing 2 km deviation alert |
| ETA | Planned times + live km distance | Static route constant (misleading) |
| Driver app | Full (25 screens, audio coaching, scan) | None |
| Fees linkage | Coins wallet, 7 gateways, balance gating | Via fees plugin (not wired) |
| Drop-off safety | Bulk drop-off, no identity check | dismissal plugin (QR, authorized adults) |
| Nepal readiness | None | BS dates, Nepali labels, eSewa/Khalti |
| Tenancy hygiene | Global settings row, public channels | Per-school rooms + entitlements |

---

## 1. INVENTORY

### 1.1 Laravel backend (`Code/AdminPanel/`)

Framework: Laravel + Sanctum personal access tokens + Fortify + Laravel Echo broadcasting (socket.io transport) + kreait/laravel-firebase for FCM. Roles live in the `roles` table; role_id constants observed in code: driver=3, parent=4, guardian=5, student=6 (see `app/Traits/TripUtils.php`, `app/Http/Controllers/Api/UserController.php`). Middleware aliases used on every route: `admin`, `school`, `parent`, `driver`, `parent-guardian`, `school-parent`, `admin-school`, `parent-driver` — a full RBAC matrix on the API surface.

**API routes** (`Code/AdminPanel/routes/api.php`, ~700 lines): route groups for `docs`, `admin-dashboard`, `school-dashboard`, `google-routes`, `users`, `places`, `routes`, `stops`, `trips`, `students`, `planned-trips`, `reservations`, `complaints`, `settings`, `currencies`, `notifications`, `drivers`, `plans`, `charges`, `buses`, `auth`, `activation`, `test`.

**API controllers (20)** in `Code/AdminPanel/app/Http/Controllers/Api/`:

| Controller | Responsibility |
|---|---|
| `TripController.php` (2,568 lines) | Core engine: trip CRUD + suspensions, planned trips (upcoming/running/completed), start/stop trip, `setLastPosition` (GPS ingest + geofence + notifications), `pickUp`, `dropOff`, `dismissNextStop`, `notify`, per-student notification engine, price calc, seat availability |
| `RouteController.php` (238 lines) | Route create/edit/delete/list, route detail with stops |
| `StopController.php` (495 lines) | Stop CRUD, `getClosestStops`, parent `setPickupDropOff` and `setPickupDropOffLocation` (custom lat/lng) |
| `BusController.php` | Bus CRUD, assign/unassign driver, available drivers |
| `DriverController.php` | Assign/unassign bus, driver conflicts, driver info/documents/trips, driver wallet payments, preferred payout method |
| `UserController.php` (largest) | Users of all roles + edit/suspend, `assignStudentBus`, students CSV import (`downloadTemplateForStudents`, `uploadStudents`), devices, OTP, delete-account requests, coins, 7 payment gateways, student CRUD by parent |
| `ReservationController.php` | Reservations list + `getReservationDetails` (what parents track) |
| `AuthController.php` | Login/signup via token, social, OTP verify, `loginFromAdminToSchool` impersonation |
| `SettingController.php` | Global + school settings: all geofence distances, simple_mode, OTP required, privacy/terms editors |
| `NotificationController.php` | List/mark-seen/delete-all notifications |
| `PlanController.php` | Billing plans (school-plans and parent-plans) |
| `ChargeController.php`, `CurrencyController.php` | Charges and multi-currency |
| `AdminDashboardController.php`, `SchoolDashboardController.php` | Dashboard aggregates |
| `GoogleRouteController.php` | Proxy to Google Routes API (`compute-route`) |
| `PlaceController.php` | Favorite/recent/saved places for parents |
| `ComplaintController.php` | Complaint create/list/take-action |
| `ActivationController.php` | License activation codes |
| `StudentSetting.php` | `getPickupDropOff`, `getStudentTrips` |

**Models (43)** in `Code/AdminPanel/app/Models/`:
- Transport core: `Route`, `RouteStop`, `RouteStopDirection` (polyline per leg), `Stop`, `Trip` (recurring schedule), `TripDetail`, `PlannedTrip` (day instance), `PlannedTripDetail`, `Reservation` (per-student ride with `ride_status`), `StudentTrip`, `StudentSetting`, `StudentGuardian`, `Bus`, `DriverInformation`, `DriverDocument`, `Event`, `EventType`, `SuspendedTrip`, `Status`, `TripSearchResult`.
- Wallet/billing: `Plan`, `Charge`, `UserCharge`, `UserPayment`, `UserRefund`, `Consumption`, `Redemption`, `RedemptionType`.
- Gateway accounts/txns: `PaypalAccount`, `PaystackTransaction`, `PaytabsTransaction`, `FlutterwaveTransaction`, `MobileMoneyAccount`, `BankAccount`.
- Platform: `User`, `Role`, `Setting`, `SchoolSetting`, `AuthSetting`, `Currency`, `Place`, `Complaint`, `Notification`, `UserNotification`, `SystemInfo`.

**Migrations (50+)** in `Code/AdminPanel/database/migrations/` — the load-bearing ones:
- `2019_10_12_000007_create_trips_table.php` — `channel` (broadcast channel per trip), `effective_date`, `repetition_period` (days), `stop_to_stop_avg_time` (mins), `first_stop_time`, `last_stop_time`, driver, school.
- `2019_10_12_000012_create_student_settings_table.php` — the 8 per-student notification toggles: `bus_arrived_at_drop_off_location_notification_on_off`, `bus_arrived_at_pickup_location_notification_on_off`, `bus_arrived_at_school_notification_on_off`, `bus_near_drop_off_location_notification_on_off`, `bus_near_pickup_location_notification_by_distance` (per-student radius), `next_stop_is_your_pickup_location_notification_on_off`, `student_is_missed_pickup_notification_on_off`, `student_is_picked_up_notification_on_off`; plus `morning_bus_id`, `afternoon_bus_id`, `absent_on`.
- `2021_08_01_000043_add_tracking_to_student_settings_table.php` — custom pickup/drop-off point (lat/lng/place_id/address) per student.
- `2021_08_01_000034_create_planned_trip_details_table.php` — per-stop `planned_timestamp` / `actual_timestamp` pairs.
- `2021_08_01_000049_add_distances_to_settings_table.php` + `settings/index.vue` — global radii config.
- `2019_10_10_000001_create_users_table.php` — `student_identification` (ticket number scanned by driver).

**Scheduler** `Code/AdminPanel/app/Console/Kernel.php`:
- everyMinute: `deleteAccounts()`, `endTrips()`, `publishTrips()`, `assignStudentsToTrips()` (implemented in `app/Traits/TripUtils.php` and `app/Traits/UserUtils.php`).
- daily: `scheduleDriverTrips()` (simple-mode ad-hoc route generation).

**Broadcasting:** `Code/AdminPanel/app/Events/TripPositionUpdated.php` implements `ShouldBroadcast` and broadcasts on a **public** `new Channel($channelId)` (channel string persisted on `trips.channel`). `routes/channels.php` authorizes only `App.Models.User.{id}` — trip position channels are unauthenticated; anyone with the channel name can subscribe to raw bus positions.

**Key endpoint map** (`Code/AdminPanel/routes/api.php`) — the transport-critical subset:

- `POST /api/planned-trips/set-last-position` — GPS ingest from driver app (lat, lng, speed) + geofence + notifications (Section 2)
- `POST /api/planned-trips/start-stop` — driver starts/ends a planned trip (mode 1/0)
- `POST /api/planned-trips/pick-up` — scan/miss a student (ticket_number, missed flag, lat/lng/speed)
- `POST /api/planned-trips/drop-off` — bulk drop-off at stop
- `POST /api/planned-trips/dismiss-next-stop` — skip stop, mark waiters missed
- `POST /api/planned-trips/notify` — school broadcast to passengers + driver
- `GET /api/planned-trips/get-students-to-be-picked-up/{trip_id}` and `/get-all-students-on-trip/{trip_id}` — driver manifests
- `GET /api/planned-trips/all|on-route|{id}` — admin/parent trip views; `GET /api/trips/period` and `/suspensions`
- `POST /api/stops/set-pickup-drop-off` and `/set-pickup-drop-off-location` — parent stop choice (incl. custom lat/lng); `GET /api/stops/get-closest-stops/all`
- `POST /api/users/assign-student-bus` — student→bus for morning/afternoon; `POST /api/users/set-absent-student`
- `POST /api/users/capture-braintree|capture-razorpay-payment|initialize-flutterwave-order|capture-paytabs-payment|capture-paystack-payment|initialize-stripe-payment` (+ `-parent` variants) — 7 gateways
- `GET /api/drivers/conflicts|available|available-buses` — fleet scheduling checks
- `POST /api/trips/suspend`, `POST /api/trips/assign-driver`, `POST /api/trips/trash-restore` — schedule administration
- `POST /api/planned-trips/test-set-last-position` and `POST /api/test/test-send-student-notification` — unauthenticated test routes left in the shipped API (security smell worth noting)

**Repository layer:** `Code/AdminPanel/app/Repository/` defines 35 interfaces with an Eloquent implementation folder — clean pattern, worth noting for our services layer. Single service: `app/Services/GoogleRoutesService.php`.

**Web admin SPA** `Code/AdminPanel/front-end/src/` (Vue 2 + Vuetify + Vuex + vue-router + laravel-echo):
- `views/dashboard/` — `AdminDashboard.vue`, `SchoolDashboard.vue`, cards: `DashboardCardTotalEarning.vue`, `DashboardCardRemainingCoins.vue`, `DashboardCardSalesByTrips.vue`, `DashboardCardPlans.vue`, weekly overview.
- `views/live-tracking/index.vue` — admin live map of on-route trips; subscribes `window.Echo.channel(trip.channel).listen("TripPositionUpdated", ...)` and moves bus markers.
- `views/trips/` (index, trips-table, view-trip, create-edit), `views/planned-trips/` (index, planned-trips-table), `views/reservations/`.
- `views/system-setup/` — `school/index.vue`, `buses/index.vue`, `routes/` (index, create-edit, view), `stops/` (index, create-edit, view), `plans/` (index, school-plans, parent-plans).
- `views/settings/index.vue` — currency, `distance_to_stop_to_mark_arrived`, `max_distance_to_stop`, `distance_to_drop_off`, `distance_to_pick_up`, `distance_to_slow_down`, OTP required toggle, simple_mode toggle.
- `views/payments/`, `views/transfer-coins/`, `views/buy-plans/` (PayPal/Stripe/Braintree incl. parent plan checkout), `views/complaints/`, `views/users/` (users-table, edit-user, view-user, student-card, guardian-card, approve-reject-card, student-location), `views/activation/`, `views/landing-page/`.

**Blade:** `Code/AdminPanel/resources/views/student_card.blade.php` (printable QR student card), `emails/email_otp.blade.php`, `emails/email_payment_link.blade.php`, `emails/email_student_card.blade.php`.

### 1.2 Guardian (parent) Flutter app — `Code/Apps/school_trip_track_guardian/`

MVVM: `lib/view_models/this_application_view_model.dart` (all endpoints + Echo socket), `lib/connection/all_apis.dart`, get_it service locator (`lib/services/service_locator.dart`). Full screen inventory (33) in `lib/gui/screens/`:

| Screen | What it does |
|---|---|
| `home_screen.dart` | Per-student morning/afternoon trip cards, active-trip entry points |
| `track_school_bus_screen.dart` | Live map (Section 3) |
| `trip_timeline_screen.dart` | Live stop-by-stop timeline of today's trip |
| `planned_trip_timeline_screen.dart` | Upcoming/planned trip timeline |
| `route_timeline_screen.dart` | Static route view with all stops |
| `routes_screen.dart` / `route_details_screen.dart` | Browse routes, map + stops detail |
| `stops_screen.dart` / `stop_location_screen.dart` | Stop lists and individual stop map view |
| `choose_stop_screen.dart` / `choose_location_screen.dart` | Pick a route stop or a custom Google-Places location |
| `pickup_dropoff_stops_screen.dart` | Manage the student's AM/PM stops |
| `reservation_dialog.dart` (widget) | Seat reservation confirmation |
| `notifications_screen.dart` | Notification center (seen/mark-all/delete) |
| `notifications_settings_screen.dart` | Per-student 8-toggle notification matrix |
| `wallet_screen.dart` (+ `_android` / `_ios`) | Coins balance and in-app purchase flows |
| `add_edit_student_screen.dart` / `student_details_screen.dart` | Family student CRUD + ticket QR |
| `guardians_screen.dart` | Multi-guardian management |
| `schools_screen.dart` | Join school by code |
| `complaint_screen.dart` | Complaints |
| `devices_screen.dart` | Device token management/revoke |
| `my_profile_screen.dart`, `more_screen.dart` | Profile, settings hub |
| `sign_in_screen.dart`, `sign_up_screen.dart`, `forget_password_screen.dart`, `pin_code_verification_screen.dart` | Auth + OTP |
| `about_screen.dart`, `terms_conditions_screen.dart`, `contact_us_screen.dart`, `change_language_screen.dart` | Misc |

Widgets of interest (`lib/gui/widgets/`): `full_trip_time_line.dart`, `trip_time_line.dart`, `route_stop_card.dart`, `ticket_widget.dart`, `google_map_with_icon.dart`, `direction_row.dart`, `direction_positioned.dart`, `my_interstitial_ad.dart` (AdMob in a school app).

Key dependencies (`pubspec.yaml`): `google_maps_flutter`, `socket_io_client` + laravel Echo, `firebase_messaging`/`firebase_auth`, `geolocator`, `qr_flutter` (student ticket QR), `barcode_widget`, `sign_in_with_apple`/`google_sign_in`/`flutter_facebook_auth`/`twitter_login`, `connectivity_plus`, `overlay_support`, `timeline_tile`. 8 locale ARBs in `lib/gui/languages/l10n/` (ar, de, en, es, fr, hi, it, pt — Arabic RTL supported).

### 1.3 Driver Flutter app — `Code/Apps/school-trip-track-driver/`

Full screen inventory (25) in `lib/gui/screens/`:

| Screen | What it does |
|---|---|
| `start_trip_screen.dart` | Today's trips; start trip (with simple-mode stop ordering) |
| `running_trip_screen.dart` (1,149 lines) | Advanced-mode trip execution: map, GPS stream, geofence banners, audio prompts |
| `running_trip_simple_mode_screen.dart` (1,017 lines) | Simple-mode variant (ad-hoc route from assigned students) |
| `qrcode_scanner_screen.dart` | Scan student ticket for pickup (`mobile_scanner`, overlay, 3s re-scan throttle) |
| `pick_up_screen.dart` | Pick-up flow (manual/scan entry) |
| `trip_students_screen.dart` / `students_screen.dart` | On-trip and to-pick-up manifests |
| `students_order_screen.dart` | Drag-drop stop ordering (`ReorderableListView.builder`) |
| `trip_time_line_screen.dart` | Stop timeline during trip |
| `driver_information_entry_screen.dart` | Driver profile entry |
| `driver_under_review_screen.dart` | Blocking "under review" state pending document approval |
| `add_edit_document_screen.dart` | License/ID document upload |
| `home_screen.dart`, `notifications_screen.dart` | Hub + notifications |
| `devices_screen.dart`, `my_profile_screen.dart`, `more_screen.dart` | Platform screens |
| `sign_in_screen.dart`, `sign_up_screen.dart`, `forget_password_screen.dart`, `pin_code_verification_screen.dart` | Auth + OTP |
| `schools_screen.dart`, `about_screen.dart`, `terms_conditions_screen.dart`, `contact_us_screen.dart`, `change_language_screen.dart` | Misc |

Key dependencies: `geolocator`, `wakelock_plus`, `mobile_scanner`, same Echo/socket stack.

### 1.4 Documentation & upgrade notes

`Documentation/AdminPanel/PDF/SchoolBusTrack admin panel documentation.pdf`, `Documentation/Apps/PDF/SchoolBusTrack Apps Documentation.pdf`, `UpgradeGuide/UpgradeV2.3.txt`.

---

## 2. TRACKING ARCHITECTURE

### 2.1 Data flow (device → store → serve)

1. **Source:** the driver's phone. `school-trip-track-driver/lib/gui/screens/running_trip_screen.dart` opens `Geolocator.getPositionStream(locationSettings: LocationSettings(accuracy: LocationAccuracy.high))` in `initState` (lines ~209–244) — no `distanceFilter`, so it fires at device rate.
2. **Ingest:** each fix POSTs `/api/planned-trips/set-last-position` (`planned_trip_id, lat, lng, speed`). Client throttle: at most one POST per 3 s (`lastSentLocationTime` guard) and never while the previous call is in-flight. Server validates the caller is the assigned driver (`TripController::setLastPosition` line 1812).
3. **Store:** ONLY the latest fix is persisted — `planned_trip->last_position_lat/last_position_lng` (lines 1829–1832). **There is no GPS history/breadcrumb table anywhere in the schema** — post-trip replay, speed analytics, and dispute evidence are structurally impossible.
4. **Realtime serve:** the same request broadcasts `TripPositionUpdated($planned_trip->channel, json_encode({lat,lng,speed}))` (line 1839) over Laravel Echo/socket.io. Consumers:
   - Guardian app: `this_application_view_model.dart::initEcho()` (socket_io_client + Echo SocketIO broadcaster) and `listenToEcho(channelId, eventName)` parses lat/lng/speed and `notifyListeners()`.
   - Admin web: `front-end/src/views/live-tracking/index.vue` `listenToChannel()` does `window.Echo.channel(trip.channel).listen("TripPositionUpdated", ...)`.
5. **Fallback:** when `echoConnected == false`, the guardian map falls back to the last persisted position (`reservation.trip.lastPositionLat/Lng`) and shows a red "Error tracking bus location" banner (`track_school_bus_screen.dart` lines 101–108 and 180–202).

**Update frequency:** device stream ~1 Hz → POSTs ≥3 s apart → instant socket push to every subscriber. End-to-end latency ≈ 3 s while the driver app is foreground. Parent app does no polling at all — pure push plus last-known fallback.

### 2.2 Geofencing and stop-arrival logic (server-side, `TripController::setLastPosition` lines 1791–2077)

- Haversine distance (`TripUtils::distance`, `app/Traits/TripUtils.php` line 844, returns km, multiplied by 1000) from the bus to the **next unvisited stop** — the first `planned_trip_detail` with `actual_timestamp == null`. Stops are visited strictly in order.
- Configurable radii (global `settings` row, edited in `front-end/src/views/settings/index.vue`, surfaced to the driver app as school settings): `distance_to_stop_to_mark_arrived`, `max_distance_to_stop`, `distance_to_pick_up` (default 100 m), `distance_to_drop_off` (100 m), `distance_to_slow_down` (1000 m).
- **Arrival auto-mark:** when the bus is inside `distance_to_stop_to_mark_arrived` AND there are zero passengers waiting to board AND zero to alight at that stop, `actual_timestamp` is stamped (lines 1920–1923). If passengers exist, the stamp waits for explicit driver actions — an anti-false-arrival guard.
- **Per-passenger trigger engine** runs on every position update against waiting passengers at the next stop: "next stop is your pickup" (approaching), "bus near pickup within N meters" with a **per-student custom radius** (`bus_near_pickup_location_notification_by_distance`), "bus arrived at pickup" (inside arrival radius); mirrored for drop-off (`bus_near_drop_off_location_notification_on_off`, `bus_arrived_at_drop_off_location_notification_on_off`). Delivery = FCM via `UserUtils::sendSingleNotification` (kreait `CloudMessage`, APNs priority 10, sound) + in-app `Notification` rows; a guardian receives notifications for all linked students (`UserUtils::sendNotificationToUser` pushes to parent + all guardians' `fcm_token`s).
- **No route-deviation geofence for trips.** `isPointWithinRangeOfPath` (`TripController` line 648) exists but is used only in the reservation/pricing search flow. There are no speed alerts and no departure/late-departure ("delay") detection anywhere — "delay" is only implicit by comparing `planned_timestamp` vs `actual_timestamp`.
- A second, legacy "closest unvisited stop" mode exists in the same function (lines 1948–2071) behind `if(true)` — dead code showing the design iteration.

### 2.3 Trip lifecycle & scheduling

- `trips` = recurring definition (effective_date, repetition_period, first/last stop times, `stop_to_stop_avg_time`) with `suspended_trips` (holidays) and `events`/`event_types` for calendar exceptions (`TripUtils::getAllEvents` expands them).
- `Kernel.php` everyMinute → `TripUtils::publishTrips()` (line 675) materializes today's `planned_trips` + per-stop `planned_trip_details` for every active driver-assigned trip, then prunes: yesterday-and-older childless instances, and any instance missing driver or bus.
- `TripUtils::assignStudentsToTrips()` (line 448) runs every minute: for each student, skip if `absent_on` == today (and clear stale absence), then **gate on wallet**: if neither the school nor the parent has positive balance, set student `status_id=5` ("out of coins") and skip; otherwise compute pickup trip/stop and drop-off trip/stop and create `Reservation`s. Transport access is literally metered by coins.
- `Kernel::scheduleDriverTrips()` (daily, simple mode only) builds an ad-hoc morning/afternoon route per driver-bus from the students assigned to that bus, honoring per-school off-days (`SchoolSetting` sunday..saturday flags) and student absence. Zero-config mode for small schools.
- `UserUtils::endTrips()` force-ends stale running trips; `UserUtils::deleteAccounts()` honors delete-account requests from parents/drivers.
- Driver start/stop: `TripController::startStopPlannedTrip` (line 1614). In simple mode the driver app submits a chosen stop order; the server deletes and rewrites `planned_trip_detail` order before stamping `started_at`. **Ending the trip is refused while any reservation still has `ride_status=1` (student onboard)** (line 1694) — and in simple mode ending deletes the ad-hoc route and its stops.

### 2.4 Offline handling & battery strategy

- Driver app: **no offline queue** — fixes are dropped when HTTP fails; there is no connectivity gate on the stream. Trip screens are strictly foreground: the stream is created in `initState` and cancelled in `dispose`.
- Battery strategy = `WakelockPlus.enable()` for the entire trip (screen stays on, which also guarantees the position stream keeps flowing), plus streaming only while the screen exists. No background location service, no foreground-service notification, no battery-optimization exemption handling, no batching. This is the weak point of their architecture: drivers must keep the app open and the screen on for ~40 minutes per leg.
- Guardian app: socket disconnect → last-known-position fallback banner (2.1); `connectivity_plus` is present for connection surfaces.
- Server-side self-healing: the every-minute schedulers (publish/assign/end) absorb driver-app flakiness, e.g. force-ending forgotten trips.

---

## 3. PARENT UX (guardian app)

- **Live map** `track_school_bus_screen.dart`: Google Map with a custom school-bus PNG marker (`getBytesFromAsset`), live speed shown in the marker's info window, red stop markers with name+address info windows, route polylines built from `RouteStopDirection.pathPoints` (colored **randomly per build** — line 123, a polish bug), auto camera-fit to marker bounds (`adjustBounds`/`getBoundsMarker`), and a bottom card showing: bus icon + dashed line + **live distance to the student's stop in km** (client-side haversine in `Tools.calculateDistance`), the planned pickup/drop-off time, and stop name/address. Floating actions: **call driver** (`tel:` launch with toast if number missing, `callDriver()` line 526) and zoom-fit. Explicit empty states: "Trip is not available" / "Trip has not started yet" / "Trip has ended" (`tripNotStartedScreen` line 548). No minutes-ETA anywhere — planned time + km distance only.
- **Timelines** (`full_trip_time_line.dart`, `trip_time_line.dart` used by `trip_timeline_screen.dart` / `planned_trip_timeline_screen.dart` / `route_timeline_screen.dart`): numbered stop tiles with planned time + address, green indicator/connector for the completed portion of the trip (start..end index logic), grey for the rest — a clean stop-progress visualization we can rebuild with `flutter_map` + OSM tiles.
- **Notifications:** `notifications_screen.dart` (list, mark-as-seen, mark-all, delete-all) + `notifications_settings_screen.dart` with per-student Switch toggles for the 8 server-side settings; delivered via FCM with in-app overlay (`overlay_support` dep) and badge counts (`icon_badge`).
- **Board/alight history:** `Reservation.ride_status` lifecycle (0 waiting / 1 onboard / 2 missed / 3 dropped) is exposed via `/reservations/get-reservation-details`; per-stop `planned_timestamp` vs `actual_timestamp` is visible in timelines — a parent can reconstruct each day's actual pickup/drop-off times and missed-pickup events.
- **Stop self-service:** parent picks pickup + drop-off stops from the route (`choose_stop_screen.dart`), or sets a **custom lat/lng pickup point** (`setPickupDropOffLocation` + `choose_location_screen.dart` Google Places flow), finds nearest stops (`getClosestStops`), and manages favorite/recent places (`PlaceController`).
- **Extras:** student QR ticket in-app (`qr_flutter`) matching the printable card; absence marking (`POST /users/set-absent-student`) which the schedulers honor; multi-guardian families; multi-school joining via school code; device management; 8 languages with RTL.

## 4. DRIVER APP

A single driver session (`Code/Apps/school-trip-track-driver/`):

1. **Start trip** (`start_trip_screen.dart`): sees today's planned trips; simple mode offers drag-drop student/stop ordering (`students_order_screen.dart`, `ReorderableListView.builder` + `drag_handle`) before starting — the route is built around the actual student manifest; the server rewrites the stop order on start.
2. **Run trip** (`running_trip_screen.dart`): full-screen map + continuous GPS streaming (Section 2) + **server-driven coaching banners with spoken audio** (`BannerData` class, lines 101–142; audio assets in `assets/audios/`, 5 s replay throttle):
   - "You are near the next stop, please slow down" (1 km slow-down zone)
   - "You have arrived to the stop, please pick up students" (100 m, with a "Pick up students" action button that opens the QR scanner)
   - "You have missed the pickup at the stop, please go back" (red)
   - and the drop-off trio (slow down / arrived — "Drop off students" button triggers `dropOffPassengersEndpoint` / missed).
   Zone thresholds come from school settings (`settings!.distanceToPickup/SlowDown/DropOff`).
3. **Board students:** `qrcode_scanner_screen.dart` scans the student ticket (`student_identification`) → `POST /planned-trips/pick-up`. Server geofence-validates the driver against the student's stop (`TripController::pickUp` line 2255: "Passenger is not near the stop" 500 otherwise), sets `ride_status=1`, fires the "student is picked up" FCM. A `missed=1` variant — or the no-ticket path — marks waiting students at the current stop as `ride_status=2` (missed) and sends "student missed pickup" notifications. `POST /planned-trips/dismiss-next-stop` skips a stop and misses everyone waiting there (`dismissNextStop` line 2405).
4. **Alight students:** `POST /planned-trips/drop-off` marks all onboard students whose end stop is within the arrival radius as `ride_status=3` (line 2474) — bulk drop-off, no per-student scan.
5. **Manifests:** `GET /planned-trips/get-students-to-be-picked-up/{trip_id}` and `/get-all-students-on-trip/{trip_id}` power `trip_students_screen.dart` / `students_screen.dart`; `trip_time_line_screen.dart` mirrors the parent timeline.
6. **Messaging:** school can broadcast `POST /planned-trips/notify` to all waiting/onboard students (their guardians) + the driver — the de-facto delay/communication tool (`TripController::notify` line 2527).
7. **End trip:** refused while anyone is still onboard (Section 2.3).
8. **Onboarding/admin:** driver profile + documents with school review states (`driver_under_review_screen.dart`, `DriverDocument` model), bank/mobile-money payout accounts, own wallet payments (`GET /drivers/wallet-payments`), preferred payout method.

**Not present:** SOS/emergency button, speed-limit alerts, occupancy/passenger-count widget, authorized-pickup verification at drop-off (no PIN/signature — a child-safety hole), navigation handoff to Google Maps, offline trip logs.

---

## 5. OPERATIONS (admin depth)

- **Routes/stops:** full CRUD with Google Directions polylines per leg (`app/Services/GoogleRoutesService.php`, `GET /api/google-routes/compute-route`), ordered route stops, planned times derived from `stop_to_stop_avg_time`. The admin SPA has dedicated create/edit/view pages per entity.
- **Vehicles/drivers:** bus CRUD; driver↔bus assignment from both directions (`/buses/assign-driver`, `/drivers/assign-bus`); **driver double-booking conflict detection** (`GET /drivers/conflicts`); availability views (`/drivers/available`, `/drivers/available-buses`, `/drivers/all-buses`); document approval workflow; suspend/activate users.
- **Student-transport assignment:** school assigns student→bus separately for morning and afternoon (`POST /users/assign-student-bus` → `student_settings.morning_bus_id` / `afternoon_bus_id`); parents then choose their own stops; students CSV import with downloadable template; seat-capacity checks during reservation search (`getAvailableSeats`, line 674).
- **Fees linkage:** per-ride **coins economy**: parent/school balances, school-plans vs parent-plans, `request-coins`, `transfer-coins`, `consumptions` (per-ride debit), refunds, `out_of_coins` status gating auto-reservation (Section 2.3). Seven gateways: Braintree, Stripe, Razorpay, Flutterwave, Paytabs, Paystack, PayPal — plus native IAP wallet screens (`wallet_screen_android/ios.dart`).
- **Attendance-on-bus:** the ride_status state machine IS the transport attendance register (waiting/onboard/missed/dropped), plus absence pre-marking, missed-pickup notifications, and printable student QR cards.
- **Reports/dashboards:** AdminDashboard (earnings, plans sold, schools) and SchoolDashboard (trips, sales-by-trips, remaining coins) in `front-end/src/views/dashboard/`; reservations table; complaints; payments; on-route planned-trips monitor. **No CSV/PDF export, no per-trip post-mortem, no driver performance or route-adherence analytics** — and no GPS history to compute them from.
- **Licensing/tenancy:** activation codes (`ActivationController`), admin→school impersonation (`loginFromAdminToSchool`), privacy/terms editors, multi-currency. Notably: all geofence radii are **one global row** — a school hosting SaaS operator cannot give schools different radii.

---

## 6. GAP ANALYSIS vs ASCHOOL

### 6.1 What ASchool's gps_tracking/transport LACKS (evidence-based)

1. **No trip/schedule lifecycle at all.** ASchool `backend/app/models/transport.py` (80 lines) defines only `Route`, `Bus`, `BusStop`, `GPSLog`. SchoolBusTrack's core — recurring `Trip` → daily `PlannedTrip` → per-stop `PlannedTripDetail` with planned/actual timestamps, suspensions, driver assignment, start/stop — has **no equivalent**. We cannot answer "is the bus running today, which stop is next, who has been picked up".
2. **No board/alight (attendance) state machine.** SBT's `Reservation.ride_status` (0/1/2/3) + scan-based pickup + missed-student alerts + "cannot end trip with students aboard" vs ASchool: nothing — a parent never learns their child was (or wasn't) collected. This is the single most safety-relevant gap.
3. **No per-student stop notifications.** ASchool emits exactly one alert: `check_geofence_alerts` in `backend/app/tasks/gps_processing.py` (lines 114–184) pushes only to **school admins** (roles admin/principal/transport_manager) and only when the bus is **>2 km from every stop on its route** (`GEOFENCE_RADIUS_KM = 2.0`) — a radius so large it is nearly useless as a fence, and parents get nothing. SBT: 8 per-student toggles including per-student approach radius in the 100 m class, arrival alerts, missed-pickup alerts, via FCM + in-app.
4. **ETA is fake.** ASchool `backend/app/api/v1/parent_app.py` lines 681/724/736: `"eta_minutes": bus.route.estimated_time_mins` — a static route-level constant shown regardless of actual bus position. SBT at least shows live distance-to-stop + planned time; both lack true ETA, but ours is misleading. Opportunity: we hold full GPSLog history + stop coords, so a real ETA (haversine to next stop / OSRM) is cheap to add and would leapfrog SBT.
5. **No driver transport app.** SBT has a 25-screen driver app (trip start/end, scan-boarding, audio coaching, manifests, documents). ASchool's five Flutter apps have **no transport feature for drivers at all** — the driver phone cannot even feed GPS; only the ESP32 can. `flutter_parent/lib/features/bus_tracker/bus_tracking_screen.dart` is the only transport UI on mobile.
6. **Mobile is polling, not push.** ASchool parent app polls bus info every 15 s via `Timer.periodic` (lines 34–35 of `bus_tracking_screen.dart`); only the web map (`frontend/app/dashboard/transport/map/page.tsx`, Socket.IO `gps_update` + `joinSchoolRoom`) is realtime. SBT pushes every position over Echo to both web and mobile. Also our room is the whole school, not per-trip — the payload surface is fine but the admin map re-renders on every bus tick with no per-trip channel scoping.
7. **Student-transport assignment is half-wired.** `BusStop.student_ids` ARRAY exists and `frontend/app/dashboard/transport/allocation/page.tsx` PUTs `/transport/stops/{id}` with `student_ids`, but there is no dedicated assignment API, no capacity check, no morning/afternoon distinction, no per-student stop times — and `frontend/app/dashboard/transport/pickup-points/page.tsx` duplicates the stops CRUD with no distinct backend (the "orphaned" pages). SBT: bus-per-direction assignment + parent stop choice (incl. custom home point) + seat availability + balance gating.
8. **No operations reports.** ASchool has no trip history, no missed-pickup register, no driver conflict detection, no transport dashboards/exports; `backend/app/api/v1/transport.py` (355 lines) is CRUD + gps-logs list/ingest only.
9. **Manifest over-promises.** `backend/app/plugins/modules/gps_tracking/manifest.yaml` declares events `transport.bus_departed`, `transport.bus_arrived`, `transport.speed_alert` — **nothing in the code emits them** (checked `app/tasks/gps_processing.py`, `app/api/v1/transport.py`). The plugin contract is ahead of the implementation; either implement or prune before marketplace listing.
10. **No parent-side preferences or self-service:** no notification settings UI, no stop selection, no transport absence marking, no trip timeline. We do show `driver_phone` and `last_updated` on the tracker (parent_app.py `bus-info`) — small wins to keep.

### 6.2 What ASchool does BETTER (keep and advertise)

1. **Full GPS history.** ASchool `GPSLog` stores every fix (speed_kmh, heading, accuracy_m, timestamp, firebase_synced). SBT keeps only last position, so we can offer replay, speed analytics, and dispute evidence they structurally cannot.
2. **Hardware GPS path.** ESP32+NEO-6M → Firebase RTDB → `poll_firebase_gps` (15 s Celery beat with a 14 s task lock, `backend/app/tasks/gps_firebase_poller.py`) works with **no smartphone and no driver cooperation**, handling both WiFi (flat PUT) and SIM800L GPRS (push-children with newest `ts`) node shapes — realistic for Nepal. SBT dies if the driver's phone is off/asleep/backgrounded.
3. **Multi-tenant plugin isolation.** `plugin_required("gps_tracking")` entitlement gating, Socket.IO per-school rooms, school-scoped queries, per-school `Bus.gps_device_id` — cleaner than SBT's single global `settings` row (their radii apply to ALL schools on an instance).
4. **Nepal stack:** `name_nepali` on stops, BS dates, eSewa/Khalti across the platform — SBT has 8 languages incl. Hindi but zero Nepal payment rails and Gregorian-only scheduling.
5. **Open map stack:** `flutter_map`/OSM and Leaflet-class web maps — no Google Maps billing at scale; SBT is hard-coupled to Google Maps + Places.
6. **Complementary dismissal plugin** (`backend/app/models/dismissal.py`: `AuthorizedPickup`, `DismissalRecord`; QR pickup verification, authorized-adult management) — SBT has no authorized-pickup verification at all. Their end-trip guard + our dismissal QR is a stronger combined child-safety story than either product alone.

---

## 7. ORGANIZATION LESSONS FOR OUR TRANSPORT/GPS PLUGINS

**Should gps_tracking, dismissal, and the transport pages merge?** Not into one blob — but gps_tracking must absorb the *trip lifecycle*, and the orphaned pages must fold into it. Recommended target model:

1. **Keep `gps_tracking` as the transport operations plugin** (tracking + trips + assignment) and keep `dismissal` separate (at-school QR handoff). Bridge them with the already-declared plugin events: emit `transport.bus_arrived` from a new trip-arrivals service; dismissal listens and pre-warms its queue ("bus 5 min out"). First fix the manifest/code event gap (6.1 #9).
2. **Adopt the 4-layer model SBT proves out** (their table → ours):
   - *Definition:* `Route` + ordered stops — we have this (`BusStop.sequence_number`, `arrival_time_am/pm`); add per-leg offsets instead of only absolute times.
   - *Schedule:* recurring definition with effective date/repetition/suspensions — add `transport_trips` (recurring, driver, bus, channel) + `transport_trip_instances` (date, driver, bus, status, started_at/ended_at, last lat/lng) + per-instance stop rows with `planned_ts`/`actual_ts`. A every-minute "publish today's instances" cron replaces their `publishTrips()`.
   - *Participation:* `transport_reservations(instance, student, start_stop, end_stop, ride_status 0/1/2/3)` — this state machine IS attendance-on-bus, powers the parent timeline, the missed-pickup register, and the end-trip guard.
   - *Telemetry:* our existing `GPSLog` + a small `bus_last_position` cache (what SBT stores on `planned_trips`) so the parent app renders instantly and polls cheaply.
3. **Server-side geofence engine with per-student radius.** Port SBT's `setLastPosition` pattern into `process_gps_data`: compute haversine to the instance's next unvisited stop; stamp `actual_ts` when inside radius AND nobody pending; fire FCM per student per saved prefs (new `transport_notification_prefs` table: near_pickup_radius, arrived_pickup, picked_up, missed, near_dropoff, arrived_dropoff, arrived_school). Replace the 2 km deviation alert with stop-radius logic (100–500 m) + a real route-corridor check using our GPSLog.
4. **Driver is a GPS source too.** Add a minimal driver flow (to `flutter_user` or a transport tab): start/stop instance, stream positions (throttle ≥3 s, `wakelock_plus` during trip), scan-boarding reusing dismissal scanner components, "students to pick up" manifest. Two ingest paths (ESP32 and driver phone) into the same `process_gps_data` make the hardware optional, not exclusive — and add what SBT lacks: an offline queue (store-and-forward fixes) for patchy Nepal connectivity.
5. **Push on mobile, poll as fallback.** Mobile should subscribe to Socket.IO `gps_update` rooms (we already have `lib/socket.ts` on web); keep the 15 s poll only as reconnect fallback, and render "last updated Ns ago" + a stale-data banner like SBT's red tracking banner.
6. **Fold the orphaned pages.** Merge `pickup-points` into `stops` (it is a duplicate CRUD); make `allocation` the student→stop(+direction) assignment screen backed by a real `PUT /transport/stops/{id}/assign-students` with capacity checks, morning/afternoon columns, and per-student stop times; surface both under the gps_tracking plugin nav with entitlement checks.
7. **Fees linkage via the `fees` plugin, not coins.** Do not rebuild SBT's coins wallet; add a transport fee item + `transport_opt_in` on the student, and gate trip allocation on fee status from `app/plugins/modules/fees`. Their per-ride metering is a business model choice, not a feature requirement — but their *balance gate before seat assignment* pattern is worth mirroring with fee-status.
8. **Copy these UX details outright:** call-driver button on the tracker; trip-not-started/ended empty states; green/grey stop timeline with planned times; drag-drop stop ordering for ad-hoc routes; audio coaching banners for drivers; end-trip-blocked-while-students-aboard guard; driver document review workflow; student QR ticket; per-school off-day calendar honored by schedulers.
9. **Then differentiate:** real ETA (haversine along remaining stops or OSRM routing), GPS replay from `gps_logs`, genuine speed alerts (fulfilling our manifest's `transport.speed_alert`), route-deviation corridor alerts to parents AND admins, BS-date-aware suspension calendar, eSewa/Khalti transport fee collection, private per-trip socket rooms with JWT-scoped joins (SBT's channels are public).
10. **Sequencing:** (a) trip instances + ride_status + notifications = parity on the safety core; (b) driver flow + assignment API = parity on operations; (c) ETA + history replay + Nepal payments = clear lead. Items (a) alone close ~60% of the gap identified in 6.1.

**Verdict:** SchoolBusTrack v2.3 is 2–3 product cycles ahead of ASchool on the transport lifecycle (schedule → reserve → track → board → alert → report) and behind us on telemetry, tenancy, hardware ingest, and Nepal localization. The fastest path to parity is the trip-instance + ride_status + per-student notification trio; the fastest path to superiority is real ETA + history replay on top of the GPSLog history they don't have.

---

## Appendix A — Weaknesses observed in the competitor (do not copy)

- **Public broadcast channels:** `TripPositionUpdated` broadcasts on `new Channel($channelId)` (`app/Events/TripPositionUpdated.php`) with no authorization in `routes/channels.php` — any socket client that learns a channel name sees raw bus positions. Our per-school rooms should become private/JWT-scoped per-trip rooms.
- **Unauthenticated test endpoints shipped:** `POST /api/planned-trips/test-set-last-position` and `POST /api/test/test-send-student-notification` have no auth middleware (`routes/api.php`) — an attacker can spoof bus positions or spam notifications.
- **Global geofence settings:** one `settings` row for all schools; no per-school radii (`front-end/src/views/settings/index.vue`).
- **Random polyline colors:** `track_school_bus_screen.dart` line 123 and `running_trip_screen.dart` line 316 color the route with `Random()` per build — inconsistent UX.
- **No GPS retention** (by design): tracking evidence evaporates when the trip ends; parents cannot dispute events afterward.
- **Battery-hostile driver flow:** screen-on wakelock for entire trips, no background service; positions silently lost when the app loses focus (`dispose` cancels the stream).
- **Commented-out legacy engines:** ~700 lines of dead `startStopDriverTrip*` variants in `TripController.php` (lines 925–1594) — the file carries three generations of the same feature; keep our implementations single-path.
- **No authorized-pickup verification at drop-off:** bulk drop-off marks all onboard students dropped with no identity confirmation — our dismissal plugin concept is the fix.
