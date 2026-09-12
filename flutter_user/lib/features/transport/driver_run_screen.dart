import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Driver MVP screen 2 — run one trip instance (S-A4):
///  (a) Start the run,
///  (b) GPS streaming toggle (geolocator stream, ≥3 s throttle + in-flight
///      guard, wakelock while active — the server additionally throttles),
///  (c) stop timeline with Board / Missed per waiting student and Drop off
///      at each stop,
///  (d) End run (the 409 "students still onboard" message is surfaced).
class DriverRunScreen extends ConsumerStatefulWidget {
  final String instanceId;

  const DriverRunScreen({super.key, required this.instanceId});

  @override
  ConsumerState<DriverRunScreen> createState() => _DriverRunScreenState();
}

class _DriverRunScreenState extends ConsumerState<DriverRunScreen> {
  TripInstance? _instance;
  bool _loading = true;
  bool _busy = false; // one op at a time — simple, robust MVP
  String? _error;

  // GPS streaming state
  StreamSubscription<Position>? _positionSub;
  bool _gpsActive = false;
  DateTime? _lastPostAt;
  bool _postInFlight = false;
  String? _lastGpsNote;

  static const _minPostInterval = Duration(seconds: 3);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    if (_gpsActive) WakelockPlus.disable();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final instance = await ref
          .read(transportRepositoryProvider)
          .getInstance(widget.instanceId);
      if (!mounted) return;
      setState(() {
        _instance = instance;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _runOp(Future<void> Function() op) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await op();
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
      _showSnack(e.toString(), ASchoolTheme.danger);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showSnack(String message, Color color) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  // ── driver ops ──────────────────────────────────────────────────────────

  Future<void> _startRun() => _runOp(() async {
        final repo = ref.read(transportRepositoryProvider);
        final instance =
            await repo.startInstance(widget.instanceId);
        _instance = instance;
        _showSnack('Run started', ASchoolTheme.success);
      });

  Future<void> _endRun() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End this run?'),
        content: const Text(
            'The run will be marked completed. Students still onboard must be dropped off first.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
              style: FilledButton.styleFrom(backgroundColor: ASchoolTheme.danger),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('End run')),
        ],
      ),
    );
    if (confirmed != true) return;
    await _runOp(() async {
      final repo = ref.read(transportRepositoryProvider);
      final instance = await repo.endInstance(widget.instanceId);
      _instance = instance;
      if (_gpsActive) await _stopGps();
      _showSnack('Run completed', ASchoolTheme.success);
    });
  }

  Future<void> _board(TripPassenger p, {required bool missed}) =>
      _runOp(() async {
        final repo = ref.read(transportRepositoryProvider);
        await repo.pickupStudent(
          widget.instanceId,
          studentId: p.studentId,
          missed: missed,
        );
        _showSnack(
          missed
              ? '${_name(p)} marked missed'
              : '${_name(p)} boarded',
          missed ? ASchoolTheme.warning : ASchoolTheme.success,
        );
      });

  Future<void> _dropOff(InstanceStop stop) => _runOp(() async {
        final repo = ref.read(transportRepositoryProvider);
        await repo.dropOffAtStop(widget.instanceId, stopId: stop.stopId);
        _showSnack('Dropped off at ${stop.stopName ?? 'stop'}',
            ASchoolTheme.success);
      });

  // ── GPS streaming ───────────────────────────────────────────────────────

  Future<void> _toggleGps(bool enable) async {
    if (enable) {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _showSnack('Location services are off — enable GPS to share position',
            ASchoolTheme.warning);
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        _showSnack('Location permission is required to share the bus position',
            ASchoolTheme.warning);
        return;
      }
      setState(() {
        _gpsActive = true;
        _lastGpsNote = 'Waiting for first fix…';
      });
      // Keep the screen awake for the whole run streaming window.
      await WakelockPlus.enable();
      _positionSub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        ),
      ).listen(_onPosition, onError: (Object e) {
        setState(() => _lastGpsNote = 'GPS error: $e');
      });
    } else {
      await _stopGps();
    }
  }

  Future<void> _stopGps() async {
    await _positionSub?.cancel();
    _positionSub = null;
    await WakelockPlus.disable();
    if (mounted) {
      setState(() {
        _gpsActive = false;
        _lastGpsNote = null;
      });
    }
  }

  /// Throttled POST: at most one fix per 3 s and never two in flight.
  void _onPosition(Position pos) {
    final now = DateTime.now();
    if (_postInFlight) return;
    final last = _lastPostAt;
    if (last != null && now.difference(last) < _minPostInterval) return;
    _postInFlight = true;
    _lastPostAt = now;
    () async {
      try {
        final repo = ref.read(transportRepositoryProvider);
        await repo.postPosition(
          widget.instanceId,
          lat: pos.latitude,
          lng: pos.longitude,
          speedKmh: (pos.speed * 3.6).clamp(0, 300).toDouble(), // m/s → km/h
        );
        if (!mounted) return;
        setState(() {
          _lastGpsNote =
              'Fix sent ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')}'
              ' • ${pos.speed * 3.6 < 1 ? '0' : (pos.speed * 3.6).round()} km/h';
        });
      } catch (e) {
        if (!mounted) return;
        setState(() => _lastGpsNote = 'Position update failed — retrying on next fix');
      } finally {
        _postInFlight = false;
      }
    }();
  }

  // ── build ───────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        appBar: CustomAppBar(title: 'Run'),
        body: LoadingShimmer(),
      );
    }
    final instance = _instance;
    if (instance == null) {
      return Scaffold(
        appBar: const CustomAppBar(title: 'Run'),
        body: ErrorContainer(
          errorMessage: _error ?? 'Trip not found',
          onRetry: _load,
        ),
      );
    }

    final isAfternoon = instance.direction == 'afternoon';
    final canStart = instance.isScheduled;
    final isRunning = instance.isRunning;
    final isDone = instance.isCompleted || instance.status == 'cancelled';

    return Scaffold(
      appBar: CustomAppBar(title: isAfternoon ? 'Afternoon Run' : 'Morning Run'),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            _headerCard(instance),
            const SizedBox(height: 12),
            if (canStart)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _busy ? null : _startRun,
                  icon: const Icon(Icons.play_arrow_rounded),
                  label: const Text('Start run'),
                ),
              ),
            if (isRunning) ...[
              _gpsCard(),
              const SizedBox(height: 12),
              ..._stopSections(instance),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                      backgroundColor: ASchoolTheme.danger),
                  onPressed: _busy ? null : _endRun,
                  icon: const Icon(Icons.stop_rounded),
                  label: Text(instance.onboardCount > 0
                      ? 'End run (${instance.onboardCount} still onboard)'
                      : 'End run'),
                ),
              ),
            ],
            if (isDone) ...[
              const SizedBox(height: 4),
              ESchoolCard(
                color: ASchoolTheme.success.withAlpha(12),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle_rounded,
                        color: ASchoolTheme.success),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        instance.status == 'cancelled'
                            ? 'This run was cancelled by the school.'
                            : 'Run completed${instance.endedAt != null ? ' at ${_fmtHm(instance.endedAt)}' : ''}.',
                        style: const TextStyle(
                            color: ASchoolTheme.success,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(
                    fontSize: 12.5, color: ASchoolTheme.danger),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _headerCard(TripInstance instance) {
    final (statusLabel, statusColor) = switch (instance.status) {
      'running' => ('Running', ASchoolTheme.success),
      'completed' => ('Completed', ASchoolTheme.primary),
      'cancelled' => ('Cancelled', ASchoolTheme.danger),
      _ => ('Scheduled', ASchoolTheme.warning),
    };
    return ESchoolCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                instance.direction == 'afternoon'
                    ? Icons.wb_twilight_rounded
                    : Icons.wb_sunny_rounded,
                color: ASchoolTheme.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  instance.bus?.isNotEmpty == true
                      ? 'Bus ${instance.bus}'
                      : 'Run',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 16),
                ),
              ),
              Text(
                statusLabel,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: statusColor),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            [
              if (instance.dateBs?.isNotEmpty == true) instance.dateBs!,
              '${instance.visitedStopCount}/${instance.totalStopCount} stops visited',
              if (instance.startedAt != null)
                'Started ${_fmtHm(instance.startedAt)}',
            ].join('  •  '),
            style:
                const TextStyle(fontSize: 12.5, color: ASchoolTheme.mutedText),
          ),
        ],
      ),
    );
  }

  Widget _gpsCard() {
    return ESchoolCard(
      color: _gpsActive ? ASchoolTheme.success.withAlpha(12) : null,
      child: Column(
        children: [
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            activeThumbColor: ASchoolTheme.success,
            title: const Text('Share my location',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            subtitle: Text(
              _gpsActive
                  ? (_lastGpsNote ?? 'Streaming to the school…')
                  : 'Stream bus position while driving',
              style: const TextStyle(
                  fontSize: 11.5, color: ASchoolTheme.mutedText),
            ),
            secondary: Icon(
              Icons.gps_fixed_rounded,
              color: _gpsActive ? ASchoolTheme.success : Colors.grey,
            ),
            value: _gpsActive,
            onChanged: _busy ? null : (v) => _toggleGps(v),
          ),
        ],
      ),
    );
  }

  /// Stop timeline with per-stop boarding controls.
  List<Widget> _stopSections(TripInstance instance) {
    final widgets = <Widget>[];
    for (var i = 0; i < instance.stops.length; i++) {
      final stop = instance.stops[i];
      final waiting = instance.passengers
          .where((p) => p.startStopId == stop.stopId)
          .toList()
        ..sort((a, b) => a.rideStatus.compareTo(b.rideStatus));
      widgets.add(_StopCard(
        stop: stop,
        isLast: i == instance.stops.length - 1,
        passengers: waiting,
        onboardCount: instance.passengers
            .where((p) =>
                p.endStopId == stop.stopId &&
                p.rideStatus == TripPassenger.statusOnboard)
            .length,
        busy: _busy,
        onBoard: (p) => _board(p, missed: false),
        onMiss: (p) => _board(p, missed: true),
        onDropOff: () => _dropOff(stop),
      ));
    }
    return widgets;
  }
}

class _StopCard extends StatelessWidget {
  final InstanceStop stop;
  final bool isLast;
  final List<TripPassenger> passengers;
  final int onboardCount;
  final bool busy;
  final Future<void> Function(TripPassenger) onBoard;
  final Future<void> Function(TripPassenger) onMiss;
  final Future<void> Function() onDropOff;

  const _StopCard({
    required this.stop,
    required this.isLast,
    required this.passengers,
    required this.onboardCount,
    required this.busy,
    required this.onBoard,
    required this.onMiss,
    required this.onDropOff,
  });

  @override
  Widget build(BuildContext context) {
    final visited = stop.visited;
    final accent = visited ? ASchoolTheme.success : ASchoolTheme.mutedText;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 40,
            child: Column(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: visited ? ASchoolTheme.success : Colors.transparent,
                    shape: BoxShape.circle,
                    border: Border.all(color: accent, width: 2),
                  ),
                  child: Center(
                    child: visited
                        ? const Icon(Icons.check_rounded,
                            size: 16, color: Colors.white)
                        : Text(
                            '${stop.seq}',
                            style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: ASchoolTheme.mutedText),
                          ),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: visited
                          ? ASchoolTheme.success.withAlpha(120)
                          : Colors.grey.withAlpha(60),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16, top: 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          stop.stopName?.isNotEmpty == true
                              ? stop.stopName!
                              : 'Stop ${stop.seq}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14.5),
                        ),
                      ),
                      if (stop.plannedTs != null)
                        Text(
                          _fmtHm(stop.plannedTs),
                          style: const TextStyle(
                              fontSize: 11.5,
                              color: ASchoolTheme.mutedText),
                        ),
                    ],
                  ),
                  if (visited && stop.actualTs != null)
                    Text(
                      'Arrived ${_fmtHm(stop.actualTs)}',
                      style: const TextStyle(
                          fontSize: 11.5, color: ASchoolTheme.success),
                    ),
                  const SizedBox(height: 6),
                  ...passengers.map(_passengerRow),
                  if (onboardCount > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: ASchoolTheme.primary,
                          side: const BorderSide(color: ASchoolTheme.primary),
                          minimumSize: const Size(0, 36),
                        ),
                        onPressed: busy ? null : onDropOff,
                        icon: const Icon(Icons.output_rounded, size: 18),
                        label: Text('Drop off ($onboardCount)'),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _passengerRow(TripPassenger p) {
    final waiting = p.rideStatus == TripPassenger.statusWaiting;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(
            switch (p.rideStatus) {
              TripPassenger.statusOnboard => Icons.airline_seat_recline_normal_rounded,
              TripPassenger.statusMissed => Icons.person_off_rounded,
              TripPassenger.statusDropped => Icons.check_circle_rounded,
              _ => Icons.schedule_rounded,
            },
            size: 15,
            color: switch (p.rideStatus) {
              TripPassenger.statusOnboard => ASchoolTheme.primary,
              TripPassenger.statusMissed => ASchoolTheme.danger,
              TripPassenger.statusDropped => ASchoolTheme.success,
              _ => ASchoolTheme.warning,
            },
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              p.studentName?.isNotEmpty == true
                  ? p.studentName!
                  : 'Student ${p.studentId}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: waiting ? FontWeight.w600 : FontWeight.w400,
                color: waiting
                    ? ASchoolTheme.secondary
                    : ASchoolTheme.mutedText,
              ),
            ),
          ),
          if (waiting) ...[
            TextButton(
              style: TextButton.styleFrom(
                minimumSize: const Size(0, 32),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              onPressed: busy ? null : () => onBoard(p),
              child: const Text('Board',
                  style: TextStyle(
                      color: ASchoolTheme.success,
                      fontWeight: FontWeight.w700)),
            ),
            TextButton(
              style: TextButton.styleFrom(
                minimumSize: const Size(0, 32),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              onPressed: busy ? null : () => onMiss(p),
              child: const Text('Missed',
                  style: TextStyle(
                      color: ASchoolTheme.danger,
                      fontWeight: FontWeight.w700)),
            ),
          ] else
            Text(
              p.rideStatusLabel,
              style: const TextStyle(
                  fontSize: 11.5, color: ASchoolTheme.mutedText),
            ),
        ],
      ),
    );
  }
}

String _name(TripPassenger p) =>
    p.studentName?.isNotEmpty == true ? p.studentName! : 'Student';

String _fmtHm(DateTime? ts) {
  if (ts == null) return '—';
  final local = ts.isUtc ? ts.toLocal() : ts;
  return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}
