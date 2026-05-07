import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

class BusTrackingScreen extends ConsumerStatefulWidget {
  const BusTrackingScreen({super.key});

  @override
  ConsumerState<BusTrackingScreen> createState() => _BusTrackingScreenState();
}

class _BusTrackingScreenState extends ConsumerState<BusTrackingScreen> {
  final MapController _mapCtrl = MapController();
  Map<String, dynamic>? _busData;
  LatLng? _busLocation;
  LatLng? _schoolLocation;
  LatLng? _stopLocation;
  bool _loading = true;
  Timer? _refreshTimer;
  String? _activeStudentId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load(ref.read(selectedChildIdForApiProvider));
    });
    _refreshTimer =
        Timer.periodic(const Duration(seconds: 15), (_) => _loadLocation());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _mapCtrl.dispose();
    super.dispose();
  }

  Future<void> _load(String? studentId) async {
    setState(() {
      _loading = true;
      _activeStudentId = studentId;
    });
    try {
      final resp = await ApiClient.instance.get(
        '/parent/bus-info',
        queryParameters: parentStudentQuery(studentId),
      );
      final data = resp.data['data'] as Map<String, dynamic>?;
      if (!mounted) return;
      setState(() {
        _busData = data;
        _busLocation = null;
        _schoolLocation = _parseLatLng(data?['school_location']);
        _stopLocation = _parseLatLng(data?['stop_location']);
        _loading = false;
      });
      await _loadLocation();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadLocation() async {
    if (_busData == null) return;
    try {
      final resp = await ApiClient.instance
          .get('/parent/bus-location/${_busData!['bus_id']}');
      final loc = resp.data['data'];
      if (loc != null) {
        final lat = (loc['lat'] as num?)?.toDouble();
        final lng = (loc['lng'] as num?)?.toDouble();
        if (!mounted) return;
        setState(() {
          _busLocation = lat != null && lng != null ? LatLng(lat, lng) : null;
          _busData!['speed'] = loc['speed'];
          _busData!['eta_minutes'] = loc['eta_minutes'];
          _busData!['last_updated'] = loc['last_updated'];
          _busData!['status_text'] = loc['status_text'];
          _busData!['boarded'] = loc['boarded'];
        });
      }
    } catch (_) {}
  }

  LatLng? _parseLatLng(Map<String, dynamic>? obj) {
    if (obj == null) return null;
    final lat = (obj['lat'] as num?)?.toDouble();
    final lng = (obj['lng'] as num?)?.toDouble();
    if (lat == null || lng == null) return null;
    return LatLng(lat, lng);
  }

  @override
  Widget build(BuildContext context) {
    final selectedChildId = ref.watch(selectedChildIdForApiProvider);
    if (_activeStudentId != selectedChildId && !_loading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load(selectedChildId);
      });
    }

    if (_loading) return const LoadingShimmer();

    if (_busData == null) {
      return const PluginGate(
        pluginSlug: 'bus_tracking',
        child: Center(child: Text('Bus tracking not available')),
      );
    }

    return PluginGate(
      pluginSlug: 'bus_tracking',
      child: Column(
        children: [
          const SizedBox(height: 14),
          Expanded(
            flex: 6,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: FlutterMap(
                  mapController: _mapCtrl,
                  options: MapOptions(
                    initialCenter: _busLocation ??
                        _schoolLocation ??
                        const LatLng(27.7172, 85.3240),
                    initialZoom: 14,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'np.edu.aschool.parent',
                    ),
                    MarkerLayer(
                      markers: [
                        if (_schoolLocation != null)
                          Marker(
                            point: _schoolLocation!,
                            width: 40,
                            height: 40,
                            child: const Icon(Icons.school,
                                color: ASchoolTheme.primary, size: 32),
                          ),
                        if (_stopLocation != null)
                          Marker(
                            point: _stopLocation!,
                            width: 40,
                            height: 40,
                            child: const Icon(Icons.home,
                                color: ASchoolTheme.secondary, size: 28),
                          ),
                        if (_busLocation != null)
                          Marker(
                            point: _busLocation!,
                            width: 48,
                            height: 48,
                            child: Container(
                              decoration: BoxDecoration(
                                color: ASchoolTheme.warning,
                                borderRadius: BorderRadius.circular(24),
                                boxShadow: [
                                  BoxShadow(
                                    color: ASchoolTheme.warning.withAlpha(80),
                                    blurRadius: 10,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                              child: const Icon(Icons.directions_bus,
                                  color: Colors.white, size: 28),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            flex: 4,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: ListView(
                children: [
                  ESchoolSectionTitle(
                    title: 'Bus No. ${_busData?['bus_number'] ?? ''}',
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Driver: ${_busData?['driver_name'] ?? ''} • ${_busData?['driver_phone'] ?? ''}',
                    style: const TextStyle(
                      color: ASchoolTheme.mutedText,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ESchoolCard(
                    child: Column(
                      children: [
                        Row(children: [
                          const Icon(Icons.directions_bus,
                              color: ASchoolTheme.warning),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _busData?['status_text'] ??
                                  'Waiting for update...',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                        ]),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 10,
                          runSpacing: 8,
                          children: [
                            _infoPill(Icons.timer,
                                'ETA: ${_busData?['eta_minutes'] ?? '-'} min'),
                            _infoPill(
                                Icons.speed, '${_busData?['speed'] ?? 0} km/h'),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (_busData?['boarded'] != null) ...[
                    const SizedBox(height: 8),
                    ESchoolCard(
                      color: ASchoolTheme.success.withAlpha(10),
                      child: Row(children: [
                        const Icon(Icons.check_circle,
                            color: ASchoolTheme.success),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _busData!['boarded'],
                            style: const TextStyle(
                              color: ASchoolTheme.success,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ]),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Text(
                    'Last updated: ${_busData?['last_updated'] ?? 'N/A'}',
                    style: const TextStyle(
                        fontSize: 11, color: ASchoolTheme.mutedText),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoPill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.withAlpha(40)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.grey[600]),
          const SizedBox(width: 4),
          Text(text, style: const TextStyle(fontSize: 13)),
        ],
      ),
    );
  }
}
