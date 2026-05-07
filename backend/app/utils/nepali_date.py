"""Bikram Sambat ↔ AD date conversion utilities."""
import nepali_datetime
from datetime import date, datetime


def ad_to_bs(ad_date: date | datetime) -> str:
    """Convert AD date to BS string (YYYY-MM-DD)."""
    if isinstance(ad_date, datetime):
        ad_date = ad_date.date()
    bs = nepali_datetime.date.from_datetime_date(ad_date)
    return bs.strftime("%Y-%m-%d")


def bs_to_ad(bs_str: str) -> date:
    """Convert BS string (YYYY-MM-DD) to AD date."""
    parts = bs_str.split("-")
    bs_date = nepali_datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
    return bs_date.to_datetime_date()


def today_bs() -> str:
    """Get today's date in BS."""
    return nepali_datetime.date.today().strftime("%Y-%m-%d")


def current_month_bs() -> str:
    """Get current BS month name in Nepali."""
    return nepali_datetime.date.today().strftime("%B")


def current_year_bs() -> str:
    """Get current BS year."""
    return str(nepali_datetime.date.today().year)


def format_bs_nepali(bs_str: str) -> str:
    """Format BS date to Nepali display: '२०८१ माघ १५'."""
    parts = bs_str.split("-")
    bs_date = nepali_datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
    return bs_date.strftime("%K %N %e")  # Nepali Unicode format
