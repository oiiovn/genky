export type RoleAction = "view" | "create" | "update" | "delete" | "export";

export type RolePermissionCell = Record<RoleAction, boolean>;

export type PermissionRow = {
  id: string;
  label: string;
  description: string;
  actions: RoleAction[];
};

export type PermissionGroup = {
  id: string;
  label: string;
  rows: PermissionRow[];
};

export type RoleItem = {
  id: number;
  slug?: string;
  name: string;
  description: string;
  memberCount: number;
  isDefault?: boolean;
  isSystem?: boolean;
  icon: "crown" | "shield" | "cash" | "user" | "box";
  color: string;
  bg: string;
  permissions: Record<string, RolePermissionCell>;
};

export const ROLE_ACTIONS: { key: RoleAction; label: string }[] = [
  { key: "view", label: "Xem" },
  { key: "create", label: "Thêm" },
  { key: "update", label: "Sửa" },
  { key: "delete", label: "Xóa" },
  { key: "export", label: "Xuất" },
];

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "overview",
    label: "Tổng quan",
    rows: [
      {
        id: "dashboard",
        label: "Dashboard tổng quan",
        description: "Xem thống kê và báo cáo tổng hợp",
        actions: ["view", "export"],
      },
    ],
  },
  {
    id: "hr",
    label: "Nhân sự",
    rows: [
      {
        id: "employees",
        label: "Quản lý nhân viên",
        description: "Thêm, sửa, xóa thông tin nhân viên",
        actions: ["view", "create", "update", "delete", "export"],
      },
      {
        id: "shifts",
        label: "Ca làm việc",
        description: "Thiết lập và phân ca làm việc",
        actions: ["view", "create", "update", "delete"],
      },
      {
        id: "attendance",
        label: "Chấm công",
        description: "Xem và chỉnh sửa dữ liệu chấm công",
        actions: ["view", "create", "update", "delete", "export"],
      },
      {
        id: "leave",
        label: "Nghỉ phép",
        description: "Duyệt và quản lý đơn nghỉ phép",
        actions: ["view", "create", "update", "delete"],
      },
    ],
  },
  {
    id: "payroll",
    label: "Lương & Thưởng",
    rows: [
      {
        id: "payroll",
        label: "Bảng lương",
        description: "Tính và xuất bảng lương tháng",
        actions: ["view", "create", "update", "delete", "export"],
      },
      {
        id: "bonus",
        label: "Thưởng / Phạt",
        description: "Quản lý thưởng phạt nhân viên",
        actions: ["view", "create", "update", "delete"],
      },
      {
        id: "payroll_export",
        label: "Xuất dữ liệu lương",
        description: "Xuất file lương ra Excel/PDF",
        actions: ["view", "export"],
      },
    ],
  },
  {
    id: "inventory",
    label: "Kho & Sản phẩm",
    rows: [
      {
        id: "products",
        label: "Sản phẩm / Menu",
        description: "Quản lý danh mục sản phẩm",
        actions: ["view", "create", "update", "delete"],
      },
      {
        id: "inventory",
        label: "Quản lý kho",
        description: "Nhập xuất tồn kho",
        actions: ["view", "create", "update", "delete", "export"],
      },
    ],
  },
  {
    id: "system",
    label: "Hệ thống",
    rows: [
      {
        id: "schedule",
        label: "Lịch làm việc",
        description: "Phân ca và lịch làm nhân viên",
        actions: ["view", "create", "update", "delete"],
      },
      {
        id: "timesheet",
        label: "Bảng công",
        description: "Tổng hợp công theo kỳ",
        actions: ["view", "create", "update", "export"],
      },
      {
        id: "settings",
        label: "Cài đặt hệ thống",
        description: "Cấu hình tổ chức và giao diện",
        actions: ["view", "update"],
      },
      {
        id: "roles",
        label: "Vai trò & Quyền",
        description: "Phân quyền sử dụng hệ thống",
        actions: ["view", "create", "update", "delete"],
      },
    ],
  },
];

function fullPerms(
  overrides: Partial<Record<string, Partial<RolePermissionCell>>> = {},
): Record<string, RolePermissionCell> {
  const result: Record<string, RolePermissionCell> = {};
  for (const group of PERMISSION_GROUPS) {
    for (const row of group.rows) {
      const cell: RolePermissionCell = {
        view: false,
        create: false,
        update: false,
        delete: false,
        export: false,
      };
      for (const action of row.actions) {
        cell[action] = true;
      }
      if (overrides[row.id]) {
        Object.assign(cell, overrides[row.id]);
      }
      result[row.id] = cell;
    }
  }
  return result;
}

export const INITIAL_ROLES: RoleItem[] = [];
