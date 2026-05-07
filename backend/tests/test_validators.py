"""Tests for Nepal-specific validators."""
from app.utils.validators import (
    normalize_phone,
    validate_bs_date,
    validate_email,
    validate_nepal_phone,
    validate_pan,
)


class TestValidateNepalPhone:
    def test_valid_with_country_code(self):
        assert validate_nepal_phone("+9779841000001") is True

    def test_valid_without_country_code(self):
        assert validate_nepal_phone("9841000001") is True

    def test_valid_with_98_prefix(self):
        assert validate_nepal_phone("9812345678") is True

    def test_valid_with_97_prefix(self):
        assert validate_nepal_phone("9712345678") is True

    def test_invalid_us_number(self):
        assert validate_nepal_phone("+12025551234") is False

    def test_invalid_too_short(self):
        assert validate_nepal_phone("984100") is False

    def test_invalid_too_long(self):
        assert validate_nepal_phone("984100000000") is False

    def test_strips_spaces(self):
        assert validate_nepal_phone("98 4100 0001") is True

    def test_strips_dashes(self):
        assert validate_nepal_phone("984-100-0001") is True


class TestNormalizePhone:
    def test_adds_country_code(self):
        assert normalize_phone("9841000001") == "+9779841000001"

    def test_already_has_plus_977(self):
        assert normalize_phone("+9779841000001") == "+9779841000001"

    def test_has_977_without_plus(self):
        assert normalize_phone("9779841000001") == "+9779841000001"

    def test_strips_leading_zero(self):
        assert normalize_phone("09841000001") == "+9779841000001"


class TestValidateEmail:
    def test_valid_email(self):
        assert validate_email("user@example.com") is True

    def test_valid_subdomain_email(self):
        assert validate_email("admin@school.edu.np") is True

    def test_invalid_no_at(self):
        assert validate_email("userexample.com") is False

    def test_invalid_no_domain(self):
        assert validate_email("user@") is False

    def test_invalid_empty(self):
        assert validate_email("") is False


class TestValidatePAN:
    def test_valid_pan(self):
        assert validate_pan("123456789") is True

    def test_invalid_pan_too_short(self):
        assert validate_pan("12345") is False

    def test_invalid_pan_letters(self):
        assert validate_pan("12345678A") is False


class TestValidateBSDate:
    def test_valid_bs_date(self):
        assert validate_bs_date("2081-01-15") is True

    def test_valid_bs_date_edge(self):
        assert validate_bs_date("2080-12-32") is True

    def test_invalid_bs_date_format(self):
        assert validate_bs_date("2081/01/15") is False

    def test_invalid_bs_date_month13(self):
        assert validate_bs_date("2081-13-01") is False
