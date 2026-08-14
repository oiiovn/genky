import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const from = path.join(process.cwd(), ".next", "static");
const to = path.join(process.cwd(), "public", "_next", "static");

if (!existsSync(from)) {
  console.error("Không thấy .next/static — build Next chưa xong.");
  process.exit(1);
}

rmSync(path.join(process.cwd(), "public", "_next"), {
  recursive: true,
  force: true,
});
mkdirSync(path.dirname(to), { recursive: true });
cpSync(from, to, { recursive: true });
console.log("Đã copy .next/static → public/_next/static (LiteSpeed phục vụ CSS/JS).");
