import 'package:flutter/material.dart';
import '../services/dashboard_data.dart';
import '../theme/app_theme.dart';

class KpiGrid extends StatelessWidget {
  const KpiGrid({super.key, required this.items});

  final List<KpiItem> items;

  Color _bg(ColorKey key) => switch (key) {
        ColorKey.blue => const Color(0xFFEEF2FF),
        ColorKey.green => const Color(0xFFECFDF5),
        ColorKey.orange => const Color(0xFFFFFBEB),
        ColorKey.red => const Color(0xFFFFF1F2),
        ColorKey.sky => const Color(0xFFF0F9FF),
      };

  Color _fg(ColorKey key) => switch (key) {
        ColorKey.blue => AppTheme.primary,
        ColorKey.green => const Color(0xFF10B981),
        ColorKey.orange => const Color(0xFFF59E0B),
        ColorKey.red => const Color(0xFFF43F5E),
        ColorKey.sky => const Color(0xFF0EA5E9),
      };

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: items.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.55,
      ),
      itemBuilder: (context, index) {
        final item = items[index];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      item.label,
                      style: const TextStyle(color: AppTheme.muted, fontSize: 12),
                    ),
                  ),
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: _bg(item.color),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.analytics_outlined, size: 16, color: _fg(item.color)),
                  ),
                ],
              ),
              const Spacer(),
              Text(
                item.value,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.text,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
