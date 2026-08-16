"use client";

import { Pencil, X } from "lucide-react";
import type { Employee } from "@/lib/employees-api";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";

const statusLabel: Record<string, string> = {
  active: "Đang làm việc",
  inactive: "Tạm nghỉ",
  resigned: "Nghỉ việc",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export function EmployeeViewModal({
  employee,
  onClose,
  onEdit,
}: {
  employee: Employee;
  onClose: () => void;
  onEdit: () => void;
}) {
  const primary =
    employee.branches.find((b) => b.is_primary) ?? employee.branches[0];
  const salary =
    employee.salary_amount != null
      ? `${Number(employee.salary_amount).toLocaleString("vi-VN")}đ${
          employee.salary_type === "hourly" ? "/giờ" : "/tháng"
        }`
      : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <EmployeeAvatar
              avatar={employee.avatar}
              name={employee.full_name}
              code={employee.employee_code}
              className="h-12 w-12 rounded-full"
            />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                {employee.full_name}
              </h3>
              <p className="text-sm text-slate-500">{employee.employee_code}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <Field label="Số điện thoại" value={employee.phone ?? "—"} />
          <Field label="Email" value={employee.email ?? "—"} />
          <Field label="Chức vụ" value={employee.position?.name ?? "—"} />
          <Field label="Chi nhánh" value={primary?.name ?? "—"} />
          <Field
            label="Giới tính"
            value={
              employee.gender === "female"
                ? "Nữ"
                : employee.gender === "male"
                  ? "Nam"
                  : employee.gender === "other"
                    ? "Khác"
                    : "—"
            }
          />
          <Field
            label="Ngày sinh"
            value={
              employee.date_of_birth
                ? new Date(employee.date_of_birth).toLocaleDateString("vi-VN")
                : "—"
            }
          />
          <Field label="CMND/CCCD" value={employee.identity_number ?? "—"} />
          <Field
            label="Trạng thái"
            value={statusLabel[employee.status] ?? employee.status}
          />
          <Field label="Lương" value={salary} />
          <Field
            label="Ngày vào làm"
            value={
              employee.joined_at
                ? new Date(employee.joined_at).toLocaleDateString("vi-VN")
                : "—"
            }
          />
          <Field
            label="Tài khoản"
            value={employee.has_user_account ? "Đã có tài khoản" : "Chưa có tài khoản"}
          />
          <div className="col-span-2">
            <Field label="Địa chỉ" value={employee.address ?? "—"} />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white"
          >
            <Pencil className="h-4 w-4" />
            Sửa
          </button>
        </div>
      </div>
    </div>
  );
}
