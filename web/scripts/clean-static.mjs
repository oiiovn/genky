import { rmSync } from "node:fs";
import path from "node:path";

for (const folder of ["_next", "assets"]) {
  rmSync(path.join(process.cwd(), "public", folder), {
    recursive: true,
    force: true,
  });
}

console.log("Đã dọn tài nguyên build cũ trong public.");
