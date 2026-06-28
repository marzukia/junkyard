1|/**
import { clamp } from "@junkyardsh/ui";
2| * Pure text-processing helpers, no DOM side-effects, easily unit-tested.
3| */
4|
5|// DistilBART CNN 6-6 max encoder tokens; conservative word estimate (0.75 tokens/word).
6|export const MODEL_MAX_WORDS = Math.floor(1024 * 0.75); // 768
7|
8|/**
9| * A short sample article (public domain) used for the "Try sample" button.
10| * Keeps the empty-state from being a blank wall.
11| */
12|export const SAMPLE_TEXT =
13|  "The Great Barrier Reef, located off the coast of Queensland in northeastern Australia, " +
14|  "is the world's largest coral reef system, stretching over 2,300 kilometres. " +
15|  "Composed of over 2,900 individual reefs and 900 islands, it is so large that it can be seen from outer space. " +
16|  "The reef supports an extraordinary variety of life, including more than 1,500 species of fish, " +
17|  "4,000 types of mollusc, and 240 species of birds. " +
18|  "It was designated a UNESCO World Heritage Site in 1981 and is considered one of the seven natural wonders of the world. " +
19|  "However, the reef faces serious threats from climate change, particularly ocean warming and acidification, " +
20|  "which cause coral bleaching. Mass bleaching events in 2016, 2017, 2020, 2022, and 2024 killed or damaged " +
21|  "large sections of the reef. Pollution and runoff from agricultural land also contribute to its decline. " +
22|  "Scientists and conservationists are working on interventions such as coral restoration, selective breeding " +
23|  "for heat tolerance, and reduced carbon emissions, but many warn that without urgent global action to " +
24|  "limit warming to 1.5 degrees Celsius, much of the reef could be lost within decades.";
25|
26|/** Count words in a string (whitespace-delimited). */
27|export function countWords(text: string): number {
28|  const trimmed = text.trim();
29|  if (!trimmed) return 0;
30|  return trimmed.split(/\s+/).length;
31|}
32|
33|/** Format a word count for display, e.g. "1,234 words". */
34|export function formatWordCount(count: number): string {
35|  if (count === 1) return "1 word";
36|  return `${count.toLocaleString()} words`;
37|}
38|
39|/**
40| * Compute the percentage reduction from input words to output words.
41| * Returns a string like "72% shorter".
42| */
43|export function formatReduction(inputWords: number, outputWords: number): string {
44|  if (inputWords <= 0 || outputWords >= inputWords) return "";
45|  const pct = Math.round(((inputWords - outputWords) / inputWords) * 100);
46|  return `${pct}% shorter`;
47|}
48|
49|/** Format a download progress fraction as a percentage string. */
50|export function formatProgress(loaded: number, total: number): string {
51|  if (total <= 0) return "0%";
52|  const pct = Math.min(100, Math.round((loaded / total) * 100));
53|  return `${pct}%`;
54|}
55|
56|/**
57| * Clamp a number between min and max (inclusive).
58| */
59|export function clamp(value: number, min: number, max: number): number {
60|  return Math.min(max, Math.max(min, value));
61|}
62|
63|/**
64| * Given a slider position (0–100), map to a max-word target.
65| * Positions map to: short (50), medium (100), long (200), very long (300).
66| */
67|export function sliderToMaxWords(position: number): number {
68|  if (position <= 25) return Math.round(30 + (position / 25) * (50 - 30));
69|  if (position <= 50) return Math.round(50 + ((position - 25) / 25) * (100 - 50));
70|  if (position <= 75) return Math.round(100 + ((position - 50) / 25) * (200 - 100));
71|  return Math.round(200 + ((position - 75) / 25) * (300 - 200));
72|}
73|
74|/**
75| * Given a max-word target, derive a sensible min-word target
76| * (roughly 40% of max, never below 10).
77| */
78|export function maxWordsToMin(maxWords: number): number {
79|  return Math.max(10, Math.round(maxWords * 0.4));
80|}
81|
82|/** Human-readable label for a given max-word count. */
83|export function lengthLabel(maxWords: number): string {
84|  if (maxWords <= 50) return "Brief";
85|  if (maxWords <= 100) return "Medium";
86|  if (maxWords <= 200) return "Detailed";
87|  return "Full";
88|}
89|
90|/**
91| * Common abbreviations that end with a period but are NOT sentence boundaries.
92| * Checked case-insensitively against the lowercased word (including its trailing dot).
93| */
94|const ABBREVS: ReadonlySet<string> = new Set([
95|  "dr.",
96|  "mr.",
97|  "mrs.",
98|  "ms.",
99|  "prof.",
100|  "sr.",
101|  "jr.",
102|  "e.g.",
103|  "i.e.",
104|  "etc.",
105|  "vs.",
106|  "inc.",
107|  "corp.",
108|  "ltd.",
109|  "dept.",
110|  "approx.",
111|]);
112|
113|/** Return true if `word` is a known abbreviation that should not split a sentence. */
114|function isAbbreviation(word: string): boolean {
115|  return ABBREVS.has(word.toLowerCase());
116|}
117|
118|/**
119| * Split text into chunks that each fit within MODEL_MAX_WORDS.
120| * Splits on sentence boundaries where possible (". ", "! ", "? ").
121| * Known abbreviations (Dr., e.g., etc.) are not treated as boundaries.
122| * Returns an array of non-empty chunk strings.
123| */
124|export function chunkText(text: string, maxWordsPerChunk: number = MODEL_MAX_WORDS): string[] {
125|  if (!text.trim()) return [];
126|  const words = text.trim().split(/\s+/);
127|  if (words.length <= maxWordsPerChunk) return [text.trim()];
128|
129|  const chunks: string[] = [];
130|  let start = 0;
131|
132|  while (start < words.length) {
133|    const end = Math.min(start + maxWordsPerChunk, words.length);
134|    // Try to find a sentence boundary to break on (within last 15% of the chunk).
135|    const slice = words.slice(start, end);
136|    let breakAt = slice.length;
137|
138|    if (end < words.length) {
139|      // Walk backwards to find a word ending a sentence.
140|      const lookback = Math.max(1, Math.floor(slice.length * 0.85));
141|      for (let i = slice.length - 1; i >= lookback; i--) {
142|        const w = slice[i];
143|        if (/[.!?]$/.test(w) && !isAbbreviation(w)) {
144|          breakAt = i + 1;
145|          break;
146|        }
147|      }
148|    }
149|
150|    const chunk = words.slice(start, start + breakAt).join(" ");
151|    if (chunk) chunks.push(chunk);
152|    start += breakAt;
153|  }
154|
155|  return chunks;
156|}
157|
158|/**
159| * Returns whether text is long enough that it needs chunked processing.
160| */
161|export function needsChunking(text: string): boolean {
162|  return countWords(text) > MODEL_MAX_WORDS;
163|}
164|
165|/**
166| * Attempt to extract plain text from an HTML string.
167| * Removes script/style tags and collapses whitespace.
168| */
169|export function extractTextFromHtml(html: string): string {
170|  // Remove script and style blocks
171|  const cleaned = html
172|    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
173|    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
174|    .replace(/<[^>]+>/g, " ")
175|    .replace(/&nbsp;/gi, " ")
176|    .replace(/&amp;/gi, "&")
177|    .replace(/&lt;/gi, "<")
178|    .replace(/&gt;/gi, ">")
179|    .replace(/&quot;/gi, '"')
180|    .replace(/&#39;/gi, "'")
181|    .replace(/\s{2,}/g, " ")
182|    .trim();
183|  return cleaned;
184|}
185|