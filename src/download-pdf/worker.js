import { getPdf } from "./download.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function worker(queue) {
  while (queue.length > 0) {
    const id = queue.shift();

    if (!id) return;
    await getPdf(id);

    await delay(299);
  }
}