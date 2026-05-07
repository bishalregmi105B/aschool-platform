"""Nepali number utilities — convert between Arabic and Devanagari numerals."""


NEPALI_DIGITS = "०१२३४५६७८९"
ARABIC_DIGITS = "0123456789"

_TO_NEPALI = str.maketrans(ARABIC_DIGITS, NEPALI_DIGITS)
_TO_ARABIC = str.maketrans(NEPALI_DIGITS, ARABIC_DIGITS)


def to_nepali(number) -> str:
    """Convert Arabic numerals to Nepali Devanagari numerals.

    >>> to_nepali(12345)
    '१२३४५'
    >>> to_nepali("2081/02/15")
    '२०८१/०२/१५'
    """
    return str(number).translate(_TO_NEPALI)


def to_arabic(text: str) -> str:
    """Convert Nepali Devanagari numerals to Arabic numerals.

    >>> to_arabic("१२३४५")
    '12345'
    """
    return text.translate(_TO_ARABIC)


def to_nepali_int(text: str) -> int:
    """Convert Nepali numeral string to Python int.

    >>> to_nepali_int("१२३")
    123
    """
    return int(to_arabic(text))


def format_nepali_currency(amount: float, symbol: str = "रू") -> str:
    """Format a number as Nepali currency with Devanagari digits.

    >>> format_nepali_currency(12500.50)
    'रू १२,५००.५०'
    """
    # Format with commas (Nepali style: 1,00,000)
    integer_part = int(amount)
    decimal_part = round(amount - integer_part, 2)

    s = str(integer_part)
    if len(s) > 3:
        # First 3 digits from right, then groups of 2
        result = s[-3:]
        s = s[:-3]
        while s:
            result = s[-2:] + "," + result
            s = s[:-2]
    else:
        result = s

    if decimal_part:
        decimal_str = f"{decimal_part:.2f}"[2:]  # "0.50" -> "50"
        formatted = f"{symbol} {result}.{decimal_str}"
    else:
        formatted = f"{symbol} {result}"

    return to_nepali(formatted)


def nepali_ordinal(n: int) -> str:
    """Return Nepali ordinal string.

    >>> nepali_ordinal(1)
    'पहिलो'
    """
    ordinals = {
        1: "पहिलो", 2: "दोस्रो", 3: "तेस्रो", 4: "चौथो", 5: "पाँचौं",
        6: "छैठौं", 7: "सातौं", 8: "आठौं", 9: "नवौं", 10: "दशौं",
    }
    return ordinals.get(n, f"{to_nepali(n)}औं")


def nepali_month_name(month: int) -> str:
    """Return Nepali BS month name (1-indexed)."""
    months = [
        "", "बैशाख", "जेठ", "असार", "श्रावण", "भदौ", "असोज",
        "कार्तिक", "मंसिर", "पुष", "माघ", "फाल्गुन", "चैत",
    ]
    return months[month] if 1 <= month <= 12 else ""


def nepali_day_name(day: int) -> str:
    """Return Nepali day-of-week name (0=Sunday)."""
    days = ["आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"]
    return days[day % 7]
