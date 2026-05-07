import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class AssignmentsScreen extends StatelessWidget {
  const AssignmentsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return const ModuleScreenTemplate(
      title: 'Assignments',
      subtitle:
          'Plan, publish, and track assignments with operational clarity.',
      heroIcon: Icons.assignment_outlined,
      accentColor: Color(0xFF0EA5E9),
      insights: [
        ModuleInsightItem(
            label: 'Open Tasks',
            value: '24',
            icon: Icons.pending_actions_outlined),
        ModuleInsightItem(
            label: 'Due Today', value: '6', icon: Icons.today_outlined),
      ],
      actions: [
        ModuleActionItem(
            label: 'Create Assignment', icon: Icons.add_task_outlined),
        ModuleActionItem(label: 'Bulk Publish', icon: Icons.send_outlined),
      ],
      highlights: [
        'Draft assignment templates by class and subject',
        'Set due dates and grading rules centrally',
        'Monitor submission status in one dashboard',
      ],
    );
  }
}
