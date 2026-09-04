"""D-06 money helpers — Decimal arithmetic for every fee/payroll amount.

`float` binary arithmetic cannot represent 0.1 sums: fee totals, discounts
and payroll taxed amounts accumulated cents-errors across the codebase.
Rule: money enters as float/str from APIs, is computed ONLY through these
helpers, and leaves rounded to 2dp (NPR paisa precision).
"""
from decimal import ROUND_HALF_UP, Decimal

TWO_PLACES = Decimal("0.01")


def to_decimal(value) -> Decimal:
    """Convert any incoming numeric to Decimal safely."""
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        # str() avoids the float binary-representation artifacts
        return Decimal(str(value))
    return Decimal(str(value))


def money(value) -> Decimal:
    """Round to 2dp, half-up (Nepali accounting convention)."""
    return to_decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def add(*values) -> Decimal:
    return money(sum((to_decimal(v) for v in values), Decimal("0")))


def sub(a, b) -> Decimal:
    return money(to_decimal(a) - to_decimal(b))


def mul(amount, factor) -> Decimal:
    return money(to_decimal(amount) * to_decimal(factor))


def pct(amount, percent) -> Decimal:
    """percent of amount (e.g. 13% VAT)."""
    return money(to_decimal(amount) * to_decimal(percent) / Decimal("100"))


def net_payable(base, late_fine=0, discount=0) -> Decimal:
    """One definition of fee net payable: base + fine − discount, floored 0."""
    return money(max(to_decimal(base) + to_decimal(late_fine) - to_decimal(discount), Decimal("0")))


def split_vat_inclusive(gross, vat_rate) -> tuple[Decimal, Decimal]:
    """IRD-style VAT-inclusive split: returns (net, vat)."""
    gross_d = to_decimal(gross)
    vat = money(gross_d - gross_d / (Decimal("1") + to_decimal(vat_rate) / Decimal("100")))
    return money(gross_d - vat), vat


# ── N-04: fee-cap directive (MoEST 2072) heading classification ─────────

# The 14 directive headings a private school may charge under (decree cap);
# every FeeStructureItem should classify into one for the CEHRD report.
FEE_CAP_HEADINGS = (
    "tuition_fee",
    "admission_fee",
    "annual_charge",
    "laboratory_charge",
    "library_charge",
    "examination_charge",
    "sports_culture_charge",
    "computer_charge",
    "electricity_water_charge",
    "first_aid_charge",
    "transport_charge",
    "hostel_charge",
    "development_charge",
    "other_charge",
)

# Keywords → heading (first match wins; Nepali aliases included)
_FEE_CAP_KEYWORDS = (
    ("tuition", "tuition_fee"),
    ("शिक्षण शुल्क", "tuition_fee"),
    ("admission", "admission_fee"),
    ("भर्ना", "admission_fee"),
    ("annual", "annual_charge"),
    ("lab", "laboratory_charge"),
    ("प्रयोगशाला", "laboratory_charge"),
    ("library", "library_charge"),
    ("पुस्तकालय", "library_charge"),
    ("exam", "examination_charge"),
    ("परीक्षा", "examination_charge"),
    ("sport", "sports_culture_charge"),
    ("खेलकुद", "sports_culture_charge"),
    ("computer", "computer_charge"),
    ("कम्प्युटर", "computer_charge"),
    ("electricity", "electricity_water_charge"),
    ("water", "electricity_water_charge"),
    ("बिजुली", "electricity_water_charge"),
    ("first aid", "first_aid_charge"),
    ("transport", "transport_charge"),
    ("यातायात", "transport_charge"),
    ("hostel", "hostel_charge"),
    ("छात्रावास", "hostel_charge"),
    ("development", "development_charge"),
)


def classify_fee_cap_heading(name: str) -> str:
    """Classify a fee-head name into one of the 14 directive headings."""
    lowered = (name or "").lower()
    for keyword, heading in _FEE_CAP_KEYWORDS:
        if keyword in lowered:
            return heading
    return "other_charge"
