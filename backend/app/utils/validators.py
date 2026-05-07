"""Validation helpers for Nepal-specific formats."""
import re


def validate_nepal_phone(phone: str) -> bool:
    """Validate Nepali phone number: +977XXXXXXXXXX or 98XXXXXXXX."""
    pattern = r"^(\+977)?9[78]\d{8}$"
    return bool(re.match(pattern, phone.replace(" ", "").replace("-", "")))


def validate_email(email: str) -> bool:
    """Basic email validation."""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def normalize_phone(phone: str) -> str:
    """Normalize to +977XXXXXXXXXX format."""
    phone = phone.replace(" ", "").replace("-", "")
    if phone.startswith("0"):
        phone = phone[1:]
    if not phone.startswith("+977"):
        if phone.startswith("977"):
            phone = "+" + phone
        else:
            phone = "+977" + phone
    return phone


def validate_pan(pan: str) -> bool:
    """Validate Nepal PAN number (9 digits)."""
    return bool(re.match(r"^\d{9}$", pan.strip()))


def validate_bs_date(date_str: str) -> bool:
    """Validate BS date format: YYYY-MM-DD."""
    pattern = r"^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[0-2])$"
    return bool(re.match(pattern, date_str))
