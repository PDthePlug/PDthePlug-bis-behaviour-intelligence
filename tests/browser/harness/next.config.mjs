import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
process.env.BIS_REPORT_FONT_ROOT = path.join(root, "assets/report-fonts");
const config = { turbopack: { root }, experimental: { turbopackFileSystemCacheForDev: false } };
export default config;
