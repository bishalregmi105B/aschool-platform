import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class TransportScreen extends StatefulWidget {
  const TransportScreen({super.key});

  @override
  State<TransportScreen> createState() => _TransportScreenState();
}

class _TransportScreenState extends State<TransportScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  List<Map<String, dynamic>> _routes = [];
  List<Map<String, dynamic>> _buses = [];
  List<Map<String, dynamic>> _gpsLogs = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this)
      ..addListener(() {
        if (!_tabController.indexIsChanging) setState(() {});
      });
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ApiClient.instance
            .get('/transport/routes', queryParameters: {'per_page': 100}),
        ApiClient.instance
            .get('/transport/buses', queryParameters: {'per_page': 100}),
        ApiClient.instance
            .get('/transport/gps-logs', queryParameters: {'per_page': 50}),
      ]);
      _routes = _extractRows(results[0].data);
      _buses = _extractRows(results[1].data);
      _gpsLogs = _extractRows(results[2].data);
    } catch (e, st) {
      debugPrint('TransportScreen load failed: $e\n$st');
      _routes = [];
      _buses = [];
      _gpsLogs = [];
      _error = 'Could not load transport data.';
    }
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> _extractRows(dynamic responseData) {
    final data =
        responseData is Map<String, dynamic> ? responseData['data'] : null;
    return data is List
        ? data
            .whereType<Map>()
            .map((row) => Map<String, dynamic>.from(row))
            .toList()
        : [];
  }

  @override
  Widget build(BuildContext context) {
    final action = _tabController.index == 0
        ? _showAddRouteDialog
        : _tabController.index == 1
            ? _showAddBusDialog
            : null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Transport'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: action,
            tooltip: _tabController.index == 0
                ? 'Add route'
                : _tabController.index == 1
                    ? 'Add bus'
                    : 'GPS logs are ingested from devices',
          ),
        ],
      ),
      body: Column(
        children: [
          TabBar(controller: _tabController, tabs: const [
            Tab(text: 'Routes'),
            Tab(text: 'Vehicles'),
            Tab(text: 'Live GPS'),
          ]),
          Expanded(
            child: _loading
                ? const LoadingShimmer()
                : _error != null
                    ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                    : TabBarView(controller: _tabController, children: [
                        _RoutesList(routes: _routes, onRefresh: _load),
                        _VehiclesList(buses: _buses, onRefresh: _load),
                        _LiveGPSView(logs: _gpsLogs, onRefresh: _load),
                      ]),
          ),
        ],
      ),
    );
  }

  Future<void> _showAddRouteDialog() async {
    final nameCtrl = TextEditingController();
    final descriptionCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Route'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Route name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: descriptionCtrl,
              decoration: const InputDecoration(labelText: 'Description'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              await ApiClient.instance.post('/transport/routes', data: {
                'name': name,
                'description': descriptionCtrl.text.trim(),
                'is_active': true,
              });
              if (!context.mounted) return;
              Navigator.pop(context);
              await _load();
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    nameCtrl.dispose();
    descriptionCtrl.dispose();
  }

  Future<void> _showAddBusDialog() async {
    final vehicleCtrl = TextEditingController();
    final capacityCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Bus'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: vehicleCtrl,
              decoration: const InputDecoration(labelText: 'Vehicle number'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: capacityCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Capacity'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final vehicleNumber = vehicleCtrl.text.trim();
              if (vehicleNumber.isEmpty) return;
              await ApiClient.instance.post('/transport/buses', data: {
                'vehicle_number': vehicleNumber,
                'capacity': int.tryParse(capacityCtrl.text.trim()),
                'is_active': true,
              });
              if (!context.mounted) return;
              Navigator.pop(context);
              await _load();
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    vehicleCtrl.dispose();
    capacityCtrl.dispose();
  }
}

class _RoutesList extends StatelessWidget {
  final List<Map<String, dynamic>> routes;
  final Future<void> Function() onRefresh;

  const _RoutesList({required this.routes, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: routes.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                Center(child: Text('No transport routes configured.')),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: routes.length,
              itemBuilder: (context, index) {
                final route = routes[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.blue.shade50,
                      child: Icon(Icons.route, color: Colors.blue.shade700),
                    ),
                    title: Text(route['name']?.toString() ?? 'Route'),
                    subtitle: Text(route['description']?.toString() ??
                        '${route['distance_km'] ?? '-'} km'),
                    trailing: Icon(route['is_active'] == false
                        ? Icons.pause_circle_outline
                        : Icons.check_circle_outline),
                  ),
                );
              },
            ),
    );
  }
}

class _VehiclesList extends StatelessWidget {
  final List<Map<String, dynamic>> buses;
  final Future<void> Function() onRefresh;

  const _VehiclesList({required this.buses, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: buses.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                Center(child: Text('No buses configured.')),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: buses.length,
              itemBuilder: (context, index) {
                final bus = buses[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const Icon(Icons.directions_bus,
                        color: Colors.orange, size: 32),
                    title: Text(bus['vehicle_number']?.toString() ?? 'Bus'),
                    subtitle: Text(
                        'Capacity: ${bus['capacity'] ?? '-'} • GPS: ${bus['gps_device_id'] ?? '-'}'),
                    trailing: Chip(
                      label: Text(
                          bus['is_active'] == false ? 'Inactive' : 'Active'),
                      backgroundColor: bus['is_active'] == false
                          ? Colors.grey.shade100
                          : Colors.green.shade50,
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class _LiveGPSView extends StatelessWidget {
  final List<Map<String, dynamic>> logs;
  final Future<void> Function() onRefresh;

  const _LiveGPSView({required this.logs, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: logs.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                Center(child: Text('No GPS logs received yet.')),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: logs.length,
              itemBuilder: (context, index) {
                final log = logs[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const Icon(Icons.my_location),
                    title: Text(
                        '${log['latitude'] ?? '-'}, ${log['longitude'] ?? '-'}'),
                    subtitle: Text(
                        'Bus: ${log['bus_id'] ?? '-'} • Speed: ${log['speed_kmh'] ?? '-'} km/h'),
                    trailing: Text(log['timestamp']?.toString() ?? ''),
                  ),
                );
              },
            ),
    );
  }
}
