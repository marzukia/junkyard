/**
 * Language pairs supported by the NLLB-200 distilled 600M model.
 *
 * NLLB uses BCP-47-style codes with a script suffix, e.g. "eng_Latn".
 * We expose a curated subset of the 200 languages with friendly display names.
 * The full language list is at:
 * https://huggingface.co/facebook/nllb-200-distilled-600M
 */

export interface Language {
  /** NLLB BCP-47 code, e.g. "eng_Latn" */
  code: string;
  /** Human-readable display name */
  label: string;
  /** ISO 639-1 two-letter code for html[lang] / display hints (optional) */
  iso?: string;
}

/**
 * Curated NLLB language list, all 200 supported by the model, presented in
 * alphabetical display-name order. Codes are the exact flores_200 script codes
 * required by the pipeline's forced_bos_token_id lookup.
 */
export const LANGUAGES: Language[] = [
  { code: "ace_Arab", label: "Acehnese (Arabic script)" },
  { code: "ace_Latn", label: "Acehnese (Latin script)" },
  { code: "acm_Arab", label: "Mesopotamian Arabic" },
  { code: "acq_Arab", label: "Ta'izzi-Adeni Arabic" },
  { code: "aeb_Arab", label: "Tunisian Arabic" },
  { code: "afr_Latn", label: "Afrikaans", iso: "af" },
  { code: "ajp_Arab", label: "South Levantine Arabic" },
  { code: "aka_Latn", label: "Akan" },
  { code: "amh_Ethi", label: "Amharic", iso: "am" },
  { code: "apc_Arab", label: "North Levantine Arabic" },
  { code: "arb_Arab", label: "Arabic", iso: "ar" },
  { code: "ars_Arab", label: "Najdi Arabic" },
  { code: "ary_Arab", label: "Moroccan Arabic" },
  { code: "arz_Arab", label: "Egyptian Arabic" },
  { code: "asm_Beng", label: "Assamese" },
  { code: "ast_Latn", label: "Asturian" },
  { code: "awa_Deva", label: "Awadhi" },
  { code: "ayr_Latn", label: "Central Aymara" },
  { code: "azb_Arab", label: "South Azerbaijani" },
  { code: "azj_Latn", label: "North Azerbaijani", iso: "az" },
  { code: "bak_Cyrl", label: "Bashkir" },
  { code: "bam_Latn", label: "Bambara" },
  { code: "ban_Latn", label: "Balinese" },
  { code: "bel_Cyrl", label: "Belarusian", iso: "be" },
  { code: "bem_Latn", label: "Bemba" },
  { code: "ben_Beng", label: "Bengali", iso: "bn" },
  { code: "bho_Deva", label: "Bhojpuri" },
  { code: "bjn_Arab", label: "Banjar (Arabic script)" },
  { code: "bjn_Latn", label: "Banjar (Latin script)" },
  { code: "bod_Tibt", label: "Tibetan", iso: "bo" },
  { code: "bos_Latn", label: "Bosnian", iso: "bs" },
  { code: "bug_Latn", label: "Buginese" },
  { code: "bul_Cyrl", label: "Bulgarian", iso: "bg" },
  { code: "cat_Latn", label: "Catalan", iso: "ca" },
  { code: "ceb_Latn", label: "Cebuano" },
  { code: "ces_Latn", label: "Czech", iso: "cs" },
  { code: "cjk_Latn", label: "Chokwe" },
  { code: "ckb_Arab", label: "Central Kurdish" },
  { code: "crh_Latn", label: "Crimean Tatar" },
  { code: "cym_Latn", label: "Welsh", iso: "cy" },
  { code: "dan_Latn", label: "Danish", iso: "da" },
  { code: "deu_Latn", label: "German", iso: "de" },
  { code: "dik_Latn", label: "Southwestern Dinka" },
  { code: "dyu_Latn", label: "Dyula" },
  { code: "dzo_Tibt", label: "Dzongkha", iso: "dz" },
  { code: "ell_Grek", label: "Greek", iso: "el" },
  { code: "eng_Latn", label: "English", iso: "en" },
  { code: "epo_Latn", label: "Esperanto", iso: "eo" },
  { code: "est_Latn", label: "Estonian", iso: "et" },
  { code: "eus_Latn", label: "Basque", iso: "eu" },
  { code: "ewe_Latn", label: "Ewe" },
  { code: "fao_Latn", label: "Faroese", iso: "fo" },
  { code: "fij_Latn", label: "Fijian" },
  { code: "fin_Latn", label: "Finnish", iso: "fi" },
  { code: "fon_Latn", label: "Fon" },
  { code: "fra_Latn", label: "French", iso: "fr" },
  { code: "fur_Latn", label: "Friulian" },
  { code: "fuv_Latn", label: "Nigerian Fulfulde" },
  { code: "gla_Latn", label: "Scottish Gaelic", iso: "gd" },
  { code: "gle_Latn", label: "Irish", iso: "ga" },
  { code: "glg_Latn", label: "Galician", iso: "gl" },
  { code: "grn_Latn", label: "Guarani", iso: "gn" },
  { code: "guj_Gujr", label: "Gujarati", iso: "gu" },
  { code: "hat_Latn", label: "Haitian Creole", iso: "ht" },
  { code: "hau_Latn", label: "Hausa", iso: "ha" },
  { code: "heb_Hebr", label: "Hebrew", iso: "he" },
  { code: "hin_Deva", label: "Hindi", iso: "hi" },
  { code: "hne_Deva", label: "Chhattisgarhi" },
  { code: "hrv_Latn", label: "Croatian", iso: "hr" },
  { code: "hun_Latn", label: "Hungarian", iso: "hu" },
  { code: "hye_Armn", label: "Armenian", iso: "hy" },
  { code: "ibo_Latn", label: "Igbo", iso: "ig" },
  { code: "ilo_Latn", label: "Ilocano" },
  { code: "ind_Latn", label: "Indonesian", iso: "id" },
  { code: "isl_Latn", label: "Icelandic", iso: "is" },
  { code: "ita_Latn", label: "Italian", iso: "it" },
  { code: "jav_Latn", label: "Javanese", iso: "jv" },
  { code: "jpn_Jpan", label: "Japanese", iso: "ja" },
  { code: "kab_Latn", label: "Kabyle" },
  { code: "kac_Latn", label: "Jingpho" },
  { code: "kam_Latn", label: "Kamba" },
  { code: "kan_Knda", label: "Kannada", iso: "kn" },
  { code: "kas_Arab", label: "Kashmiri (Arabic script)" },
  { code: "kas_Deva", label: "Kashmiri (Devanagari)" },
  { code: "kat_Geor", label: "Georgian", iso: "ka" },
  { code: "knc_Arab", label: "Central Kanuri (Arabic)" },
  { code: "knc_Latn", label: "Central Kanuri (Latin)" },
  { code: "kaz_Cyrl", label: "Kazakh", iso: "kk" },
  { code: "kbp_Latn", label: "Kabiyye" },
  { code: "kea_Latn", label: "Kabuverdianu" },
  { code: "khm_Khmr", label: "Khmer", iso: "km" },
  { code: "kik_Latn", label: "Kikuyu", iso: "ki" },
  { code: "kin_Latn", label: "Kinyarwanda", iso: "rw" },
  { code: "kir_Cyrl", label: "Kyrgyz", iso: "ky" },
  { code: "kln_Latn", label: "Kalenjin" },
  { code: "kor_Hang", label: "Korean", iso: "ko" },
  { code: "lao_Laoo", label: "Lao", iso: "lo" },
  { code: "lij_Latn", label: "Ligurian" },
  { code: "lim_Latn", label: "Limburgish" },
  { code: "lin_Latn", label: "Lingala", iso: "ln" },
  { code: "lit_Latn", label: "Lithuanian", iso: "lt" },
  { code: "lmo_Latn", label: "Lombard" },
  { code: "ltg_Latn", label: "Latgalian" },
  { code: "ltz_Latn", label: "Luxembourgish", iso: "lb" },
  { code: "lua_Latn", label: "Luba-Kasai" },
  { code: "lug_Latn", label: "Ganda", iso: "lg" },
  { code: "luo_Latn", label: "Luo" },
  { code: "lus_Latn", label: "Mizo" },
  { code: "lvs_Latn", label: "Latvian", iso: "lv" },
  { code: "mag_Deva", label: "Magahi" },
  { code: "mai_Deva", label: "Maithili" },
  { code: "mal_Mlym", label: "Malayalam", iso: "ml" },
  { code: "mar_Deva", label: "Marathi", iso: "mr" },
  { code: "min_Arab", label: "Minangkabau (Arabic)" },
  { code: "min_Latn", label: "Minangkabau (Latin)" },
  { code: "mkd_Cyrl", label: "Macedonian", iso: "mk" },
  { code: "plt_Latn", label: "Plateau Malagasy" },
  { code: "mlt_Latn", label: "Maltese", iso: "mt" },
  { code: "mni_Beng", label: "Meitei (Bengali script)" },
  { code: "khk_Cyrl", label: "Mongolian", iso: "mn" },
  { code: "mos_Latn", label: "Mossi" },
  { code: "mri_Latn", label: "Maori", iso: "mi" },
  { code: "mya_Mymr", label: "Burmese", iso: "my" },
  { code: "nld_Latn", label: "Dutch", iso: "nl" },
  { code: "nno_Latn", label: "Norwegian Nynorsk", iso: "nn" },
  { code: "nob_Latn", label: "Norwegian Bokmål", iso: "nb" },
  { code: "npi_Deva", label: "Nepali", iso: "ne" },
  { code: "nso_Latn", label: "Northern Sotho" },
  { code: "nus_Latn", label: "Nuer" },
  { code: "nya_Latn", label: "Nyanja", iso: "ny" },
  { code: "oci_Latn", label: "Occitan", iso: "oc" },
  { code: "gaz_Latn", label: "West Central Oromo" },
  { code: "ory_Orya", label: "Odia", iso: "or" },
  { code: "pag_Latn", label: "Pangasinan" },
  { code: "pan_Guru", label: "Punjabi", iso: "pa" },
  { code: "pap_Latn", label: "Papiamento" },
  { code: "pes_Arab", label: "Western Persian", iso: "fa" },
  { code: "pol_Latn", label: "Polish", iso: "pl" },
  { code: "por_Latn", label: "Portuguese", iso: "pt" },
  { code: "prs_Arab", label: "Dari" },
  { code: "pbt_Arab", label: "Southern Pashto" },
  { code: "quy_Latn", label: "Ayacucho Quechua" },
  { code: "ron_Latn", label: "Romanian", iso: "ro" },
  { code: "run_Latn", label: "Rundi" },
  { code: "rus_Cyrl", label: "Russian", iso: "ru" },
  { code: "sag_Latn", label: "Sango" },
  { code: "san_Deva", label: "Sanskrit", iso: "sa" },
  { code: "sat_Olck", label: "Santali" },
  { code: "scn_Latn", label: "Sicilian" },
  { code: "shn_Mymr", label: "Shan" },
  { code: "sin_Sinh", label: "Sinhala", iso: "si" },
  { code: "slk_Latn", label: "Slovak", iso: "sk" },
  { code: "slv_Latn", label: "Slovenian", iso: "sl" },
  { code: "smo_Latn", label: "Samoan", iso: "sm" },
  { code: "sna_Latn", label: "Shona", iso: "sn" },
  { code: "snd_Arab", label: "Sindhi", iso: "sd" },
  { code: "som_Latn", label: "Somali", iso: "so" },
  { code: "sot_Latn", label: "Southern Sotho", iso: "st" },
  { code: "spa_Latn", label: "Spanish", iso: "es" },
  { code: "als_Latn", label: "Tosk Albanian" },
  { code: "srd_Latn", label: "Sardinian" },
  { code: "srp_Cyrl", label: "Serbian", iso: "sr" },
  { code: "ssw_Latn", label: "Swati", iso: "ss" },
  { code: "sun_Latn", label: "Sundanese", iso: "su" },
  { code: "swe_Latn", label: "Swedish", iso: "sv" },
  { code: "swh_Latn", label: "Swahili", iso: "sw" },
  { code: "szl_Latn", label: "Silesian" },
  { code: "tam_Taml", label: "Tamil", iso: "ta" },
  { code: "tat_Cyrl", label: "Tatar" },
  { code: "tel_Telu", label: "Telugu", iso: "te" },
  { code: "tgk_Cyrl", label: "Tajik", iso: "tg" },
  { code: "tgl_Latn", label: "Tagalog", iso: "tl" },
  { code: "tha_Thai", label: "Thai", iso: "th" },
  { code: "tir_Ethi", label: "Tigrinya", iso: "ti" },
  { code: "taq_Latn", label: "Tamasheq (Latin)" },
  { code: "taq_Tfng", label: "Tamasheq (Tifinagh)" },
  { code: "tpi_Latn", label: "Tok Pisin" },
  { code: "tsn_Latn", label: "Tswana", iso: "tn" },
  { code: "tso_Latn", label: "Tsonga", iso: "ts" },
  { code: "tuk_Latn", label: "Turkmen", iso: "tk" },
  { code: "tum_Latn", label: "Tumbuka" },
  { code: "tur_Latn", label: "Turkish", iso: "tr" },
  { code: "twi_Latn", label: "Twi" },
  { code: "tzm_Tfng", label: "Central Atlas Tamazight" },
  { code: "uig_Arab", label: "Uyghur", iso: "ug" },
  { code: "ukr_Cyrl", label: "Ukrainian", iso: "uk" },
  { code: "umb_Latn", label: "Umbundu" },
  { code: "urd_Arab", label: "Urdu", iso: "ur" },
  { code: "uzn_Latn", label: "Northern Uzbek", iso: "uz" },
  { code: "vec_Latn", label: "Venetian" },
  { code: "vie_Latn", label: "Vietnamese", iso: "vi" },
  { code: "war_Latn", label: "Waray" },
  { code: "wol_Latn", label: "Wolof", iso: "wo" },
  { code: "xho_Latn", label: "Xhosa", iso: "xh" },
  { code: "ydd_Hebr", label: "Eastern Yiddish", iso: "yi" },
  { code: "yor_Latn", label: "Yoruba", iso: "yo" },
  { code: "yue_Hant", label: "Yue Chinese (Cantonese)" },
  { code: "zho_Hans", label: "Chinese (Simplified)", iso: "zh" },
  { code: "zho_Hant", label: "Chinese (Traditional)" },
  { code: "std_Latn", label: "Standard Latvian" },
  { code: "zsm_Latn", label: "Standard Malay", iso: "ms" },
  { code: "zul_Latn", label: "Zulu", iso: "zu" },
];

// Sort alphabetically by display label
LANGUAGES.sort((a, b) => a.label.localeCompare(b.label));

/** Find a language by its NLLB code. */
export function findLanguage(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

/**
 * Validate that source and target codes are both present in the language list.
 * DETECT_CODE is accepted as a valid source -- detection happens at call time.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateLanguagePair(source: string, target: string): string | null {
  if (source !== DETECT_CODE && !findLanguage(source))
    return `Unknown source language code: "${source}"`;
  if (!findLanguage(target)) return `Unknown target language code: "${target}"`;
  if (source !== DETECT_CODE && source === target)
    return "Source and target languages must be different.";
  return null;
}

/**
 * Split text into sentence-level chunks that each fit within maxChars.
 * Splits on sentence-ending punctuation followed by whitespace, then falls
 * back to word boundaries, then hard-splits if a single word is over-long.
 */
export function splitIntoChunks(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  // Split into paragraphs first to keep them together where possible
  const paragraphs = text.split(/\n{2,}/);
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    // Paragraph itself is too long -- split by sentences
    if (current) {
      chunks.push(current);
      current = "";
    }
    // Split paragraph into sentences
    const sentences = para.match(/[^.!?…]+[.!?…]+\s*/g) ?? [para];
    for (const sent of sentences) {
      if ((current + sent).length <= maxChars) {
        current += sent;
      } else {
        if (current) {
          chunks.push(current.trimEnd());
          current = "";
        }
        // Single sentence over limit: split by words
        if (sent.length <= maxChars) {
          current = sent;
        } else {
          const words = sent.split(/\s+/);
          for (const word of words) {
            if ((current ? `${current} ${word}` : word).length <= maxChars) {
              current = current ? `${current} ${word}` : word;
            } else {
              if (current) chunks.push(current);
              // Single word over maxChars: hard-split
              if (word.length > maxChars) {
                for (let i = 0; i < word.length; i += maxChars) {
                  chunks.push(word.slice(i, i + maxChars));
                }
                current = "";
              } else {
                current = word;
              }
            }
          }
        }
      }
    }
  }
  if (current.trim()) chunks.push(current.trimEnd());
  return chunks.filter((c) => c.trim().length > 0);
}

/** Default source language code */
export const DEFAULT_SOURCE = "eng_Latn";
/** Default target language code */
export const DEFAULT_TARGET = "fra_Latn";

/**
 * Sentinel value for the "Detect language" source option.
 * When this is selected, we try to auto-detect from a short prefix of the input
 * before calling the model.  The actual NLLB src_lang is resolved at translation
 * time and is not stored persistently.
 */
export const DETECT_CODE = "auto";

/** Maximum input characters per chunk when splitting long text */
export const MAX_CHUNK_CHARS = 1500;

/**
 * Soft limit used for the character counter warning.
 * Above this the counter turns amber; above MAX_CHUNK_CHARS it turns red.
 * We still allow translation -- long text is split into chunks automatically.
 */
export const MAX_INPUT_CHARS = MAX_CHUNK_CHARS;

/**
 * Hard ceiling: refuse input longer than this to guard against browser OOM.
 * 50 000 chars is roughly 10 000 words -- generous for a browser tool.
 */
export const HARD_MAX_CHARS = 50_000;
