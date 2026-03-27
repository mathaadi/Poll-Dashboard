export type Sentiment = "positive" | "negative" | "suggestion" | "neutral";

const JUNK_EXACT = new Set([
  "good", "fine", "ok", "okay", "nice", "great", "n/a", "na", "no",
  "yes", "nothing", "none", "nope", "no comments", "no comment", "no issues",
  "good session", "nice session", "great session", "very good", "very nice",
  "all good", "all fine", "everything is fine", "everything was good",
  "no feedback", "nothing to say", "...", "..", ".", "-", "nil",
  "thank you", "thanks", "good class", "great class", "excellent",
  "amazing", "wonderful", "nice class", "no doubt", "all good .",
]);

const JUNK_PREFIXES = [
  "good", "great", "nice", "all good", "thank", "amazing", "wonderful",
];

export function isUsefulFeedback(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const cleaned = text.trim().toLowerCase().replace(/[.!?]+$/, "").trim();

  // Too short (3 words or less)
  if (cleaned.split(/\s+/).length <= 3) return false;

  // Junk exact match
  if (JUNK_EXACT.has(cleaned)) return false;

  // Repeated characters (e.g. "......", "!!!")
  if (/^(.)\1{4,}$/.test(cleaned)) return false;

  // Single letter
  if (cleaned.length <= 2) return false;

  return true;
}

const NEGATIVE_WORDS = [
  "bad", "poor", "worst", "terrible", "horrible", "boring", "waste",
  "confusing", "confused", "unclear", "didn't understand", "hard to follow",
  "too fast", "very fast", "breaking", "broke", "lag", "lagging", "disconnected",
  "camera off", "no camera", "camera was off", "zero interaction", "no interaction",
  "not clear", "not good", "not helpful", "not engaging", "slow", "too slow",
  "couldn't hear", "audio issue", "voice breaking", "mic issue", "network issue",
  "not understand", "poor quality", "change the teacher", "change teacher",
  "need iit faculty", "iit faculty",
];

const POSITIVE_WORDS = [
  "excellent", "amazing", "wonderful", "fantastic", "love", "loved",
  "great explanation", "well explained", "very clear", "very helpful", "interesting",
  "engaging", "informative", "knowledgeable", "perfect", "outstanding", "superb",
  "really helpful", "very informative", "thoroughly explained", "best session",
  "great session", "enjoyed", "interactive", "very engaging", "crystal clear",
  "very good", "cooperative", "very cooperative", "good explanation",
];

const SUGGESTION_PATTERNS = [
  "please", "could you", "can you", "should", "would be better", "suggest",
  "improve", "improvement", "try to", "recommend", "need", "more", "less",
  "faster", "slower", "add", "include", "provide", "make", "use more",
  "ppt", "slides", "whiteboard", "notes", "recording", "resources",
  "pace", "speed up", "slow down", "question", "practice", "example",
];

export function classifySentiment(text: string): Sentiment {
  const t = text.toLowerCase();

  const hasNegative = NEGATIVE_WORDS.some((w) => t.includes(w));
  const hasPositive = POSITIVE_WORDS.some((w) => t.includes(w));
  const hasSuggestion = SUGGESTION_PATTERNS.some((w) => t.includes(w));

  if (hasNegative && !hasPositive) return "negative";
  if (hasSuggestion && !hasNegative) return "suggestion";
  if (hasPositive && !hasNegative && !hasSuggestion) return "positive";
  if (hasNegative && hasSuggestion) return "negative";
  return "neutral";
}

const THEME_PATTERNS: Array<{ theme: string; patterns: string[] }> = [
  { theme: "pace", patterns: ["pace", "fast", "slow", "speed", "quick", "rush"] },
  { theme: "content", patterns: ["content", "topic", "material", "syllabus", "curriculum", "subject matter"] },
  { theme: "audio", patterns: ["audio", "voice", "sound", "mic", "microphone", "breaking", "hear", "volume"] },
  { theme: "video", patterns: ["video", "camera", "screen", "visual", "share screen"] },
  { theme: "explanation", patterns: ["explain", "explanation", "clarity", "clear", "understand", "comprehend"] },
  { theme: "network", patterns: ["network", "connection", "internet", "lag", "disconnect", "buffering"] },
  { theme: "slides", patterns: ["slide", "ppt", "presentation", "powerpoint"] },
  { theme: "whiteboard", patterns: ["whiteboard", "board", "diagram", "drawing"] },
  { theme: "interaction", patterns: ["interact", "question", "q&a", "doubt", "chat", "engage", "participation"] },
  { theme: "resources", patterns: ["resource", "material", "notes", "book", "reference", "recording"] },
  { theme: "timing", patterns: ["time", "timing", "duration", "short", "long", "session length"] },
];

export function classifyThemes(text: string): string[] {
  const t = text.toLowerCase();
  return THEME_PATTERNS
    .filter((tp) => tp.patterns.some((p) => t.includes(p)))
    .map((tp) => tp.theme);
}

export function analyzeResponses(feedbackTexts: string[]): {
  useful_feedback: string[];
  sentiments: Sentiment[];
  themes: string[][];
} {
  const useful_feedback: string[] = [];
  const sentiments: Sentiment[] = [];
  const themes: string[][] = [];

  for (const text of feedbackTexts) {
    if (isUsefulFeedback(text)) {
      useful_feedback.push(text);
      sentiments.push(classifySentiment(text));
      themes.push(classifyThemes(text));
    }
  }

  return { useful_feedback, sentiments, themes };
}
