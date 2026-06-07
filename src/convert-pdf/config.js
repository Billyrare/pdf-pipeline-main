import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultFilesDir = path.join(__dirname, "../../docs/splitted");
const fallbackFilesDir = path.join(__dirname, "../../docs/splitted");

export const FILES_DIR = process.env.CONVERT_FILES_DIR || (fs.existsSync(defaultFilesDir) ? defaultFilesDir : fallbackFilesDir);
export const INDEX_FILE_NAME = "index.json";

export const env = {
  DB_URL: process.env.DB_URL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS),
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES),
  CONVERT_CONCURRENCY: parseInt(process.env.CONVERT_CONCURRENCY),
};

export const SUPPORTED_FORMATS = {
  ".pdf":  "application/pdf",
  ".doc":  "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
};
 
export const SUPPORTED_EXTENSIONS = Object.keys(SUPPORTED_FORMATS);

export const REQUIRED_SECTION_TYPES = [
  "TRADE_NAME",
  "ACTIVE_INGREDIENTS",
  "COMPOSITION",
  "DESCRIPTION",
  "PHARMACOTHERAPEUTIC_GROUP",
  "PHARMACOLOGICAL_PROPERTIES",
  "DOSAGE_AND_ADMINISTRATION",
  "ADVERSE_REACTIONS",
  "CONTRAINDICATIONS",
  "DRUG_INTERACTIONS",
  "SPECIAL_WARNINGS_AND_PRECAUTIONS_FOR_USE",
  "OVERDOSE",
  "PHARMACEUTICAL_FORM_AND_PACKAGING",
  "STORAGE_CONDITIONS",
  "SHELF_LIFE",
  "DISPENSING_CONDITIONS",
  "MANUFACTURER",
  "OPTIONAL_SECTION",
];

export const DEFAULT_SECTION_HEADERS = {
  TRADE_NAME: "Торговое название препарата",
  ACTIVE_INGREDIENTS: "Действующие вещества (МНН)",
  COMPOSITION: "Состав препарата",
  DESCRIPTION: "Описание",
  PHARMACOTHERAPEUTIC_GROUP: "Фармакотерапевтическая группа",
  PHARMACOLOGICAL_PROPERTIES: "Фармакологические свойства",
  DOSAGE_AND_ADMINISTRATION: "Способы применения и дозы",
  ADVERSE_REACTIONS: "Побочные действия",
  CONTRAINDICATIONS: "Противопоказания",
  DRUG_INTERACTIONS: "Лекарственные взаимодействия",
  SPECIAL_WARNINGS_AND_PRECAUTIONS_FOR_USE: "Особые указания",
  OVERDOSE: "Передозировка",
  PHARMACEUTICAL_FORM_AND_PACKAGING: "Форма выпуска",
  STORAGE_CONDITIONS: "Условия хранения",
  SHELF_LIFE: "Срок годности",
  DISPENSING_CONDITIONS: "Условия отпуска из аптек",
  MANUFACTURER: "Производитель",
  OPTIONAL_SECTION: "Дополнительная информация",
};

export const STATUS_ICONS = {
  success: "✅",
  skipped: "⏭️",
  failed: "❌",
};

export const TEXT_PROMPT = `Проанализируй PDF. Если PDF пустой, поврежденный, не содержит текста — верни строго: []
Если инструкция присутствует — извлеки всю информацию из этой фармацевтической инструкции и верни строго в указанном JSON формате.`;

export const SYSTEM_PROMPT = `
;Ты — специализированный парсер фармацевтических инструкций.
ЗАДАЧА: Извлечь ВСЮ информацию из PDF-инструкции и вернуть ТОЛЬКО валидный JSON.

ТРЕБОВАНИЯ:
- Верни ТОЛЬКО JSON, без пояснений, комментариев, markdown-блоков
- Если PDF пустой или поврежденный → верни: []
- Каждая секция ОБЯЗАТЕЛЬНО должна содержать ВСЕ ТРИ поля: paragraphs, lists, tables
- Пустые поля = пустые массивы: [], [], []
- Сохраняй оригинальный текст БЕЗ изменений и сокращений
- Сохраняй оригинальный порядок разделов из документа

СТРУКТУРА JSON:
{
  "language": "ru" или "uz",
  "sections": [
    {
      "type": "ТИП_СЕКЦИИ",
      "header": "Заголовок из документа",
      "paragraphs": [
        {"order": 1, "text": "Текст абзаца"}
      ],
      "lists": [
        {
          "order": 2,
          "text": "Заголовок списка (если есть)",
          "type": "BULLETED_LIST или NUMBERED_LIST",
          "items": ["Пункт 1", "Пункт 2"]
        }
      ],
      "tables": [
        {
          "order": 3,
          "text": "Заголовок таблицы (если есть)",
          "columns": ["Колонка 1", "Колонка 2"],
          "data": [["Ячейка 1", "Ячейка 2"]]
        }
      ]
    }
  ]
}

ТИПЫ СЕКЦИЙ (обязательные 17):
TRADE_NAME, ACTIVE_INGREDIENTS, COMPOSITION, DESCRIPTION, PHARMACOTHERAPEUTIC_GROUP, 
PHARMACOLOGICAL_PROPERTIES, DOSAGE_AND_ADMINISTRATION, ADVERSE_REACTIONS, CONTRAINDICATIONS, 
DRUG_INTERACTIONS, SPECIAL_WARNINGS_AND_PRECAUTIONS_FOR_USE, OVERDOSE, 
PHARMACEUTICAL_FORM_AND_PACKAGING, STORAGE_CONDITIONS, SHELF_LIFE, DISPENSING_CONDITIONS, 
MANUFACTURER, OPTIONAL_SECTION (для доп. информации)

НУМЕРАЦИЯ order:
- Внутри каждой секции order идет сквозная: 1, 2, 3...
- Независимо от типа элемента (paragraph, list, table)

ПРАВИЛА:
1. Не объединяй секции, даже если они похожи
2. Не пропускай ни одной секции из документа
3. Не перефразируй текст
4. Форматирование: **жирный**, *курсив*, ***жирный курсив***, <u>подчеркнутый</u>
5. Если таблица разбита на страницах → восстанови как одну таблицу
6. Каждый пункт списка → отдельный элемент в массиве items

ПРОВЕРКА:
✓ JSON валиден
✓ Все 17 обязательных типов секций присутствуют
✓ Каждая секция содержит paragraphs, lists, tables (может быть [])
✓ order последовательный в каждой секции
✓ Нет текста вне JSON
`;