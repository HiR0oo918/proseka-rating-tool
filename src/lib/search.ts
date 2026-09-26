const KATAKANA_BLOCK = /[\u30a1-\u30f6]/g;

const HEPBURN_DIGRAPHS: Record<string, string> = {
  きゃ: "kya",
  きぃ: "kyi",
  きゅ: "kyu",
  きぇ: "kye",
  きょ: "kyo",
  ぎゃ: "gya",
  ぎぃ: "gyi",
  ぎゅ: "gyu",
  ぎぇ: "gye",
  ぎょ: "gyo",
  しゃ: "sha",
  しぃ: "shi",
  しゅ: "shu",
  しぇ: "she",
  しょ: "sho",
  じゃ: "ja",
  じぃ: "ji",
  じゅ: "ju",
  じぇ: "je",
  じょ: "jo",
  ちゃ: "cha",
  ちぃ: "chi",
  ちゅ: "chu",
  ちぇ: "che",
  ちょ: "cho",
  ぢゃ: "ja",
  ぢゅ: "ju",
  ぢょ: "jo",
  にゃ: "nya",
  にゅ: "nyu",
  にょ: "nyo",
  ひゃ: "hya",
  ひゅ: "hyu",
  ひょ: "hyo",
  びゃ: "bya",
  びゅ: "byu",
  びょ: "byo",
  ぴゃ: "pya",
  ぴゅ: "pyu",
  ぴょ: "pyo",
  みゃ: "mya",
  みゅ: "myu",
  みょ: "myo",
  りゃ: "rya",
  りゅ: "ryu",
  りょ: "ryo",
  ゔぁ: "va",
  ゔぃ: "vi",
  ゔぇ: "ve",
  ゔぉ: "vo",
  ふぁ: "fa",
  ふぃ: "fi",
  ふぇ: "fe",
  ふぉ: "fo",
  てぃ: "ti",
  でぃ: "di",
  とぅ: "tu",
  どぅ: "du",
  うぃ: "wi",
  うぇ: "we",
  うぉ: "wo",
  つぁ: "tsa",
  つぃ: "tsi",
  つぇ: "tse",
  つぉ: "tso",
};

const KUNREI_DIGRAPHS: Record<string, string> = {
  ...HEPBURN_DIGRAPHS,
  しゃ: "sya",
  しゅ: "syu",
  しぇ: "sye",
  しょ: "syo",
  じゃ: "zya",
  じゅ: "zyu",
  じぇ: "zye",
  じょ: "zyo",
  ちゃ: "tya",
  ちゅ: "tyu",
  ちぇ: "tye",
  ちょ: "tyo",
  ぢゃ: "zya",
  ぢゅ: "zyu",
  ぢょ: "zyo",
};

const HEPBURN_MONO: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  ゐ: "i",
  ゑ: "e",
  を: "wo",
  ん: "n",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "ji",
  づ: "zu",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
  ぁ: "a",
  ぃ: "i",
  ぅ: "u",
  ぇ: "e",
  ぉ: "o",
  ゃ: "ya",
  ゅ: "yu",
  ょ: "yo",
  ゎ: "wa",
  ゔ: "vu",
};

const KUNREI_MONO: Record<string, string> = {
  ...HEPBURN_MONO,
  し: "si",
  ち: "ti",
  つ: "tu",
  ふ: "hu",
  じ: "zi",
  ぢ: "zi",
  を: "o",
};

function toHiragana(text: string): string {
  return text.replace(KATAKANA_BLOCK, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

function firstConsonant(romaji: string): string {
  const match = romaji.match(/^[^aeiou]+/i);
  if (!match) return "";
  if (match[0].startsWith("ch")) return "c";
  return match[0][0] ?? "";
}

function romanize(
  text: string,
  digraphs: Record<string, string>,
  mono: Record<string, string>,
): string {
  const src = toHiragana(text);
  let i = 0;
  let out = "";
  while (i < src.length) {
    const ch = src[i];
    if (ch === "っ") {
      const rest = src.slice(i + 1);
      const next = rest.startsWith("っ")
        ? ""
        : peekMora(rest, digraphs, mono);
      out += firstConsonant(next) || "t";
      i += 1;
      continue;
    }
    if (ch === "ー" || ch === "ｰ") {
      const lastVowel = out.match(/[aeiou]$/i);
      if (lastVowel) out += lastVowel[0];
      i += 1;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two.length === 2 && digraphs[two]) {
      out += digraphs[two];
      i += 2;
      continue;
    }
    if (mono[ch]) {
      out += mono[ch];
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function peekMora(
  src: string,
  digraphs: Record<string, string>,
  mono: Record<string, string>,
): string {
  const two = src.slice(0, 2);
  if (two.length === 2 && digraphs[two]) return digraphs[two];
  const one = src[0];
  if (one && mono[one]) return mono[one];
  return "";
}

function dropLongVowels(romaji: string): string {
  return romaji
    .replaceAll("ou", "o")
    .replaceAll("oo", "o")
    .replaceAll("uu", "u")
    .replaceAll("ii", "i")
    .replaceAll("aa", "a")
    .replaceAll("ee", "e");
}

export function compactSearch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s'\-_.・ーｰ]/g, "");
}

export function searchKey(title: string, pronunciation: string): string {
  const hepburn = compactSearch(
    romanize(pronunciation, HEPBURN_DIGRAPHS, HEPBURN_MONO),
  );
  const titleHepburn = compactSearch(
    romanize(title, HEPBURN_DIGRAPHS, HEPBURN_MONO),
  );
  const kunrei = compactSearch(
    romanize(pronunciation, KUNREI_DIGRAPHS, KUNREI_MONO),
  );
  return [
    compactSearch(title),
    compactSearch(pronunciation),
    hepburn,
    dropLongVowels(hepburn),
    kunrei,
    dropLongVowels(kunrei),
    titleHepburn,
  ]
    .filter(Boolean)
    .join(" ");
}

const keyCache = new Map<string, string>();

export function matchesQuery(
  title: string,
  pronunciation: string,
  query: string,
): boolean {
  const q = compactSearch(query);
  if (!q) return true;
  const cacheKey = `${title}\0${pronunciation}`;
  let key = keyCache.get(cacheKey);
  if (!key) {
    key = searchKey(title, pronunciation);
    keyCache.set(cacheKey, key);
  }
  return key.includes(q);
}
