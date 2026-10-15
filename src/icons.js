import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "icons");
export const icons = {};
for (const file of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
    icons[path.basename(file, ".svg")] = readFileSync(path.join(dir, file), "utf8").trim();
}
