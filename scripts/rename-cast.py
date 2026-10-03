# -*- coding: utf-8 -*-
"""
Rename the recurring cast in content/ and in the one hard-coded sample.

Why a script and not a find-replace
-----------------------------------
Three things make a blind replace wrong here:

1. عمر is both the name "Omar" and the noun "age". «كم عمر عمر؟» is
   "how old is Omar?" — the first word must survive, the second must
   change. The name is always a bare token (optionally prefixed by و
   or ل); the noun carries a suffix (عمري، عمره، عمرها) or the article
   (العمر). The three places where the bare noun precedes another word
   are listed below and handled by hand.

2. The new names are already in use. Omar's three-year-old daughter is
   Lina and Khaled's brother is Sami, both in week 1. They are renamed
   first, so the leads can take those names without a collision.

3. Peter Gabriel in week 22 is a musician, not a character. Nothing in
   here touches Peter.

Order matters: freeing a name must happen before that name is taken.
"""
import io, re, sys, glob, os

DRY = "--apply" not in sys.argv

# ── step 1+2: free the two names, by renaming their current holders ──
FREEING = [
    # Omar's daughter (week 1 listening/reading) — frees "Lina"
    ("Lina", "Salma"), ("LINA", "SALMA"), ("لينا", "سلمى"),
    # Khaled's brother (week 1 model answer) — frees "Sami"
    ("Sami", "Ziad"), ("SAMI", "ZIAD"), ("سامي", "زياد"),
]

# ── step 3: bare عمر meaning "age", not the name ──────────────────
# Each is (exact phrase found in content, what it becomes).
AGE_PHRASES = [
    ("كم عمر عمر؟",            "كم عمر سامي؟"),     # age + name
    ("كم عمر طلابها؟",         "كم عمر طلابها؟"),   # age only
    ("واكتب عمر كل شخص",       "واكتب عمر كل شخص"), # age only
]

# ── step 4+5: the leads ───────────────────────────────────────────
LEADS = [
    ("Omar", "Sami"), ("OMAR", "SAMI"),
    ("Sara", "Lina"), ("SARA", "LINA"), ("سارة", "لينا"),
]

LATIN = r'(?<![A-Za-z])%s(?![A-Za-z])'
# Arabic LETTERS, not the whole Arabic block.
#
# The first version used \u0600-\u06FF, which also holds ، ؛ and ؟ — so
# «مرحباً عمر،» and «كم طفلاً لعمر؟» read as one long word and were left
# untouched. Punctuation has to end a token.
ARL = r'\u0621-\u063A\u0640-\u0652\u0670-\u06D3'

# A bare token, optionally prefixed by و or ل. Only those two occur in
# the content; allowing ب would also match «بعمر ٢٠» = "aged 20".
ARABIC_NAME = re.compile(r'(?<![' + ARL + r'])([ول]?)عمر(?![' + ARL + r'])')
# Arabic names take the same و/ل prefixes as عمر does. Without this
# group, «وسارة» and «ولينا» are invisible to the rule — which is
# exactly what a first run left behind in six places.
ARABIC = r'(?<![' + ARL + r'])([ول]?)%s(?![' + ARL + r'])'


def convert(text: str) -> tuple[str, int]:
    n = 0

    for old, new in FREEING:
        pat = (LATIN if old.isascii() else ARABIC) % re.escape(old)
        text, k = re.subn(pat, (r'' + new) if not old.isascii() else new, text)
        n += k

    # park the age phrases so the bare-token rule cannot see them
    marks = {}
    for i, (phrase, becomes) in enumerate(AGE_PHRASES):
        mark = f"\x00AGE{i}\x00"
        if phrase in text:
            marks[mark] = becomes
            text = text.replace(phrase, mark)

    for old, new in LEADS:
        pat = (LATIN if old.isascii() else ARABIC) % re.escape(old)
        text, k = re.subn(pat, (r'' + new) if not old.isascii() else new, text)
        n += k

    text, k = ARABIC_NAME.subn(lambda m: m.group(1) + "سامي", text)
    n += k

    for mark, becomes in marks.items():
        text = text.replace(mark, becomes)

    return text, n


targets = sorted(glob.glob("content/*.json")) + ["resources/js/Pages/Setup.tsx"]
total = 0

for path in targets:
    before = io.open(path, encoding="utf-8", newline="").read()
    after, n = convert(before)
    if before == after:
        continue
    total += n
    print(f"  {os.path.basename(path):24s} {n:4d} استبدالاً")
    if not DRY:
        io.open(path, "w", encoding="utf-8", newline="").write(after)

print(f"\nالمجموع: {total}" + ("  (تجربة جافّة — لم يُكتب شيء)" if DRY else "  (كُتبت)"))
