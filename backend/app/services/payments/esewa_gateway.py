"""eSewa Payment Gateway integration for Nepal.

All merchant credentials MUST be supplied by the caller (loaded from the school's
fee_config).  No system-wide environment variable fallbacks exist.
"""

import base64
import hashlib
import hmac
import json

import requests
from flask import current_app


class EsewaGateway:
    """eSewa ePay v2 API integration."""

    @classmethod
    def _is_production(cls) -> bool:
        return current_app.config.get("ESEWA_ENVIRONMENT", "sandbox") == "production"

    @classmethod
    def _base_url(cls) -> str:
        if cls._is_production():
            return "https://epay.esewa.com.np"
        return "https://rc-epay.esewa.com.np"

    @classmethod
    def _generate_signature(cls, message: str, secret_key: str) -> str:
        """Generate HMAC-SHA256 signature."""
        digest = hmac.new(secret_key.encode(), message.encode(), hashlib.sha256).digest()
        return base64.b64encode(digest).decode()

    @classmethod
    def initiate_payment(
        cls,
        transaction_uuid: str,
        amount: float,
        product_code: str,
        secret_key: str,
        tax_amount: float = 0,
        service_charge: float = 0,
        delivery_charge: float = 0,
        success_url: str = "",
        failure_url: str = "",
    ) -> dict:
        """Generate eSewa payment form data for frontend submission.

        Raises ValueError if required credentials are missing.
        """
        if not product_code:
            raise ValueError("eSewa product_code (merchant code) is not configured for this school")
        if not secret_key:
            raise ValueError("eSewa secret_key is not configured for this school")

        total = amount + tax_amount + service_charge + delivery_charge
        sign_message = f"total_amount={total},transaction_uuid={transaction_uuid},product_code={product_code}"
        signature = cls._generate_signature(sign_message, secret_key)

        form_data = {
            "amount": str(amount),
            "tax_amount": str(tax_amount),
            "total_amount": str(total),
            "transaction_uuid": transaction_uuid,
            "product_code": product_code,
            "product_service_charge": str(service_charge),
            "product_delivery_charge": str(delivery_charge),
            "success_url": success_url,
            "failure_url": failure_url,
            "signed_field_names": "total_amount,transaction_uuid,product_code",
            "signature": signature,
        }

        # eSewa ePay v2 requires a browser POST of these fields to the form
        # endpoint. Mobile clients cannot launchUrl() a POST, so also return a
        # self-submitting HTML document they can load in a WebView.
        hidden_inputs = "\n".join(
            f'<input type="hidden" name="{k}" value="{v}"/>'
            for k, v in form_data.items()
        )
        autoform_html = (
            "<!DOCTYPE html><html><head><meta charset='utf-8'>"
            "<title>Redirecting to eSewa…</title></head><body>"
            f"<form id='f' method='POST' action='{cls._base_url()}/api/epay/main/v2/form'>"
            f"{hidden_inputs}</form>"
            "<script>document.getElementById('f').submit();</script>"
            "</body></html>"
        )

        return {
            "payment_url": f"{cls._base_url()}/api/epay/main/v2/form",
            "form_data": form_data,
            "checkout_html": autoform_html,
        }

    @classmethod
    def verify_payment(cls, encoded_data: str, secret_key: str) -> dict:
        """Verify eSewa payment callback data.

        Raises ValueError if secret_key is missing.
        """
        if not secret_key:
            raise ValueError("eSewa secret_key is required to verify payment")

        try:
            decoded = base64.b64decode(encoded_data).decode()
            data = json.loads(decoded)
        except Exception:
            return {"verified": False, "error": "Invalid callback data"}

        transaction_uuid = data.get("transaction_uuid", "")
        total_amount = data.get("total_amount", "")
        product_code = data.get("product_code", "")
        status = data.get("status", "")

        sign_message = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={product_code}"
        expected_sig = cls._generate_signature(sign_message, secret_key)

        if data.get("signature") != expected_sig:
            return {"verified": False, "error": "Signature mismatch"}

        return {
            "verified": status == "COMPLETE",
            "transaction_uuid": transaction_uuid,
            "total_amount": total_amount,
            "status": status,
            "ref_id": data.get("transaction_code", ""),
        }

    @classmethod
    def check_transaction_status(
        cls,
        transaction_uuid: str,
        total_amount: float,
        product_code: str,
    ) -> dict:
        """Lookup transaction status via eSewa API."""
        if not product_code:
            raise ValueError("eSewa product_code is required to check transaction status")

        url = f"{cls._base_url()}/api/epay/transaction/status/"
        params = {
            "product_code": product_code,
            "total_amount": total_amount,
            "transaction_uuid": transaction_uuid,
        }

        resp = requests.get(url, params=params, timeout=30)
        data = resp.json()

        return {
            "status": data.get("status"),
            "ref_id": data.get("ref_id"),
            "total_amount": data.get("total_amount"),
        }
