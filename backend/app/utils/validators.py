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


def validate_password_strength(password: str) -> tuple[bool, str]:
    """ASchool password policy for user-chosen passwords.

    Minimum 8 characters with at least one uppercase letter, one lowercase
    letter and one digit. (System-generated default passwords are exempt —
    they are issued by the school and contain the EMIS id.)

    Returns (ok, error_message).
    """
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    return True, ""
