import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/api";
import {
  fetchUserPreferences,
  updateUserPreferences,
} from "@/lib/appearance";
import {
  PAYROLL_DEFAULT_COLUMNS,
  type PayrollColumnKey,
  normalizePayrollColumns,
  readPayrollColumnsFromStorage,
  writePayrollColumnsToStorage,
} from "@/lib/payroll-columns";

export function usePayrollTableColumns() {
  const [visible, setVisible] = useState<PayrollColumnKey[]>(
    readPayrollColumnsFromStorage,
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    let cancelled = false;
    void fetchUserPreferences()
      .then((prefs) => {
        if (cancelled || !prefs.payroll_table_columns) return;
        const next = normalizePayrollColumns(prefs.payroll_table_columns);
        setVisible(next);
        writePayrollColumnsToStorage(next);
      })
      .catch(() => {
        /* giữ localStorage */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: PayrollColumnKey[]) => {
    const keys = normalizePayrollColumns(next);
    setVisible(keys);
    writePayrollColumnsToStorage(keys);
    if (!getAccessToken()) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void updateUserPreferences({ payroll_table_columns: keys }).catch(() => {
        /* localStorage vẫn giữ */
      });
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const toggle = useCallback(
    (key: PayrollColumnKey) => {
      if (key === "employee") return;
      persist(
        visible.includes(key)
          ? visible.filter((item) => item !== key)
          : [...visible, key],
      );
    },
    [persist, visible],
  );

  const showAll = useCallback(() => {
    persist([...PAYROLL_DEFAULT_COLUMNS]);
  }, [persist]);

  const reset = useCallback(() => {
    persist([...PAYROLL_DEFAULT_COLUMNS]);
  }, [persist]);

  return { visible, toggle, showAll, reset };
}
