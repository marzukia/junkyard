// ── Character sets ────────────────────────────────────────────────────────────

const UPPER_UNAMBIGUOUS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER_UNAMBIGUOUS = "abcdefghjkmnpqrstuvwxyz";
const DIGITS_UNAMBIGUOUS = "23456789";
const SYMBOLS_UNAMBIGUOUS = "!@#$%^&*-_=+?";

const UPPER_ALL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER_ALL = "abcdefghijklmnopqrstuvwxyz";
const DIGITS_ALL = "0123456789";
const SYMBOLS_ALL = "!@#$%^&*()-_=+[]{}|;:,.<>?";

export interface PasswordOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  minDigits: number;
  minSymbols: number;
}

export interface PassphraseOptions {
  wordCount: number;
  separator: string;
  wordList: readonly string[];
  capitalize: boolean;
  appendNumber: boolean;
}

export interface StrengthResult {
  entropy: number;
  label: "Weak" | "Fair" | "Good" | "Strong" | "Very Strong";
  score: 0 | 1 | 2 | 3 | 4;
}

// ── Cryptographic random helpers ──────────────────────────────────────────────

/** Pick a uniformly random integer in [0, max) using rejection sampling. */
function randomInt(max: number): number {
  if (max <= 0) throw new Error("max must be > 0");
  // Use 4 bytes; reject values in the bias region so distribution is exactly uniform.
  const limit = 2 ** 32 - (2 ** 32 % max);
  const buf = new Uint32Array(1);
  let val: number;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val >= limit);
  return val % max;
}

/** Pick a cryptographically random element from an array. */
export function randomPick<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("Array must not be empty");
  return arr[randomInt(arr.length)];
}

/** Fisher-Yates shuffle using crypto.getRandomValues. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Password generation ───────────────────────────────────────────────────────

export function generatePassword(opts: PasswordOptions): string {
  const { length, upper, lower, digits, symbols, excludeAmbiguous, minDigits, minSymbols } = opts;

  const pools: string[] = [];
  if (upper) pools.push(excludeAmbiguous ? UPPER_UNAMBIGUOUS : UPPER_ALL);
  if (lower) pools.push(excludeAmbiguous ? LOWER_UNAMBIGUOUS : LOWER_ALL);
  if (digits) pools.push(excludeAmbiguous ? DIGITS_UNAMBIGUOUS : DIGITS_ALL);
  if (symbols) pools.push(excludeAmbiguous ? SYMBOLS_UNAMBIGUOUS : SYMBOLS_ALL);

  if (pools.length === 0) throw new Error("At least one character set must be selected");

  const alphabet = pools.join("");

  // Guarantee at least one character from each selected pool.
  const baseRequired = pools.map((pool) => randomPick(pool.split("")));

  // Honour minDigits / minSymbols constraints (only when those sets are enabled).
  const digitPool = excludeAmbiguous ? DIGITS_UNAMBIGUOUS : DIGITS_ALL;
  const symbolPool = excludeAmbiguous ? SYMBOLS_UNAMBIGUOUS : SYMBOLS_ALL;
  const extraDigits: string[] = [];
  const extraSymbols: string[] = [];
  if (digits) {
    const have = baseRequired.filter((c) => digitPool.includes(c)).length;
    for (let i = have; i < minDigits; i++) extraDigits.push(randomPick(digitPool.split("")));
  }
  if (symbols) {
    const have = baseRequired.filter((c) => symbolPool.includes(c)).length;
    for (let i = have; i < minSymbols; i++) extraSymbols.push(randomPick(symbolPool.split("")));
  }

  const mandatoryCount = baseRequired.length + extraDigits.length + extraSymbols.length;
  if (mandatoryCount > length) {
    throw new Error(
      `Min-digit/symbol constraints (${mandatoryCount} required chars) exceed password length (${length})`
    );
  }

  // Fill the rest from the combined alphabet.
  const rest: string[] = [];
  for (let i = mandatoryCount; i < length; i++) {
    rest.push(randomPick(alphabet.split("")));
  }

  return shuffle([...baseRequired, ...extraDigits, ...extraSymbols, ...rest]).join("");
}

// ── Passphrase generation ─────────────────────────────────────────────────────

export function generatePassphrase(opts: PassphraseOptions): string {
  const { wordCount, separator, wordList, capitalize, appendNumber } = opts;
  if (wordList.length === 0) throw new Error("Word list must not be empty");
  const words = Array.from({ length: wordCount }, () => {
    const w = randomPick(wordList);
    return capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
  const phrase = words.join(separator);
  if (appendNumber) {
    // Append a 2-digit number so the passphrase satisfies "must contain digit" policies.
    const twoDigit = String(randomInt(90) + 10);
    return phrase + twoDigit;
  }
  return phrase;
}

// ── Entropy calculation ───────────────────────────────────────────────────────

/** Entropy in bits for a randomly-generated password given its alphabet size and length. */
export function passwordEntropy(opts: PasswordOptions): number {
  const { length, upper, lower, digits, symbols, excludeAmbiguous } = opts;

  let alphabetSize = 0;
  if (upper) alphabetSize += (excludeAmbiguous ? UPPER_UNAMBIGUOUS : UPPER_ALL).length;
  if (lower) alphabetSize += (excludeAmbiguous ? LOWER_UNAMBIGUOUS : LOWER_ALL).length;
  if (digits) alphabetSize += (excludeAmbiguous ? DIGITS_UNAMBIGUOUS : DIGITS_ALL).length;
  if (symbols) alphabetSize += (excludeAmbiguous ? SYMBOLS_UNAMBIGUOUS : SYMBOLS_ALL).length;

  if (alphabetSize === 0) return 0;
  return length * Math.log2(alphabetSize);
}

/** Entropy in bits for a randomly-generated passphrase. */
export function passphraseEntropy(wordCount: number, wordListSize: number): number {
  if (wordListSize === 0) return 0;
  return wordCount * Math.log2(wordListSize);
}

/** Map entropy bits to a human strength label and 0-4 score. */
export function entropyToStrength(bits: number): StrengthResult {
  if (bits < 40) return { entropy: bits, label: "Weak", score: 0 };
  if (bits < 60) return { entropy: bits, label: "Fair", score: 1 };
  if (bits < 80) return { entropy: bits, label: "Good", score: 2 };
  if (bits < 100) return { entropy: bits, label: "Strong", score: 3 };
  return { entropy: bits, label: "Very Strong", score: 4 };
}

/**
 * Convert entropy bits to a plain-language crack-time estimate.
 * Assumes a fast offline attacker at 10^12 guesses/second (modern GPU cluster),
 * which is the harshest realistic assumption and a fair trust signal.
 */
export function entropyToCrackTime(bits: number): string {
  if (bits <= 0) return "instantly";
  // Expected guesses = 2^(bits-1) (average of full search space)
  // Rate: 1e12 guesses/second
  const GUESSES_PER_SECOND = 1e12;
  // Use log to avoid Infinity on large bit counts.
  // log10(expected_seconds) = (bits - 1) * log10(2) - 12
  const log10Seconds = (bits - 1) * Math.log10(2) - Math.log10(GUESSES_PER_SECOND);
  const seconds = 10 ** log10Seconds;

  if (seconds < 1) return "less than a second";
  if (seconds < 60) return `about ${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `about ${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `about ${Math.round(seconds / 3600)} hours`;
  if (seconds < 86400 * 365) return `about ${Math.round(seconds / 86400)} days`;
  if (seconds < 86400 * 365 * 1000) return `about ${Math.round(seconds / (86400 * 365))} years`;
  if (seconds < 86400 * 365 * 1e6)
    return `about ${(seconds / (86400 * 365 * 1000)).toFixed(1)} thousand years`;
  if (seconds < 86400 * 365 * 1e9)
    return `about ${(seconds / (86400 * 365 * 1e6)).toFixed(1)} million years`;
  if (seconds < 86400 * 365 * 1e12)
    return `about ${(seconds / (86400 * 365 * 1e9)).toFixed(1)} billion years`;
  if (seconds < 86400 * 365 * 1e15)
    return `about ${(seconds / (86400 * 365 * 1e12)).toFixed(1)} trillion years`;
  return "longer than the age of the universe";
}
