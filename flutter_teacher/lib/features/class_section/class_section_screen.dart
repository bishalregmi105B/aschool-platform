import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ClassSectionScreen extends ConsumerWidget {
  const ClassSectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const sections = [
      {
        'class': 'Grade 10',
        'section': 'A',
        'students': 38,
        'subjects': 4,
      },
      {
        'class': 'Grade 9',
        'section': 'B',
        'students': 34,
        'subjects': 3,
      },
      {
        'class': 'Grade 8',
        'section': 'C',
        'students': 31,
        'subjects': 2,
      },
    ];

    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const ESchoolCard(
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.class_rounded, color: ASchoolTheme.primary),
              title: Text(
                'My Class Sections',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                'Assigned classes, sections, and student counts.',
              ),
            ),
          ),
          const SizedBox(height: 12),
          for (int i = 0; i < sections.length; i++)
            ESchoolAnimatedEntry(
              index: i,
              child: ESchoolCard(
                margin: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${sections[i]['class']} • Section ${sections[i]['section']}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        ESchoolInfoPill(
                          icon: Icons.groups_2_rounded,
                          label: '${sections[i]['students']} Students',
                        ),
                        const SizedBox(width: 8),
                        ESchoolInfoPill(
                          icon: Icons.menu_book_rounded,
                          label: '${sections[i]['subjects']} Subjects',
                          color: ASchoolTheme.warning,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Class manager coming soon.')),
              );
            },
            icon: const Icon(Icons.edit_calendar_rounded),
            label: const Text('Manage Sections'),
          ),
        ],
      ),
    );
  }
}
