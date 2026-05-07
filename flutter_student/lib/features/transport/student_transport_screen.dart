import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class StudentTransportScreen extends ConsumerStatefulWidget {
  const StudentTransportScreen({super.key});

  @override
  ConsumerState<StudentTransportScreen> createState() =>
      _StudentTransportScreenState();
}

class _StudentTransportScreenState
    extends ConsumerState<StudentTransportScreen> {
  List<Map<String, dynamic>> _routes = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await ApiClient.instance
          .get('/transport/routes', queryParameters: {'per_page': 100});
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _routes = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (_) {
      _routes = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Transport'),
      body: _loading
          ? const LoadingShimmer()
          : RefreshIndicator(
              onRefresh: _load,
              child: _routes.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        NoDataContainer(
                          title: 'No transport routes found',
                          subtitle:
                              'Assigned bus route details will appear here.',
                          icon: Icons.directions_bus_outlined,
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _routes.length,
                      itemBuilder: (_, i) {
                        final route = _routes[i];
                        return ESchoolAnimatedEntry(
                          index: i,
                          child: ESchoolCard(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading:
                                  const Icon(Icons.directions_bus_outlined),
                              title: Text(route['name']?.toString() ?? 'Route'),
                              subtitle:
                                  Text(route['description']?.toString() ?? ''),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
