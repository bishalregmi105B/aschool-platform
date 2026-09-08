"""Unit tests for Preeti to Unicode Transcoder."""

import pytest
from app.utils.preeti_transcoder import preeti_to_unicode, is_preeti_encoded


class TestPreetiTranscoder:
    """Test suite for Preeti/Kantipur legacy font transcoder."""

    def test_basic_word_conversion(self):
        """Verify basic words without complex conjuncts."""
        assert preeti_to_unicode("g]kfn") == "नेपाल"
        assert preeti_to_unicode(";/sf/") == "सरकार"
        assert preeti_to_unicode("ul0ft") == "गणित"
        assert preeti_to_unicode("sIff") == "कक्षा"

    def test_hraswa_ikar_prefix_repositioning(self):
        """Verify that 'l' before consonants reposition correctly after the consonant."""
        assert preeti_to_unicode("lzIff") == "शिक्षा"
        assert preeti_to_unicode("lj1fg") == "विज्ञान"
        assert preeti_to_unicode("ljsf;") == "विकास"
        assert preeti_to_unicode("l:ylt") == "स्थिति"
        assert preeti_to_unicode("lk|") == "प्रि"
        assert preeti_to_unicode("k|ljlw") == "प्रविधि"

    def test_complex_phrases_from_cdc_textbooks(self):
        """Verify standard CDC publication metadata strings."""
        sample_ministry = "lzIff, lj1fg tyf k|ljlw dGqfno"
        assert preeti_to_unicode(sample_ministry) == "शिक्षा, विज्ञान तथा प्रविधि मन्त्रालय"

        sample_cdc = "kf7\\oj|md ljsf; s]Gb|"
        assert preeti_to_unicode(sample_cdc) == "पाठ्यक्रम विकास केन्द्र"

        sample_location = ";fgf]l7dL, eStk'/"
        assert preeti_to_unicode(sample_location) == "सानोठिमी, भक्तपुर"

    def test_numerals_conversion(self):
        """Verify standard Preeti numeral mappings."""
        assert preeti_to_unicode("!)") == "१०"
        assert preeti_to_unicode("@)*)") == "२०८०"
        assert preeti_to_unicode("!@#$%^&*()") == "१२३४५६७८९०"

    def test_punctuation_and_options(self):
        """Verify Danda and question option labels."""
        assert preeti_to_unicode("-s_") == "(क)"
        assert preeti_to_unicode("-v_") == "(ख)"
        assert preeti_to_unicode("-u_") == "(ग)"
        assert preeti_to_unicode("|") == "।"

    def test_detector(self):
        """Verify that Preeti text is accurately recognized while English is not."""
        assert is_preeti_encoded("g]kfn ;/sf/ lzIff, lj1fg tyf k|ljlw dGqfno") is True
        assert is_preeti_encoded("This is an English textbook about Physics and Chemistry.") is False
        assert is_preeti_encoded("Secondary Education Examination Class 10 Compulsory Mathematics") is False
