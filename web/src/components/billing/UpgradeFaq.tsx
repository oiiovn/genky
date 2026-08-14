"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

const FAQS = [
  {
    q: "Tôi có thể nâng cấp hoặc hạ cấp gói bất cứ lúc nào không?",
    a: "Có. Bạn có thể đổi gói bất cứ lúc nào. Phí sẽ được tính theo tỷ lệ thời gian còn lại của chu kỳ thanh toán hiện tại.",
  },
  {
    q: "Dữ liệu có bị mất khi tôi hủy gói không?",
    a: "Không. Dữ liệu của bạn được giữ nguyên. Khi hủy, bạn vẫn truy cập được các tính năng của gói Free.",
  },
  {
    q: "Phương thức thanh toán nào được hỗ trợ?",
    a: "Hỗ trợ chuyển khoản ngân hàng, thẻ nội địa/quốc tế và ví điện tử phổ biến tại Việt Nam.",
  },
];

export function UpgradeFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800">
        Câu hỏi thường gặp
      </h3>
      <ul className="mt-3 divide-y divide-slate-100">
        {FAQS.map((item, index) => {
          const active = open === index;
          return (
            <li key={item.q}>
              <button
                type="button"
                onClick={() => setOpen(active ? null : index)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left"
              >
                <span className="text-sm font-medium text-slate-700">
                  {item.q}
                </span>
                <ChevronDown
                  className={clsx(
                    "h-4 w-4 shrink-0 text-slate-400 transition",
                    active && "rotate-180",
                  )}
                />
              </button>
              {active ? (
                <p className="pb-3 text-sm text-slate-500">{item.a}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
