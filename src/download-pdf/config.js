import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();


const __dirname = path.dirname(fileURLToPath(import.meta.url));

const currentIdsFile = process.env.CURRENT_IDS_FILE || "ids1.txt";

export const IDS_FILE = path.resolve(process.cwd(), "docs/ids", currentIdsFile);
export const OUTPUT_DIR = path.resolve(process.cwd(), "docs/files");

export const env = {
  COOKIE: process.env.COOKIE,
  DOWNLOAD_CONCURRENCY: parseInt(process.env.DOWNLOAD_CONCURRENCY) || 5,
};

console.log(`\n[CONFIG] Файл: ${currentIdsFile}`);
console.log(`[CONFIG] Путь: ${IDS_FILE}`);