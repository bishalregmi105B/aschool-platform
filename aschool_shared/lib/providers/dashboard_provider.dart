import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'repository_providers.dart';

class DashboardData {
  final Map<String, dynamic> rawData;
  final List<Announcement> latestAnnouncements;
  final List<SliderBanner> banners;
  final AttendanceSummary? attendance;
  final List<TimetableSlot> todaySchedule;

  const DashboardData({
    required this.rawData,
    this.latestAnnouncements = const [],
    this.banners = const [],
    this.attendance,
    this.todaySchedule = const [],
  });
}

class DashboardNotifier extends AsyncNotifier<DashboardData> {
  @override
  Future<DashboardData> build() async {
    return _fetchDashboard();
  }

  Future<DashboardData> _fetchDashboard() async {
    final studentRepo = ref.read(studentRepositoryProvider);
    final noticeRepo = ref.read(noticeRepositoryProvider);
    // Ideally, the dashboard API returns a composite object.
    // Assuming backend returns a combined map for now.
    
    final data = await studentRepo.getDashboard();
    
    // We can parse sub-models here if backend includes them
    List<SliderBanner> banners = [];
    try {
      banners = await noticeRepo.getBanners();
    } catch (_) {
      // ignore
    }

    return DashboardData(
      rawData: data,
      banners: banners,
      // Parse other models from the dashboard response if available
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchDashboard());
  }
}

final dashboardProvider = AsyncNotifierProvider<DashboardNotifier, DashboardData>(() {
  return DashboardNotifier();
});
