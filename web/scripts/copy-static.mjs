import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";

const from = path.join(process.cwd(), ".next", "static");
const publicAssets = path.join(process.cwd(), "public", "assets");
const to = path.join(publicAssets, "_next", "static");
const graceDays = Math.max(
  1,
  Number.parseInt(process.env.STATIC_ASSET_GRACE_DAYS ?? "7", 10) || 7,
);
const staleBefore = Date.now() - graceDays * 24 * 60 * 60 * 1000;

if (!existsSync(from)) {
  console.error("Không thấy .next/static — build Next chưa xong.");
  process.exit(1);
}

function removeExpiredFiles(directory) {
  if (!existsSync(directory)) return 0;

  let removed = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      removed += removeExpiredFiles(target);
      if (readdirSync(target).length === 0) {
        rmSync(target, { recursive: true, force: true });
      }
      continue;
    }

    if (statSync(target).mtimeMs < staleBefore) {
      rmSync(target, { force: true });
      removed++;
    }
  }

  return removed;
}

// Merge thay vì xoá cả thư mục để chunk của deployment trước tiếp tục tồn tại.
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true, force: true });

const removed = removeExpiredFiles(to);
console.log(
  `Đã merge .next/static → public/assets/_next/static; giữ chunk cũ ${graceDays} ngày, dọn ${removed} file quá hạn.`,
);
