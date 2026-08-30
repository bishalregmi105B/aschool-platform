import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

class ChildWellbeingScreen extends ConsumerWidget {
  const ChildWellbeingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedChildId = ref.watch(selectedChildIdForApiProvider);
    final state = ref.watch(parentWellbeingProvider(selectedChildId));

    return PluginGate(
      pluginSlug: 'wellbeing',
      child: state.when(
        loading: () => const LoadingShimmer(),
        error: (err, _) => ErrorContainer(
          errorMessage: err.toString(),
          onRetry: () =>
              ref.invalidate(parentWellbeingProvider(selectedChildId)),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () =>
              ref.refresh(parentWellbeingProvider(selectedChildId).future),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _MoodOverview(data: data),
              const SizedBox(height: 16),
              _RecentMoods(data: data),
              const SizedBox(height: 16),
              _CounselorNotes(data: data),
            ],
          ),
        ),
      ),
    );
  }
}

class _MoodOverview extends StatelessWidget {
  final Map<String, dynamic> data;

  const _MoodOverview({required this.data});

  @override
  Widget build(BuildContext context) {
    final avg = safeDoubleOrNull(data['avg_mood']) ?? 3.0;
    return ESchoolCard(
      child: Column(
        children: [
          Text(
            'Overall Wellbeing',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              5,
              (i) => Icon(
                i < avg.round() ? Icons.star_rounded : Icons.star_border,
                color: ASchoolTheme.warning,
                size: 36,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${avg.toStringAsFixed(1)} / 5.0',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            'Based on ${data['mood_count'] ?? 0} entries',
            style: const TextStyle(fontSize: 12, color: ASchoolTheme.mutedText),
          ),
        ],
      ),
    );
  }
}

class _RecentMoods extends StatelessWidget {
  final Map<String, dynamic> data;

  const _RecentMoods({required this.data});

  @override
  Widget build(BuildContext context) {
    final moods = List<Map<String, dynamic>>.from(data['recent_moods'] ?? []);
    if (moods.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const ESchoolSectionTitle(title: 'Recent Mood Entries'),
        const SizedBox(height: 8),
        ...moods.asMap().entries.map((entry) {
          final moodRow = entry.value;
          final mood = moodRow['mood']?.toString() ?? 'neutral';
          return ESchoolAnimatedEntry(
            index: entry.key,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 8),
              padding: EdgeInsets.zero,
              child: ListTile(
                leading: Icon(
                  _moodIcon(mood),
                  color: _moodColor(mood),
                  size: 28,
                ),
                title: Text(mood.toUpperCase()),
                subtitle:
                    moodRow['note'] != null ? Text(moodRow['note']) : null,
                trailing: Text(
                  moodRow['date'] ?? '',
                  style: const TextStyle(
                      fontSize: 11, color: ASchoolTheme.mutedText),
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  IconData _moodIcon(String mood) {
    switch (mood.toLowerCase()) {
      case 'happy':
      case 'excited':
        return Icons.sentiment_very_satisfied_rounded;
      case 'sad':
      case 'anxious':
        return Icons.sentiment_dissatisfied_rounded;
      case 'angry':
        return Icons.sentiment_very_dissatisfied_rounded;
      default:
        return Icons.sentiment_neutral_rounded;
    }
  }

  Color _moodColor(String mood) {
    switch (mood.toLowerCase()) {
      case 'happy':
      case 'excited':
        return ASchoolTheme.success;
      case 'sad':
      case 'anxious':
        return ASchoolTheme.warning;
      case 'angry':
        return ASchoolTheme.danger;
      default:
        return ASchoolTheme.primary;
    }
  }
}

class _CounselorNotes extends StatelessWidget {
  final Map<String, dynamic> data;

  const _CounselorNotes({required this.data});

  @override
  Widget build(BuildContext context) {
    final notes =
        List<Map<String, dynamic>>.from(data['counselor_notes'] ?? []);
    if (notes.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const ESchoolSectionTitle(title: 'Counselor Notes'),
        const SizedBox(height: 8),
        ...notes.asMap().entries.map(
              (entry) => ESchoolAnimatedEntry(
                index: entry.key,
                child: ESchoolCard(
                  margin: const EdgeInsets.only(bottom: 8),
                  color: const Color(0xFFFFFBEB),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.psychology_rounded,
                              color: ASchoolTheme.primary, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            entry.value['counselor_name'] ?? '',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          const Spacer(),
                          Text(
                            entry.value['date'] ?? '',
                            style: const TextStyle(
                              fontSize: 11,
                              color: ASchoolTheme.mutedText,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(entry.value['note'] ?? ''),
                    ],
                  ),
                ),
              ),
            ),
      ],
    );
  }
}
