class DashboardData {
  DashboardData({
    required this.kpis,
    required this.attendance,
    required this.salaryTotal,
    required this.salaryGrowth,
    required this.performance,
    required this.notifications,
    required this.shifts,
  });

  final List<KpiItem> kpis;
  final List<AttendanceItem> attendance;
  final String salaryTotal;
  final double salaryGrowth;
  final int performance;
  final List<NotifItem> notifications;
  final List<ShiftItem> shifts;

  factory DashboardData.mock() => DashboardData(
        kpis: const [
          KpiItem('Tổng NV', '42', ColorKey.blue),
          KpiItem('Đang làm', '31', ColorKey.green),
          KpiItem('Chưa CI', '5', ColorKey.orange),
          KpiItem('Đi trễ', '3', ColorKey.red),
          KpiItem('Vắng', '3', ColorKey.sky),
        ],
        attendance: const [
          AttendanceItem('Nguyễn Văn An', 'Thu ngân', '07:56', 'Đúng giờ', StatusKey.onTime),
          AttendanceItem('Trần Thị Bình', 'Phục vụ', '08:12', 'Đi trễ', StatusKey.late),
          AttendanceItem('Lê Minh Cường', 'Bếp trưởng', '06:48', 'Đúng giờ', StatusKey.onTime),
          AttendanceItem('Phạm Thu Dung', 'Phục vụ', '—', 'Chưa check-in', StatusKey.pending),
        ],
        salaryTotal: '68.420.000 đ',
        salaryGrowth: 4.2,
        performance: 85,
        notifications: const [
          NotifItem('3 nhân viên chưa check-in', '5 phút trước'),
          NotifItem('Ca chiều thiếu 2 nhân viên', '15 phút trước'),
          NotifItem('Bảng lương tháng 07 đã sẵn sàng', '1 giờ trước'),
        ],
        shifts: const [
          ShiftItem('16', 'Th08', 'Ca sáng', '08:00 - 16:00', 12),
          ShiftItem('16', 'Th08', 'Ca chiều', '14:00 - 22:00', 10),
          ShiftItem('17', 'Th08', 'Ca sáng', '08:00 - 16:00', 11),
        ],
      );
}

enum ColorKey { blue, green, orange, red, sky }
enum StatusKey { onTime, late, pending }

class KpiItem {
  const KpiItem(this.label, this.value, this.color);
  final String label;
  final String value;
  final ColorKey color;
}

class AttendanceItem {
  const AttendanceItem(this.name, this.role, this.checkIn, this.status, this.key);
  final String name;
  final String role;
  final String checkIn;
  final String status;
  final StatusKey key;
}

class NotifItem {
  const NotifItem(this.title, this.time);
  final String title;
  final String time;
}

class ShiftItem {
  const ShiftItem(this.date, this.month, this.name, this.time, this.count);
  final String date;
  final String month;
  final String name;
  final String time;
  final int count;
}
