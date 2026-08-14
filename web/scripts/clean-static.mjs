import { rmSync } from "node:fs";
import path from "node:path";

// Chỉ dọn đường dẫn cũ. Không xoá public/assets ở prebuild vì HTML đang
// được cache ngoài server có thể vẫn còn tham chiếu tới chunk của build trước.
rmSync(path.join(process.cwd(), "public", "_next"), {
  recursive: true,
  force: true,
});

console.log("Đã dọn public/_next cũ; giữ assets trong thời gian chuyển build.");
