import fs from "fs/promises";
import { worker } from "./worker.js";
import { env, IDS_FILE } from "./config.js";

async function main() {
  try {
    const content = await fs.readFile(IDS_FILE, "utf8");
    const ids = content.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

    const queue = [...ids];
    const workers = [];

    for (let i = 0; i < env.DOWNLOAD_CONCURRENCY; i++) {
      workers.push(worker(queue));
    }

    await Promise.all(workers);
    console.log("🎉 Done");
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
  }
}

main();