import 'package:flutter/material.dart';
import '../services/dashboard_data.dart';
import '../theme/app_theme.dart';
import '../widgets/kpi_grid.dart';
import '../widgets/section_card.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final data = DashboardData.mock();

    return Scaffold(
      drawer: const _AppDrawer(),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.text,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Xin chào, Admin! 👋',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            Text(
              'Chúc bạn một ngày làm việc hiệu quả',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.muted,
                  ),
            ),
          ],
        ),
        actions: [
          Stack(
            children: [
              IconButton(
                onPressed: () {},
                icon: const Icon(Icons.notifications_outlined),
              ),
              Positioned(
                right: 8,
                top: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Text(
                    '8',
                    style: TextStyle(color: Colors.white, fontSize: 10),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          KpiGrid(items: data.kpis),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Tình hình chấm công hôm nay',
            child: Column(
              children: data.attendance
                  .map(
                    (e) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor: AppTheme.primary.withValues(alpha: 0.12),
                        child: Text(e.name.characters.first),
                      ),
                      title: Text(e.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${e.role} · ${e.checkIn}'),
                      trailing: _StatusChip(status: e.status, keyType: e.key),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: const LinearGradient(
                colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Dự kiến lương tháng 08/2024',
                  style: TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 8),
                Text(
                  data.salaryTotal,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '↑ ${data.salaryGrowth}% so với tháng trước',
                  style: const TextStyle(color: Color(0xFFA7F3D0)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Hiệu suất nhân sự',
            child: Row(
              children: [
                SizedBox(
                  width: 100,
                  height: 100,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      CircularProgressIndicator(
                        value: data.performance / 100,
                        strokeWidth: 10,
                        backgroundColor: const Color(0xFFEEF2FF),
                        color: AppTheme.primary,
                      ),
                      Text(
                        '${data.performance}%',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  child: Text(
                    'Đúng giờ 85% · Hoàn thành ca 92% · Làm thêm 65%',
                    style: TextStyle(color: AppTheme.muted, height: 1.5),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Ca làm sắp tới',
            child: Column(
              children: data.shifts
                  .map(
                    (s) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FF),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(s.date, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                            Text(s.month, style: const TextStyle(fontSize: 10, color: AppTheme.primary)),
                          ],
                        ),
                      ),
                      title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${s.count} nhân viên'),
                      trailing: Text(s.time, style: const TextStyle(fontSize: 12, color: AppTheme.muted)),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Thông báo',
            child: Column(
              children: data.notifications
                  .map(
                    (n) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(
                        backgroundColor: Color(0xFFFEF3C7),
                        child: Icon(Icons.warning_amber_rounded, color: Color(0xFFF59E0B), size: 18),
                      ),
                      title: Text(n.title, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
                      subtitle: Text(n.time),
                    ),
                  )
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status, required this.keyType});

  final String status;
  final StatusKey keyType;

  @override
  Widget build(BuildContext context) {
    final colors = switch (keyType) {
      StatusKey.onTime => (const Color(0xFFECFDF5), const Color(0xFF059669)),
      StatusKey.late => (const Color(0xFFFFF1F2), const Color(0xFFE11D48)),
      StatusKey.pending => (const Color(0xFFFFFBEB), const Color(0xFFD97706)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status,
        style: TextStyle(color: colors.$2, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _AppDrawer extends StatelessWidget {
  const _AppDrawer();

  @override
  Widget build(BuildContext context) {
    final items = [
      'Tổng quan',
      'Nhân viên',
      'Ca làm',
      'Chấm công',
      'Lịch làm việc',
      'Bảng công',
      'Lương',
      'Thưởng / Phạt',
      'Nghỉ phép',
    ];
    return Drawer(
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF7C3AED)],
                    ),
                  ),
                  child: const Icon(Icons.work_outline, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 10),
                const Text(
                  'HRM Pro',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Text(
              'QUẢN LÝ NHÂN SỰ',
              style: TextStyle(fontSize: 11, color: AppTheme.muted, fontWeight: FontWeight.w600),
            ),
            ...items.map(
              (e) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(e),
                selected: e == 'Tổng quan',
                selectedColor: Colors.white,
                selectedTileColor: AppTheme.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                onTap: () => Navigator.pop(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
