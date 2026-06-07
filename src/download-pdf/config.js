import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

// Определяем текущую директорию
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Получаем имя файла из окружения (передает runner.js) или берем по умолчанию
const currentIdsFile = process.env.CURRENT_IDS_FILE || "ids1.txt";

// Используем path.resolve и process.cwd() для надежности путей в Windows
export const IDS_FILE = path.resolve(process.cwd(), "docs/ids", currentIdsFile);
export const OUTPUT_DIR = path.resolve(process.cwd(), "docs/files");

// Тот самый экспорт, на который ругался Node.js
export const env = {
  COOKIE: process.env.COOKIE,
  DOWNLOAD_CONCURRENCY: parseInt(process.env.DOWNLOAD_CONCURRENCY) || 5,
};

// Лог для контроля в терминале
console.log(`\n[CONFIG] Файл: ${currentIdsFile}`);
console.log(`[CONFIG] Путь: ${IDS_FILE}`);