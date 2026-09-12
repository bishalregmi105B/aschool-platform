import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

/// Per-student transport notification settings (S-A4 / A-11): the 7 ride
/// toggles plus pickup/drop-off geofence radii (50–2000 m), PUT per student.
class TransportNotificationSettingsScreen extends ConsumerStatefulWidget {
  const TransportNotificationSettingsScreen({super.key});

  @override
  ConsumerState<TransportNotificationSettingsScreen> createState() =>
      _TransportNotificationSettingsScreenState();
}

/// Editable copy of one student's prefs: `current` mutates as the parent
/// flips switches; `saved` remembers what the server last accepted so the
/// card can show an "Unsaved" marker.
class _PrefDraft {
  final String studentId;
  final String studentName;
  TransportNotificationPref saved;
  TransportNotificationPref current;

  _PrefDraft({
    required this.studentId,
    required this.studentName,
    required this.saved,
  }) : current = saved;

  bool get isDirty => !_same(saved, current);

  static bool _same(TransportNotificationPref a, TransportNotificationPref b) {
    return a.nearPickupRadiusM == b.nearPickupRadiusM &&
        a.nearDropoffRadiusM == b.nearDropoffRadiusM &&
        a.notifyNextStopPickup == b.notifyNextStopPickup &&
        a.notifyNearPickup == b.notifyNearPickup &&
        a.notifyArrivedPickup == b.notifyArrivedPickup &&
        a.notifyPickedUp == b.notifyPickedUp &&
        a.notifyMissedPickup == b.notifyMissedPickup &&
        a.notifyNearDropoff == b.notifyNearDropoff &&
        a.notifyArrivedDropoff == b.notifyArrivedDropoff;
  }
}

class _TransportNotificationSettingsScreenState
    extends ConsumerState<TransportNotificationSettingsScreen> {
  Map<String, _PrefDraft>? _drafts;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    final prefsAsync = ref.watch(transportPrefsProvider);
    final dashboardAsync = ref.watch(parentDashboardProvider);

    return PluginGate(
      pluginSlug: 'gps_tracking',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Transport Alerts'),
        body: prefsAsync.when(
          loading: () => const LoadingShimmer(),
          error: (e, _) => ErrorContainer(
            errorMessage: e.toString(),
            onRetry: () => ref.invalidate(transportPrefsProvider),
          ),
          data: (bundle) {
            final children = dashboardAsync.valueOrNull?.children ??
                const <Map<String, dynamic>>[];
            _ensureDrafts(bundle, children);
            final drafts = _drafts;
            if (drafts == null || drafts.isEmpty) {
              return const NoDataContainer(
                title: 'No children linked',
                subtitle:
                    'Transport alerts are configured per child, and no children were found on your account.',
              );
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Choose which bus alerts you receive for each child and how far from the stop counts as “near”.',
                  style:
                      TextStyle(fontSize: 13, color: ASchoolTheme.mutedText),
                ),
                const SizedBox(height: 12),
                for (final draft in drafts.values)
                  _StudentPrefsCard(
                    draft: draft,
                    saving: _saving,
                    onEdited: () => setState(() {}),
                    onSave: () => _saveDraft(draft),
                  ),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
    );
  }

  /// Seed one editable draft per child: server row when present, defaults
  /// otherwise (the backend treats missing rows as defaults).
  void _ensureDrafts(
    TransportPrefsBundle bundle,
    List<Map<String, dynamic>> children,
  ) {
    if (children.isEmpty) {
      _drafts ??= {};
      return;
    }
    if (_drafts != null && _drafts!.length == children.length) return;

    final byStudent = {for (final p in bundle.prefs) p.studentId: p};
    _drafts = {
      for (final child in children)
        _childId(child): _PrefDraft(
          studentId: _childId(child),
          studentName: _childName(child),
          saved: byStudent[_childId(child)] ??
              TransportNotificationPref(
                studentId: _childId(child),
                nearPickupRadiusM: bundle.defaultPickupRadiusM,
                nearDropoffRadiusM: bundle.defaultDropoffRadiusM,
              ),
        ),
    };
  }

  Future<void> _saveDraft(_PrefDraft draft) async {
    setState(() => _saving = true);
    try {
      await ref
          .read(transportRepositoryProvider)
          .updateNotificationPrefs(draft.current);
      draft.saved = draft.current;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Alerts updated for ${draft.studentName}'),
          backgroundColor: ASchoolTheme.success,
        ),
      );
      ref.invalidate(transportPrefsProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(e.toString()), backgroundColor: ASchoolTheme.danger),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _childId(Map<String, dynamic> child) =>
      (child['student_id'] ?? child['id']).toString();

  String _childName(Map<String, dynamic> child) {
    final name = child['name']?.toString();
    if (name != null && name.isNotEmpty) return name;
    return 'Child';
  }
}

class _StudentPrefsCard extends StatelessWidget {
  final _PrefDraft draft;
  final bool saving;
  final VoidCallback onEdited;
  final Future<void> Function() onSave;

  const _StudentPrefsCard({
    required this.draft,
    required this.saving,
    required this.onEdited,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    final pref = draft.current;
    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.child_care_rounded,
                  size: 20, color: ASchoolTheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  draft.studentName,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 15),
                ),
              ),
              if (draft.isDirty)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: ASchoolTheme.warning.withAlpha(24),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    'Unsaved',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: ASchoolTheme.warning),
                  ),
                ),
            ],
          ),
          const Divider(height: 20),
          _toggle(
            title: 'Notify when bus is one stop away',
            subtitle: 'Next-stop heads-up for pickup',
            value: pref.notifyNextStopPickup,
            onValueChanged: (v) => draft.current =
                draft.current.copyWith(notifyNextStopPickup: v),
          ),
          _toggle(
            title: 'Approaching pickup stop',
            subtitle: 'Bus enters the pickup radius',
            value: pref.notifyNearPickup,
            onValueChanged: (v) =>
                draft.current = draft.current.copyWith(notifyNearPickup: v),
          ),
          _toggle(
            title: 'Bus arrived at pickup stop',
            value: pref.notifyArrivedPickup,
            onValueChanged: (v) => draft.current =
                draft.current.copyWith(notifyArrivedPickup: v),
          ),
          _toggle(
            title: 'Child picked up',
            subtitle: 'Boarded confirmation',
            value: pref.notifyPickedUp,
            onValueChanged: (v) =>
                draft.current = draft.current.copyWith(notifyPickedUp: v),
          ),
          _toggle(
            title: 'Child missed the bus',
            subtitle: 'Marked missed at pickup',
            value: pref.notifyMissedPickup,
            onValueChanged: (v) => draft.current =
                draft.current.copyWith(notifyMissedPickup: v),
          ),
          _toggle(
            title: 'Approaching drop-off stop',
            subtitle: 'Bus enters the drop-off radius',
            value: pref.notifyNearDropoff,
            onValueChanged: (v) =>
                draft.current = draft.current.copyWith(notifyNearDropoff: v),
          ),
          _toggle(
            title: 'Bus arrived at drop-off stop',
            value: pref.notifyArrivedDropoff,
            onValueChanged: (v) => draft.current =
                draft.current.copyWith(notifyArrivedDropoff: v),
          ),
          const Divider(height: 20),
          _radiusSlider(
            context: context,
            label: 'Near pickup radius',
            value: pref.nearPickupRadiusM,
            onValueChanged: (v) => draft.current =
                draft.current.copyWith(nearPickupRadiusM: v),
          ),
          _radiusSlider(
            context: context,
            label: 'Near drop-off radius',
            value: pref.nearDropoffRadiusM,
            onValueChanged: (v) =>
                draft.current = draft.current.copyWith(nearDropoffRadiusM: v),
          ),
          const SizedBox(height: 4),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: saving || !draft.isDirty ? null : () => onSave(),
              icon: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.save_outlined, size: 18),
              label: Text(saving ? 'Saving…' : 'Save alerts'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _toggle({
    required String title,
    String? subtitle,
    required bool value,
    required ValueChanged<bool> onValueChanged,
  }) {
    return SwitchListTile.adaptive(
      dense: true,
      contentPadding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
      activeThumbColor: ASchoolTheme.success,
      title: Text(title,
          style:
              const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
      subtitle: subtitle == null || subtitle.isEmpty
          ? null
          : Text(subtitle, style: const TextStyle(fontSize: 11.5)),
      value: value,
      onChanged: (v) {
        onValueChanged(v);
        onEdited();
      },
    );
  }

  Widget _radiusSlider({
    required BuildContext context,
    required String label,
    required int value,
    required ValueChanged<int> onValueChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w600)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: ASchoolTheme.primary.withAlpha(16),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '$value m',
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: ASchoolTheme.primary),
              ),
            ),
          ],
        ),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            activeTrackColor: ASchoolTheme.primary,
            thumbColor: ASchoolTheme.primary,
            overlayColor: ASchoolTheme.primary.withAlpha(30),
            inactiveTrackColor: Colors.grey.withAlpha(60),
          ),
          child: Slider(
            min: 50,
            max: 2000,
            divisions: 39, // 50 m steps across the 50–2000 m range
            value: value.clamp(50, 2000).toDouble(),
            label: '$value m',
            onChanged: (v) {
              onValueChanged(v.round());
              onEdited();
            },
          ),
        ),
      ],
    );
  }
}
