export type Kpi = {
  key: string;
  label: string;
  value: number;
  percent: number | null;
  color: "blue" | "green" | "orange" | "red" | "sky";
};

export type AttendanceRow = {
  id: number;
  name: string;
  role: string;
  avatar: string;
  shift: string;
  check_in: string | null;
  status: "on_time" | "late" | "pending" | "on_leave";
  status_label: string;
};

export type ShellAccess = {
  role_label: string;
  membership_role: string | null;
  is_owner: boolean;
  custom_role: {
    id: number;
    slug: string;
    name: string;
    is_default: boolean;
  } | null;
  employee_id?: number | null;
  employee?: {
    id: number;
    employee_code: string;
    full_name: string;
    branches: { id: number; name: string; is_primary: boolean }[];
  } | null;
  permissions: Record<
    string,
    {
      view: boolean;
      create: boolean;
      update: boolean;
      delete: boolean;
      export: boolean;
    }
  >;
};

export type ShellData = {
  greeting: { name: string; message: string };
  role?: string | null;
  role_label?: string;
  access?: ShellAccess | null;
  branch: { id: number; name: string };
  branches?: { id: number; name: string; is_headquarters?: boolean; address?: string | null }[];
  date: string;
  notification_count: number;
  notifications: {
    id: number | string;
    type: "warning" | "shift" | "document" | "leave" | "employee" | "reward";
    title: string;
    message?: string;
    time: string;
    unread?: boolean;
    leave_id?: number;
  }[];
  pending_leaves?: {
    id: number;
    employee_id: number;
    employee_code?: string | null;
    full_name: string | null;
    avatar?: string | null;
    position?: string | null;
    type: string;
    type_label: string;
    from: string;
    to: string;
    days: number;
    reason: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    created_at?: string | null;
    time: string;
  }[];
  tenant: { name: string; branch: string; avatar: string; logo_url?: string | null; has_logo?: boolean };
};

export type DashboardData = ShellData & {
  kpis: Kpi[];
  attendance_today: AttendanceRow[];
  salary_projection: {
    month: string;
    total: number;
    total_formatted: string;
    growth: number;
    employees: number;
    breakdown: { label: string; value: number; color: string }[];
  };
  personnel_costs: {
    month: string;
    total: number;
    growth: number;
    days: { day: number; value: number }[];
  };
  performance: {
    overall: number;
    metrics: { label: string; value: number; color: string }[];
  };
  upcoming_shifts: {
    date: string;
    month: string;
    name: string;
    time: string;
    employees: number;
  }[];
};

export const mockDashboard: DashboardData = {
  greeting: {
    name: "Admin",
    message: "Chúc bạn một ngày làm việc hiệu quả",
  },
  branch: { id: 1, name: "Chi nhánh Lê Đức Thọ" },
  date: "Thứ 5, 15/08/2024",
  notification_count: 8,
  pending_leaves: [],
  kpis: [
    { key: "total", label: "Tổng nhân viên", value: 42, percent: null, color: "blue" },
    { key: "working", label: "Đang làm việc", value: 31, percent: 73.8, color: "green" },
    { key: "not_checked_in", label: "Chưa check-in", value: 5, percent: 11.9, color: "orange" },
    { key: "late", label: "Đi trễ", value: 3, percent: 7.1, color: "red" },
    { key: "absent", label: "Nghỉ / Vắng", value: 3, percent: 7.1, color: "sky" },
  ],
  attendance_today: [
    {
      id: 1,
      name: "Nguyễn Văn An",
      role: "Thu ngân",
      avatar: "https://i.pravatar.cc/80?u=an",
      shift: "08:00 - 16:00",
      check_in: "07:56",
      status: "on_time",
      status_label: "Đúng giờ",
    },
    {
      id: 2,
      name: "Trần Thị Bình",
      role: "Phục vụ",
      avatar: "https://i.pravatar.cc/80?u=binh",
      shift: "08:00 - 16:00",
      check_in: "08:12",
      status: "late",
      status_label: "Đi trễ",
    },
    {
      id: 3,
      name: "Lê Minh Cường",
      role: "Bếp trưởng",
      avatar: "https://i.pravatar.cc/80?u=cuong",
      shift: "07:00 - 15:00",
      check_in: "06:48",
      status: "on_time",
      status_label: "Đúng giờ",
    },
    {
      id: 4,
      name: "Phạm Thu Dung",
      role: "Phục vụ",
      avatar: "https://i.pravatar.cc/80?u=dung",
      shift: "14:00 - 22:00",
      check_in: null,
      status: "pending",
      status_label: "Chưa check-in",
    },
    {
      id: 5,
      name: "Hoàng Đức Em",
      role: "Phụ bếp",
      avatar: "https://i.pravatar.cc/80?u=em",
      shift: "08:00 - 16:00",
      check_in: "08:05",
      status: "late",
      status_label: "Đi trễ",
    },
  ],
  salary_projection: {
    month: "08/2024",
    total: 68420000,
    total_formatted: "68.420.000 đ",
    growth: 4.2,
    employees: 0,
    breakdown: [
      { label: "Lương cơ bản", value: 45200000, color: "#6366F1" },
      { label: "Làm thêm giờ", value: 12800000, color: "#22C55E" },
      { label: "Thưởng", value: 7400000, color: "#F59E0B" },
      { label: "Phạt", value: -1200000, color: "#EF4444" },
      { label: "Khác", value: 4200000, color: "#94A3B8" },
    ],
  },
  personnel_costs: {
    month: "08/2024",
    total: 68420000,
    growth: 4.2,
    days: [
      { day: 1, value: 2.1 },
      { day: 3, value: 2.4 },
      { day: 5, value: 1.9 },
      { day: 7, value: 2.8 },
      { day: 9, value: 2.2 },
      { day: 11, value: 3.1 },
      { day: 13, value: 2.6 },
      { day: 15, value: 2.9 },
      { day: 17, value: 2.3 },
      { day: 19, value: 3.4 },
      { day: 21, value: 2.7 },
      { day: 23, value: 3.0 },
      { day: 25, value: 2.5 },
      { day: 27, value: 3.2 },
      { day: 29, value: 2.8 },
    ],
  },
  performance: {
    overall: 85,
    metrics: [
      { label: "Đúng giờ", value: 85, color: "#22C55E" },
      { label: "Hoàn thành ca", value: 92, color: "#6366F1" },
      { label: "Làm thêm", value: 65, color: "#F59E0B" },
      { label: "Nghỉ phép", value: 8, color: "#EF4444" },
    ],
  },
  upcoming_shifts: [
    { date: "16", month: "Th08", name: "Ca sáng", time: "08:00 - 16:00", employees: 12 },
    { date: "16", month: "Th08", name: "Ca chiều", time: "14:00 - 22:00", employees: 10 },
    { date: "17", month: "Th08", name: "Ca sáng", time: "08:00 - 16:00", employees: 11 },
  ],
  notifications: [
    {
      id: 4,
      type: "leave",
      title: "Đơn nghỉ chờ duyệt",
      message: "Phạm Thu Dung xin nghỉ phép ngày 14/08/2026",
      time: "2 phút trước",
      unread: true,
    },
    {
      id: 1,
      type: "warning",
      title: "Cảnh báo",
      message: "3 nhân viên chưa check-in",
      time: "5 phút trước",
      unread: true,
    },
    {
      id: 2,
      type: "shift",
      title: "Ca làm việc",
      message: "Ca chiều thiếu 2 nhân viên",
      time: "15 phút trước",
      unread: true,
    },
    {
      id: 3,
      type: "document",
      title: "Báo cáo ngày",
      message: "Bảng lương tháng 07 đã sẵn sàng",
      time: "1 giờ trước",
      unread: false,
    },
  ],
  tenant: {
    name: "FRESH - Bánh tráng trộn",
    branch: "Chi nhánh Lê Đức Thọ",
    avatar: "https://i.pravatar.cc/80?u=fresh",
  },
};
