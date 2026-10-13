/**
 * Minimal Devanagari → IAST transliteration for single Avakahada syllables
 * (an optional consonant plus an optional vowel sign, or an independent vowel).
 * Deterministic and exhaustive for the characters used by the table; any other
 * character throws so an unexpected table edit cannot pass silently.
 */

const CONSONANTS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ṅ",
  च: "c", छ: "ch", ज: "j", झ: "jh", ञ: "ñ",
  ट: "ṭ", ठ: "ṭh", ड: "ḍ", ढ: "ḍh", ण: "ṇ",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", व: "v",
  श: "ś", ष: "ṣ", स: "s", ह: "h",
};

const INDEPENDENT_VOWELS: Record<string, string> = {
  अ: "a", आ: "ā", इ: "i", ई: "ī", उ: "u", ऊ: "ū", ए: "e", ऐ: "ai", ओ: "o", औ: "au",
};

const VOWEL_SIGNS: Record<string, string> = {
  "ा": "ā", "ि": "i", "ी": "ī", "ु": "u", "ू": "ū", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};

export function devanagariSyllableToIast(syllable: string): string {
  const chars = [...syllable.normalize("NFC")];
  if (chars.length === 1 && INDEPENDENT_VOWELS[chars[0]]) return INDEPENDENT_VOWELS[chars[0]];
  const consonant = CONSONANTS[chars[0]];
  if (!consonant) throw new Error(`Unsupported Devanagari syllable: ${syllable}`);
  if (chars.length === 1) return `${consonant}a`;
  if (chars.length === 2 && VOWEL_SIGNS[chars[1]]) return consonant + VOWEL_SIGNS[chars[1]];
  throw new Error(`Unsupported Devanagari syllable: ${syllable}`);
}
