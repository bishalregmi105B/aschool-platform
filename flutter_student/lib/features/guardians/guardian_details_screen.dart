import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class GuardianDetailsScreen extends ConsumerStatefulWidget {
  const GuardianDetailsScreen({super.key});

  @override
  ConsumerState<GuardianDetailsScreen> createState() =>
      _GuardianDetailsScreenState();
}

class _GuardianDetailsScreenState extends ConsumerState<GuardianDetailsScreen> {
  List<Map<String, dynamic>> _guardians = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final meRes = await ApiClient.instance.get('/auth/me');
      final me =
          (meRes.data is Map<String, dynamic>) ? meRes.data['data'] : null;
      final userId = (me is Map<String, dynamic>) ? me['id'] : null;
      if (userId == null) {
        _guardians = [];
      } else {
        final studentRes = await ApiClient.instance.get('/students',
            queryParameters: {'user_id': userId, 'per_page': 1});
        final students = (studentRes.data is Map<String, dynamic>)
            ? studentRes.data['data']
            : null;
        if (students is List && students.isNotEmpty) {
          final sid = safeMap(students.first)['id'];
          final gRes = await ApiClient.instance.get('/students/$sid/guardians');
          final gData =
              (gRes.data is Map<String, dynamic>) ? gRes.data['data'] : null;
          _guardians = (gData is List)
              ? gData
                  .whereType<Map>()
                  .map((e) => Map<String, dynamic>.from(e))
                  .toList()
              : [];
        }
      }
    } catch (e, st) {
      debugPrint('GuardianDetailsScreen load failed: $e\n$st');
      _guardians = [];
      _error = 'Could not load guardian details.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Guardian Details'),
      body: _loading
          ? const LoadingShimmer()
          : _error != null
              ? ErrorContainer(errorMessage: _error!, onRetry: _load)
              : RefreshIndicator(
              onRefresh: _load,
              child: _guardians.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        NoDataContainer(
                          title: 'No guardian details found',
                          subtitle: 'Guardian records will appear once linked.',
                          icon: Icons.family_restroom_outlined,
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _guardians.length,
                      itemBuilder: (_, i) {
                        final g = _guardians[i];
                        final relation = g['relation']?.toString() ?? '-';
                        final phone = g['phone']?.toString() ?? '';
                        return ESchoolAnimatedEntry(
                          index: i,
                          child: ESchoolCard(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading:
                                  const Icon(Icons.family_restroom_outlined),
                              title: Text(
                                  g['full_name']?.toString() ?? 'Guardian'),
                              subtitle: Text('$relation  $phone'),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
