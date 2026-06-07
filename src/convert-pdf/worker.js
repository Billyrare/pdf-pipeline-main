import path from "path";
import { isAlreadyConverted, saveResult } from "./db.js";
import { convertToJson } from "./ocr.js";
import { env } from "./config.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processDocument(item) {
  const { id, files, basePath } = item;

  const alreadyDone = await isAlreadyConverted(id);
  if (alreadyDone) return "skipped";

  const filePaths = files.map((file) => path.join(basePath, file));
  if (filePaths.length === 0) {
    console.warn(`Пропускаем ${id}, нет поддерживаемых файлов`);
    return "skipped";
  }

  for (let i = 1; i <= env.MAX_RETRIES; i++) {
    try {
      const jsonData = await convertToJson(filePaths);
      await saveResult(id, jsonData);
      return "success";
    } catch (err) {
      const isRateLimit = err.status === 429 || err.message?.includes("429");

      if (isRateLimit && i < env.MAX_RETRIES) {
        console.warn(`⏳ Rate limit, жду ${env.RETRY_DELAY_MS / 1000}с... (попытка ${i}/${env.MAX_RETRIES})`);
        await delay(env.RETRY_DELAY_MS);
        continue;
      }
      throw err;
    }
  }
}
