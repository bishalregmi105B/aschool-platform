"""F4: tracking-id validation — these values are interpolated into inline
<script> blocks on the PUBLIC site (layout.tsx gtag/fbq init), so a crafted
value is stored XSS executed in every visitor's session. Server-side allowlists
close the write path; the frontend switch closes the render path."""
import re

_GA_RE = re.compile(r"^G-[A-Z0-9]{4,12}$")  # GA4 measurement id
_PIXEL_RE = re.compile(r"^\d{6,20}$")       # Meta pixel numeric id


def valid_ga_id(value: str | None) -> bool:
    return bool(value) and bool(_GA_RE.match(value.strip()))


def valid_pixel_id(value: str | None) -> bool:
    return bool(value) and bool(_PIXEL_RE.match(value.strip()))
