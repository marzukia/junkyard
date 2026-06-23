import { describe, expect, it } from "vitest";
import {
  entropyToCrackTime,
  entropyToStrength,
  generatePassphrase,
  generatePassword,
  passphraseEntropy,
  passwordEntropy,
  randomPick,
} from "./password";

const SAMPLE_WORDS = ["alpha", "bravo", "charlie", "delta", "echo"] as const;

// Helper: default opts with all-off constraints
function pwOpts(
  overrides: Partial<Parameters<typeof generatePassword>[0]>
): Parameters<typeof generatePassword>[0] {
  return {
    length: 16,
    upper: true,
    lower: true,
    digits: true,
    symbols: false,
    excludeAmbiguous: false,
    minDigits: 0,
    minSymbols: 0,
    ...overrides,
  };
}

function ppOpts(
  overrides: Partial<Parameters<typeof generatePassphrase>[0]>
): Parameters<typeof generatePassphrase>[0] {
  return {
    wordCount: 4,
    separator: "-",
    wordList: SAMPLE_WORDS,
    capitalize: false,
    appendNumber: false,
    ...overrides,
  };
}

// ── generatePassword ──────────────────────────────────────────────────────────

describe("generatePassword", () => {
  it("produces the requested length", () => {
    for (const len of [8, 16, 24, 32, 64]) {
      const pw = generatePassword(pwOpts({ length: len }));
      expect(pw.length).toBe(len);
    }
  });

  it("contains at least one uppercase when upper=true", () => {
    const pw = generatePassword(
      pwOpts({ length: 20, upper: true, lower: false, digits: false, symbols: false })
    );
    expect(pw).toMatch(/[A-Z]/);
    // Only uppercase chars
    expect(pw).not.toMatch(/[a-z0-9!@#$%^&*()\-_=+[\]{}|;:,.<>?]/);
  });

  it("contains at least one digit when digits=true (exclusive)", () => {
    const pw = generatePassword(
      pwOpts({ length: 20, upper: false, lower: false, digits: true, symbols: false })
    );
    expect(pw).toMatch(/[0-9]/);
  });

  it("respects excludeAmbiguous — no I, l, O, 0, 1 in output", () => {
    for (let i = 0; i < 20; i++) {
      const pw = generatePassword(
        pwOpts({ length: 30, upper: true, lower: true, digits: true, excludeAmbiguous: true })
      );
      expect(pw).not.toMatch(/[IlO01]/);
    }
  });

  it("throws when no character set is selected", () => {
    expect(() =>
      generatePassword(pwOpts({ upper: false, lower: false, digits: false, symbols: false }))
    ).toThrow();
  });

  it("guarantees at least one char from each enabled set", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword(
        pwOpts({ length: 12, upper: true, lower: true, digits: true, symbols: true })
      );
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[!@#$%^&*()\-_=+[\]{}|;:,.<>?]/);
    }
  });

  it("produces different results on repeated calls (crypto randomness)", () => {
    const passwords = new Set(
      Array.from({ length: 10 }, () =>
        generatePassword(
          pwOpts({ length: 20, upper: true, lower: true, digits: true, symbols: true })
        )
      )
    );
    // Astronomically unlikely to get any collision in 10 draws of a 20-char password.
    expect(passwords.size).toBe(10);
  });

  // ── minDigits / minSymbols ───────────────────────────────────────────────────

  it("minDigits=3 produces at least 3 digits", () => {
    for (let i = 0; i < 30; i++) {
      const pw = generatePassword(
        pwOpts({ length: 16, upper: true, lower: true, digits: true, minDigits: 3 })
      );
      const digitCount = (pw.match(/[0-9]/g) ?? []).length;
      expect(digitCount).toBeGreaterThanOrEqual(3);
    }
  });

  it("minSymbols=2 produces at least 2 symbols", () => {
    // SYMBOLS_ALL = "!@#$%^&*()-_=+[]{}|;:,.<>?"
    const SYM_RE = /[!@#$%^&*()\-_=+[\]{}|;:,.<>?]/g;
    for (let i = 0; i < 30; i++) {
      const pw = generatePassword(
        pwOpts({ length: 16, upper: true, lower: true, digits: true, symbols: true, minSymbols: 2 })
      );
      const symCount = (pw.match(SYM_RE) ?? []).length;
      expect(symCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("throws when minDigits+minSymbols exceeds length", () => {
    expect(() =>
      generatePassword(
        pwOpts({ length: 6, digits: true, symbols: true, minDigits: 4, minSymbols: 4 })
      )
    ).toThrow();
  });
});

// ── generatePassphrase ────────────────────────────────────────────────────────

describe("generatePassphrase", () => {
  it("joins the right number of words", () => {
    const phrase = generatePassphrase(ppOpts({ wordCount: 4, separator: "-" }));
    expect(phrase.split("-")).toHaveLength(4);
  });

  it("uses the provided separator", () => {
    const phrase = generatePassphrase(ppOpts({ wordCount: 3, separator: " " }));
    expect(phrase.split(" ")).toHaveLength(3);
  });

  it("all words come from the word list", () => {
    const phrase = generatePassphrase(ppOpts({ wordCount: 6, separator: "." }));
    const words = phrase.split(".");
    for (const word of words) {
      expect(SAMPLE_WORDS).toContain(word);
    }
  });

  it("throws when word list is empty", () => {
    expect(() => generatePassphrase(ppOpts({ wordList: [] }))).toThrow();
  });

  it("capitalize: each word starts with uppercase", () => {
    for (let i = 0; i < 20; i++) {
      const phrase = generatePassphrase(ppOpts({ wordCount: 4, separator: "-", capitalize: true }));
      const words = phrase.split("-");
      for (const word of words) {
        expect(word.charAt(0)).toMatch(/[A-Z]/);
      }
    }
  });

  it("appendNumber: phrase ends with a 2-digit number", () => {
    for (let i = 0; i < 20; i++) {
      const phrase = generatePassphrase(
        ppOpts({ wordCount: 3, separator: "-", appendNumber: true })
      );
      expect(phrase).toMatch(/\d{2}$/);
    }
  });

  it("without appendNumber: phrase does not end with digits (for word-list words)", () => {
    const phrase = generatePassphrase(
      ppOpts({ wordCount: 4, separator: "-", appendNumber: false })
    );
    // SAMPLE_WORDS are all-alpha; last char should be a letter
    expect(phrase.charAt(phrase.length - 1)).toMatch(/[a-z]/i);
  });
});

// ── passwordEntropy ───────────────────────────────────────────────────────────

describe("passwordEntropy", () => {
  it("returns 0 when no set is selected", () => {
    expect(
      passwordEntropy({
        length: 12,
        upper: false,
        lower: false,
        digits: false,
        symbols: false,
        excludeAmbiguous: false,
        minDigits: 0,
        minSymbols: 0,
      })
    ).toBe(0);
  });

  it("increases with length", () => {
    const base = {
      upper: true,
      lower: true,
      digits: true,
      symbols: false,
      excludeAmbiguous: false,
      minDigits: 0,
      minSymbols: 0,
    };
    const short = passwordEntropy({ length: 8, ...base });
    const long = passwordEntropy({ length: 24, ...base });
    expect(long).toBeGreaterThan(short);
  });

  it("increases with more character sets", () => {
    const base = {
      length: 16,
      upper: true,
      lower: true,
      digits: true,
      excludeAmbiguous: false,
      minDigits: 0,
      minSymbols: 0,
    };
    const withoutSymbols = passwordEntropy({ ...base, symbols: false });
    const withSymbols = passwordEntropy({ ...base, symbols: true });
    expect(withSymbols).toBeGreaterThan(withoutSymbols);
  });

  it("all-upper 26-char alphabet, length 8 = 8 * log2(26) ≈ 37.6 bits", () => {
    const entropy = passwordEntropy({
      length: 8,
      upper: true,
      lower: false,
      digits: false,
      symbols: false,
      excludeAmbiguous: false,
      minDigits: 0,
      minSymbols: 0,
    });
    expect(entropy).toBeCloseTo(8 * Math.log2(26), 5);
  });
});

// ── passphraseEntropy ─────────────────────────────────────────────────────────

describe("passphraseEntropy", () => {
  it("4 words from 1000-word list ≈ 39.86 bits", () => {
    expect(passphraseEntropy(4, 1000)).toBeCloseTo(4 * Math.log2(1000), 5);
  });

  it("returns 0 for empty word list", () => {
    expect(passphraseEntropy(4, 0)).toBe(0);
  });

  it("scales with word count", () => {
    expect(passphraseEntropy(6, 1000)).toBeGreaterThan(passphraseEntropy(4, 1000));
  });
});

// ── entropyToStrength ─────────────────────────────────────────────────────────

describe("entropyToStrength", () => {
  it("labels < 40 bits as Weak", () => {
    expect(entropyToStrength(30).label).toBe("Weak");
    expect(entropyToStrength(30).score).toBe(0);
  });

  it("labels 40-59 bits as Fair", () => {
    expect(entropyToStrength(50).label).toBe("Fair");
    expect(entropyToStrength(50).score).toBe(1);
  });

  it("labels 60-79 bits as Good", () => {
    expect(entropyToStrength(70).label).toBe("Good");
    expect(entropyToStrength(70).score).toBe(2);
  });

  it("labels 80-99 bits as Strong", () => {
    expect(entropyToStrength(90).label).toBe("Strong");
    expect(entropyToStrength(90).score).toBe(3);
  });

  it("labels >= 100 bits as Very Strong", () => {
    expect(entropyToStrength(128).label).toBe("Very Strong");
    expect(entropyToStrength(128).score).toBe(4);
  });

  it("returns the entropy value in the result", () => {
    expect(entropyToStrength(75).entropy).toBe(75);
  });
});

// ── entropyToCrackTime ────────────────────────────────────────────────────────

describe("entropyToCrackTime", () => {
  it("returns 'instantly' for 0 bits", () => {
    expect(entropyToCrackTime(0)).toBe("instantly");
  });

  it("returns a short time for weak passwords (< 40 bits)", () => {
    const t = entropyToCrackTime(20);
    // At 1e12 guesses/sec, 2^19 ≈ 524000 guesses => less than a second
    expect(t).toMatch(/second|minute/i);
  });

  it("returns 'years' or longer for strong passwords (100+ bits)", () => {
    const t = entropyToCrackTime(128);
    expect(t).toMatch(/year|universe/i);
  });

  it("returns 'longer than the age of the universe' for very high entropy", () => {
    expect(entropyToCrackTime(256)).toBe("longer than the age of the universe");
  });

  it("returns a string for typical good password (80 bits)", () => {
    const t = entropyToCrackTime(80);
    expect(typeof t).toBe("string");
    expect(t.length).toBeGreaterThan(0);
  });
});

// ── randomPick ────────────────────────────────────────────────────────────────

describe("randomPick", () => {
  it("always returns an element from the array", () => {
    const arr = ["a", "b", "c", "d", "e"] as const;
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(randomPick(arr));
    }
  });

  it("throws on empty array", () => {
    expect(() => randomPick([])).toThrow();
  });

  it("returns the only element when array has length 1", () => {
    expect(randomPick(["only"])).toBe("only");
  });
});
