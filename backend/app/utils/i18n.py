"""Internationalization helpers — Nepali + English bilingual support."""

# ── Nepali UI Labels ──────────────────────────────────────────────────────

NE = {
    # Navigation
    "dashboard": "ड्यासबोर्ड",
    "students": "विद्यार्थीहरू",
    "teachers": "शिक्षकहरू",
    "staff": "कर्मचारीहरू",
    "attendance": "उपस्थिति",
    "exams": "परीक्षा",
    "fees": "शुल्क",
    "library": "पुस्तकालय",
    "transport": "यातायात",
    "notices": "सूचनाहरू",
    "reports": "प्रतिवेदन",
    "settings": "सेटिङहरू",

    # Academic
    "class": "कक्षा",
    "section": "खण्ड",
    "roll_no": "रोल नं",
    "subject": "विषय",
    "marks": "अंक",
    "grade": "ग्रेड",
    "result": "नतिजा",
    "pass": "उत्तीर्ण",
    "fail": "अनुत्तीर्ण",
    "rank": "रैंक",

    # Actions
    "add": "थप्नुहोस्",
    "edit": "सम्पादन",
    "delete": "मेटाउनुहोस्",
    "save": "सेभ गर्नुहोस्",
    "cancel": "रद्द गर्नुहोस्",
    "search": "खोज्नुहोस्",
    "filter": "फिल्टर",
    "export": "निर्यात",
    "import": "आयात",
    "print": "प्रिन्ट",
    "download": "डाउनलोड",

    # Status
    "present": "उपस्थित",
    "absent": "अनुपस्थित",
    "late": "ढिलो",
    "active": "सक्रिय",
    "inactive": "निष्क्रिय",
    "pending": "विचाराधीन",
    "approved": "स्वीकृत",
    "rejected": "अस्वीकृत",
    "paid": "भुक्तानी भयो",
    "unpaid": "भुक्तानी बाँकी",

    # Fee
    "total_fee": "कुल शुल्क",
    "paid_amount": "भुक्तानी रकम",
    "due_amount": "बाँकी रकम",
    "discount": "छुट",
    "fine": "जरिवाना",
    "receipt": "रसिद",

    # Common
    "name": "नाम",
    "father_name": "बाबुको नाम",
    "mother_name": "आमाको नाम",
    "address": "ठेगाना",
    "phone": "फोन",
    "email": "इमेल",
    "date_of_birth": "जन्म मिति",
    "gender": "लिङ्ग",
    "male": "पुरुष",
    "female": "महिला",
    "other": "अन्य",
    "blood_group": "रक्त समूह",

    # School
    "school_name": "विद्यालयको नाम",
    "principal": "प्रधानाध्यापक",
    "established": "स्थापना",
    "affiliated_to": "सम्बन्धन",
    "academic_year": "शैक्षिक वर्ष",

    # Messages
    "welcome": "स्वागत छ",
    "logout": "लग आउट",
    "no_data": "कुनै डाटा छैन",
    "loading": "लोड हुँदैछ...",
    "success": "सफल भयो",
    "error": "त्रुटि भयो",
    "confirm_delete": "के तपाईं मेटाउन चाहनुहुन्छ?",
}

# English labels (for bilingual display)
EN = {k: k.replace("_", " ").title() for k in NE}


def t(key: str, lang: str = "ne") -> str:
    """Get translated label.

    >>> t("students", "ne")
    'विद्यार्थीहरू'
    >>> t("students", "en")
    'Students'
    """
    if lang == "ne":
        return NE.get(key, key)
    return EN.get(key, key.replace("_", " ").title())


def bilingual(key: str) -> str:
    """Get bilingual label: English (Nepali).

    >>> bilingual("students")
    'Students (विद्यार्थीहरू)'
    """
    return f"{t(key, 'en')} ({t(key, 'ne')})"
