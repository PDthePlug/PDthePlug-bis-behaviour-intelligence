import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const config = { turbopack: { root }, experimental: { turbopackFileSystemCacheForDev: false } };
export default config;
