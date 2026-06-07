import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import {
  env,
  SUPPORTED_FORMATS,
  SYSTEM_PROMPT,
  TEXT_PROMPT,
  REQUIRED_SECTION_TYPES,
  DEFAULT_SECTION_HEADERS,
} from "./config.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const extractor = new WordExtractor();

export async function convertToJson(filePathOrPaths) {
  const filePaths = Array.isArray(filePathOrPaths) ? filePathOrPaths : [filePathOrPaths];
  if (filePaths.length === 0) return [];

  const blocks = [];
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      console.warn(`Файл не найден: ${filePath}`);
      continue;
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      console.warn(`Пустой файл: ${filePath}`);
      continue;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mediaType = SUPPORTED_FORMATS[ext];
    if (!mediaType) {
      console.warn(`Неподдерживаемый формат файла: ${filePath}`);
      continue;
    }

    blocks.push({ type: "text", text: `Файл: ${path.basename(filePath)}` });
    try {
      blocks.push(await contentBlock(filePath, ext, mediaType));
    } catch (err) {
      console.warn(`Ошибка чтения файла ${filePath}: ${err.message}`);
    }
  }

  if (blocks.length === 0) return [];

  let rawText;
  try {
    const stream = await client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 30000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Объединенная инструкция из ${filePaths.length} файла(ов):` },
            ...blocks,
            { type: "text", text: TEXT_PROMPT },
          ],
        },
      ],
    });

    const message = await stream.finalMessage();

    if (!message?.content?.length) {
      console.warn(`Пустой ответ от Claude для: ${filePaths.join(", ")}`);
      return [];
    }

    rawText = message.content[0]?.text;
  } catch (err) {
    if (err?.error?.type === "request_too_large" || err?.message?.includes("maximum size")) {
      console.warn(`Файл(ы) слишком большие, пропускаем: ${filePaths.join(", ")}`);
      return [];
    }
    if (err?.message?.includes("timeout") || err?.message?.includes("Streaming is required")) {
      console.warn(`Таймаут при обработке: ${filePaths.join(", ")}`);
      return [];
    }
    throw err;
  }

  if (!rawText) return normalizeJson({ language: "ru", sections: [] });
  return normalizeJson(parseJson(rawText));
}

function normalizeJson(data) {
  const language = typeof data.language === "string" ? data.language : "ru";
  const sectionMap = new Map();
  const rawSections = Array.isArray(data.sections) ? data.sections : [];

  for (const section of rawSections) {
    if (!section || typeof section !== "object") continue;
    const type = typeof section.type === "string" ? section.type : null;
    if (!type) continue;

    sectionMap.set(type, {
      type,
      header:
        typeof section.header === "string"
          ? section.header
          : DEFAULT_SECTION_HEADERS[type] || type,
      paragraphs: normalizeParagraphs(section.paragraphs),
      lists: normalizeLists(section.lists),
      tables: normalizeTables(section.tables),
    });
  }

  const normalizedSections = REQUIRED_SECTION_TYPES.map((type) => {
    if (sectionMap.has(type)) return sectionMap.get(type);
    return {
      type,
      header: DEFAULT_SECTION_HEADERS[type] || type,
      paragraphs: [],
      lists: [],
      tables: [],
    };
  });

  for (const section of rawSections) {
    const type = section?.type;
    if (!type || REQUIRED_SECTION_TYPES.includes(type)) continue;
    normalizedSections.push({
      type,
      header:
        typeof section.header === "string"
          ? section.header
          : DEFAULT_SECTION_HEADERS[type] || type,
      paragraphs: normalizeParagraphs(section.paragraphs),
      lists: normalizeLists(section.lists),
      tables: normalizeTables(section.tables),
    });
  }

  return { language, sections: normalizedSections };
}

function normalizeParagraphs(paragraphs) {
  if (!Array.isArray(paragraphs)) return [];
  return paragraphs
    .filter((item) => item && typeof item === "object")
    .map((paragraph, index) => ({
      text: typeof paragraph.text === "string" ? paragraph.text : "",
      order:
        typeof paragraph.order === "number"
          ? paragraph.order
          : index + 1,
    }));
}

function normalizeLists(lists) {
  if (!Array.isArray(lists)) return [];
  return lists
    .filter((item) => item && typeof item === "object")
    .map((list, index) => ({
      text: typeof list.text === "string" ? list.text : "",
      type: typeof list.type === "string" ? list.type : "BULLETED_LIST",
      items: Array.isArray(list.items) ? list.items.map(String) : [],
      order:
        typeof list.order === "number" ? list.order : index + 1,
    }));
}

function normalizeTables(tables) {
  if (!Array.isArray(tables)) return [];
  return tables
    .filter((item) => item && typeof item === "object")
    .map((table, index) => ({
      text: typeof table.text === "string" ? table.text : "",
      columns: Array.isArray(table.columns) ? table.columns.map(String) : [],
      data: Array.isArray(table.data)
        ? table.data.map((row) => (Array.isArray(row) ? row.map(String) : []))
        : [],
      order:
        typeof table.order === "number" ? table.order : index + 1,
    }));
}

async function contentBlock(filePath, ext, mediaType) {
  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return { type: "text", text: `Содержимое Word документа:\n\n${value}` };
  }

  if (ext === ".doc") {
    const doc = await extractor.extract(filePath);
    return { type: "text", text: `Содержимое Word документа:\n\n${doc.getBody()}` };
  }

  const base64Data = fs.readFileSync(filePath).toString("base64");

  if (ext === ".pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: mediaType, data: base64Data },
    };
  }

  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data: base64Data },
  };
}

function parseJson(text) {
  const clean = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!match) {
      console.warn("JSON не найден в ответе Claude");
      return [];
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      console.warn("Не удалось распарсить JSON из ответа Claude");
      return [];
    }
  }
}