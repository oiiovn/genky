import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const from = path.join(process.cwd(), ".next", "static");
const publicAssets = path.join(process.cwd(), "public", "assets");
const to = path.join(publicAssets, "_next", "static");

if (!existsSync(from)) {
  console.error("Không thấy .next/static — build Next chưa xong.");
  process.exit(1);
}

rmSync(publicAssets, {
  recursive: true,
  force: true,
});
mkdirSync(path.dirname(to), { recursive: true });
cpSync(from, to, { recursive: true });
console.log(
  "Đã copy .next/static → public/assets/_next/static (LiteSpeed phục vụ CSS/JS).",
);
