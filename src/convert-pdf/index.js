import fs from "fs/promises";
import path from "path";

import { processDocument } from "./worker.js";
import { initDb, closeDb } from "./db.js";
import { env, FILES_DIR, INDEX_FILE_NAME, STATUS_ICONS, SUPPORTED_EXTENSIONS } from "./config.js";

async function runPool(items, concurrency, task) {
  let idx = 0;

  const runNext = async () => {
    while (idx < items.length) {
      const item = items[idx++];
      await task(item);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runNext),
  );
}

async function loadManifest() {
  try {
    const manifestText = await fs.readFile(path.join(FILES_DIR, INDEX_FILE_NAME), "utf8");
    return JSON.parse(manifestText);
  } catch {
    return null;
  }
}

function normalizeManifestEntry(fileName) {
  return fileName.replace(/\\/g, "/").replace(/^\/+/, "");
}

async function buildItems() {
  const items = [];
  const manifest = await loadManifest();

  if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
    for (const id of Object.keys(manifest)) {
      const rawFiles = Array.isArray(manifest[id]) ? manifest[id] : [];
      const supported = rawFiles
        .map(normalizeManifestEntry)
        .filter((file) => SUPPORTED_EXTENSIONS.includes(path.extname(file).toLowerCase()));

      if (supported.length > 0) {
        items.push({ id, files: supported, basePath: FILES_DIR });
      }
    }
    if (items.length > 0) return items;
  }

  const entries = await fs.readdir(FILES_DIR, { withFileTypes: true });

  const directoryItems = [];
  const rootFileItems = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const dirPath = path.join(FILES_DIR, entry.name);
      const subFiles = (await fs.readdir(dirPath)).filter((f) => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()));
      if (subFiles.length > 0) {
        directoryItems.push({ id: entry.name, files: subFiles, basePath: dirPath });
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        rootFileItems.push({ id: path.parse(entry.name).name, files: [entry.name], basePath: FILES_DIR });
      }
    }
  }

  return [...directoryItems, ...rootFileItems];
}

async function main() {
  try {
    await initDb();

    const items = await buildItems();
    if (items.length === 0) {
      console.log(`📂 Нет поддерживаемых файлов или папок в папке ${FILES_DIR}`);
      return;
    }
    console.log(`📄 Продуктов/групп: ${items.length}`);

    const stats = { success: 0, skipped: 0, failed: 0 };
    let completed = 0;

    await runPool(items, env.CONVERT_CONCURRENCY, async (item) => {
      try {
        const status = await processDocument(item);
        stats[status]++;
        completed++;

        console.log(`${STATUS_ICONS[status]} [${completed}/${items.length}] ${item.id} — ${status}`);
      } catch (err) {
        stats.failed++;
        completed++;
        console.error(`❌ [${completed}/${items.length}] ${item.id} — ${err.message}`);
      }
    });

    console.log(`✅ Успешно:   ${stats.success}`);
    console.log(`⏭️  Пропущено: ${stats.skipped}`);
    console.log(`❌ Ошибок:    ${stats.failed}`);
  } finally {
    await closeDb();
  }
}

main();