import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const config = { plugins: { "@tailwindcss/postcss": { base: root } } };
export default config;
