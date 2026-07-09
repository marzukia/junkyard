// ── Styles ───────────────────────────────────────────────────────────────
import "./styles.css";

// ── Components ───────────────────────────────────────────────────────────
export { DropZone } from "./DropZone";
export { Header } from "./components/Header";
export { Footer } from "./components/Footer";
export { BrandMark } from "./components/BrandMark";
export { ThemeToggle } from "./components/ThemeToggle";
export { AppSwitcher } from "./components/AppSwitcher";
export {
  MobileWarning,
  mobileWarningMessage,
} from "./components/MobileWarning";
export { formatBytes } from "./components/format";
export { useCmdEnter } from "./useCmdEnter";
export { useProgress } from "./lib/useProgress";

// ── Lib ─────────────────────────────────────────────────────────────────
export {
  embedUnicodeFonts,
  sanitizeWinAnsi,
} from "./lib/unicodeFont";
export {
  ACCEPTED_TYPES,
  type AcceptedType,
  isSupportedImage,
  formatProgress,
  formatTime,
  parseTime,
  clamp,
  outputFilename,
  isValidHex,
  parseHexColor,
} from "./lib/imageHelpers";
export {
  encodeBase64Url,
  decodeBase64Url,
} from "./lib/base64url";
export {
  CRON_MACROS,
  type CronFields,
  type FieldSpec,
  FIELD_SPECS,
  FIELD_ORDER,
  expandMacro,
  normaliseNames,
  validateSinglePart,
  expandField,
} from "./lib/cronGrammar";
export {
  type Delimiter,
  splitCsvRows,
  detectDelimiter,
} from "./lib/csvParse";
export {
  type WifiPayloadFields,
  escapeWifiField,
  buildWifiPayload,
  type VCardPayloadFields,
  buildVCardPayload,
} from "./lib/qrContent";
export {
  type CategoryId,
  type UnitDef,
  type Category,
  TEMP_UNITS,
  CATEGORIES,
  getCategoryById,
  findUnit,
  type ConvertOptions,
  convert,
} from "./lib/unitsData";
export {
  type WorkerMsg,
  type WorkerRequest,
  type WorkerTaskHandlers,
  shouldEmitProgress,
  useWorkerTask,
} from "./lib/workerTask";

// ── Config ──────────────────────────────────────────────────────────────
export { fleetTheme } from "./theme";