import fs from "fs/promises";
import path from "path";

import { api } from "./instance.js";
import { OUTPUT_DIR } from "./config.js";

export async function getPdf(id) {
  const url = `/b/biruni/m:download_file_v2?sha=${id}`;

  try {
    const { data } = await api.get(url, { responseType: "arraybuffer" });
    const filePath = path.join(OUTPUT_DIR, `${id}.pdf`);
    await fs.writeFile(filePath, data);

    console.log(`✅ Saved: ${id}.pdf`);
  } catch (err) {
    const status = err.response?.status;
    console.log(`❌ Failed ${id}: ${err.message}`);
  }
}