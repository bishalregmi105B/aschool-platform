"""Preeti and Kantipur legacy 8-bit ANSI to Devanagari Unicode Transcoder.

Many official Nepal CDC textbooks (especially 2076-2082 editions) use legacy
Preeti/Kantipur TrueType fonts where ASCII characters map visually to Devanagari.
This transcoder reliably converts Preeti strings, including positional modifiers
(Hraswa Ikar prefix, Reph postfix, conjuncts, and numerals), into standard UTF-8 Unicode.
"""

import re
from typing import Optional


# Multi-character mappings (must be processed in order of decreasing length)
_MULTI_CHAR_MAP = [
    # Full words / complex ligatures
    ("kf7\\oj|md", "पाठ्यक्रम"),
    (r"kf7\oj|md", "पाठ्यक्रम"),
    ("kf7\\o", "पाठ्य"),
    ("j|md", "क्रम"),
    ("s]Gb|", "केन्द्र"),
    ("s]Gb", "केन्द"),
    ("sIff", "कक्षा"),
    ("dGqfno", "मन्त्रालय"),
    (";/sf/", "सरकार"),
    ("g]kfn", "नेपाल"),
    ("eStk'/", "भक्तपुर"),
    ("ul0ft", "गणित"),
    
    # Vowels
    ("cf]", "ओ"),
    ("cf{", "औ"),
    ("cff", "आ"),
    ("cf", "आ"),
    ("c{", "र्अ"),
    ("c", "अ"),
    ("P]", "ऐ"),
    ("P", "ए"),
    ("O{", "ई"),
    ("O", "इ"),
    ("pm", "ऊ"),
    ("p", "उ"),
    
    # Consonants with virama / conjuncts
    ("0f", "ण"),
    ("km", "फ"),
    ("em", "झ"),
    ("If", "क्ष"),
    ("if", "ष"),
    ("q|", "त्र"),
    ("q", "त्र"),
    ("1", "ज्ञ"),
    ("4", "द्ध"),
    ("2", "द्द"),
    ("å", "द्व"),
    ("Í", "दृ"),
    ("Î", "द्र"),
    
    # Rakar (subjoined ra)
    ("k|", "प्र"),
    ("u|", "ग्र"),
    ("b|", "द्र"),
    ("e|", "भ्र"),
    ("d|", "म्र"),
    (";I", "स्र"),
    (";l", "स्र"),
    (";~", "स्र"),
    (";r", "स्र"),
    (";n", "स्र"),
    (";m", "स्र"),
    (";v", "स्र"),
    (";b", "स्र"),
    (";t", "स्र"),
    (";k", "स्र"),
    (";g", "स्र"),
    (";w", "स्र"),
    (";o", "स्र"),
    (";q", "स्र"),
    (";|", "स्र"),
    ("x|", "ह्र"),
    ("w|", "ध्र"),
    ("z|", "श्र"),
    (">|", "श्र"),
    (">", "श्र"),
    ("r|", "च्र"),
    ("h|", "ज्र"),
    ("n|", "ल्र"),
    ("j|", "व्र"),
    ("t|", "त्र"),
    ("s|", "क्र"),
    
    # Doubled consonants
    ("6\\6", "ट्ट"),
    ("7\\7", "ठ्ठ"),
    ("8\\8", "ड्ड"),
    ("9\\9", "ढ्ढ"),
    ("t\\t", "त्त"),
    ("T", "त्त"),
    ("b\\w", "द्ध"),
    ("b\\b", "द्द"),
    ("b\\e", "द्भ"),
    ("b\\d", "द्म"),
]

# Single character mapping
_SINGLE_CHAR_MAP = {
    # Consonants
    "s": "क", "v": "ख", "u": "ग", "3": "घ", "ª": "ङ",
    "r": "च", "5": "छ", "h": "ज", "~": "ञ",
    "6": "ट", "7": "ठ", "8": "ड", "9": "ढ", "0": "ण्",
    "t": "त", "y": "थ", "b": "द", "w": "ध", "g": "न",
    "k": "प", "a": "ब", "e": "भ", "d": "म",
    "o": "य", "/": "र", "n": "ल", "j": "व",
    "z": "श", ";": "स", "x": "ह",

    # Half consonants (Shift keys)
    "S": "क्", "V": "ख्", "U": "ग्", "C": "च्", "H": "ज्",
    "T": "त्", "Y": "थ्", "B": "द्य", "W": "ध्", "G": "न्",
    "K": "प्", "A": "ब्", "E": "भ्", "D": "म्", "N": "ल्",
    "J": "व्", "Z": "श्", ":": "स्", "X": "ह्", "R": "च्",

    # Vowel signs / Matras
    "f": "ा",  # akar
    "L": "ी",  # dirgha ikar
    "]": "े",  # ekar
    "}": "ै",  # aikar
    "'": "ु",  # hraswa ukar
    "\"": "ू", # dirgha ukar
    "\\": "्", # halant
    
    # Numerals (Shifted and standard in Preeti)
    ")": "०", "!": "१", "@": "२", "#": "३", "$": "४",
    "%": "५", "^": "६", "&": "७", "*": "८", "(": "९",
    
    # Punctuations & modifiers
    "|": "।",  # purna virama / danda
    "+": "ं",  # anusvara
    "F": "ँ",  # chandrabindu
    "M": "ः",  # visarga
    "-": "(",
    "_": ")",
}


def preeti_to_unicode(text: str) -> str:
    """Convert a Preeti/Kantipur encoded string to Devanagari Unicode UTF-8.

    Handles:
    - Multi-character ligatures
    - Hraswa Ikar ('l') prefix repositioning (moves behind consonant cluster)
    - Reph ('{') suffix repositioning (moves as 'र्' before consonant cluster)
    - Punctuation, numerals, and half consonants
    """
    if not text:
        return text

    working = text

    # Step 1: Reposition Hraswa Ikar ('l') in Preeti text
    # In Preeti, 'l' precedes the consonant/cluster, but in Unicode 'ि' follows it.
    # By replacing 'l' directly with '\u093f' (ि) via lambda, we prevent cascading duplicate swaps.
    c_pat = r"[a-km-z0-9]"
    # 0. l + two-character consonant (e.g. l0f -> 0f + ि, lkm -> km + ि, lIf -> If + ि)
    two_char_consonants = ["0f", "km", "em", "If", "if", "sIff"]
    for tc in two_char_consonants:
        working = re.sub(rf"l({tc})", lambda m: m.group(1) + "\u093f", working)
    # 1. l + half-consonant + consonant (with optional rakar)
    working = re.sub(
        rf"l([SVUGHTYBWGKAEDNJZXR:])({c_pat})(\|)?",
        lambda m: m.group(1) + m.group(2) + (m.group(3) or "") + "\u093f",
        working,
    )
    # 2. l + consonant + rakar (e.g. lk|)
    working = re.sub(rf"l({c_pat})(\|)", lambda m: m.group(1) + m.group(2) + "\u093f", working)
    # 3. l + single consonant (e.g. lz -> z + ि, lj -> j + ि)
    working = re.sub(rf"l({c_pat})", lambda m: m.group(1) + "\u093f", working)

    # Step 2: Multi-character replacements
    for preeti_str, unicode_str in _MULTI_CHAR_MAP:
        working = working.replace(preeti_str, unicode_str)

    # Step 3: Map remaining single characters
    chars = []
    single_map = dict(_SINGLE_CHAR_MAP)
    single_map["l"] = "\u093f"  # Hraswa Ikar
    for ch in working:
        chars.append(single_map.get(ch, ch))
    result = "".join(chars)

    # Step 4: Handle Reph ('{')
    # In Preeti, '{' is placed after the consonant, but in Devanagari it represents 'र्' before the consonant.
    result = re.sub(r"\{([क-ह])", lambda m: "र्" + m.group(1), result)
    result = re.sub(r"([क-ह])\{", lambda m: "र्" + m.group(1), result)

    # Step 5: Clean up double matras or displaced halants if any
    result = result.replace("ाे", "ो").replace("ाै", "ौ")
    return result


def is_preeti_encoded(text: str) -> bool:
    """Heuristic detector to identify whether a given text stream is in Preeti encoding.

    Checks for the presence of typical Preeti tokens that do not appear in normal English:
    - 'g]kfn', ';/sf/', 'sIff', 'lzIff', 'lj1fg', 'ul0ft', 'kf7\\o'
    - High frequency of typical Preeti characters with low English dictionary ratio.
    """
    if not text:
        return False

    strong_markers = [
        "g]kfn", ";/sf/", "sIff", "lzIff", "lj1fg", "ul0ft",
        "kf7\\o", r"kf7\oj|md", "dGqfno", "eStk'/", "s]Gb|",
        "xfd|f]", "k|sfzs", ";jf{lwsf/", "ljleGg"
    ]
    for marker in strong_markers:
        if marker in text:
            return True

    # Secondary statistical check: High occurrence of Preeti punctuation / sequences
    preeti_patterns = [
        r"-[s-v]_",      # -s_, -v_ (क, ख options)
        r"[s-z]\][a-z]", # ekar between consonants e.g. g]k
        r"l[s-z]",       # prefix ikar e.g. lz, lj
        r"[s-z]\{[s-z]", # reph between consonants e.g. w{d
    ]
    matches = sum(1 for pat in preeti_patterns if re.search(pat, text))
    return matches >= 2
