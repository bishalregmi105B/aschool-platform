"""eSewa Payment Gateway integration for Nepal."""

import hashlib
import hmac
import base64
import json
from urllib.parse import urlencode

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
    def _secret_key(cls) -> str:
        return current_app.config["ESEWA_SECRET_KEY"]

    @classmethod
    def _product_code(cls) -> str:
        return current_app.config.get("ESEWA_PRODUCT_CODE", "EPAYTEST")

    @classmethod
    def _generate_signature(cls, message: str) -> str:
        """Generate HMAC SHA256 signature for eSewa v2."""
        key = cls._secret_key().encode()
        msg = message.encode()
        digest = hmac.new(key, msg, hashlib.sha256).digest()
        return base64.b64encode(digest).decode()

    @classmethod
    def initiate_payment(
        cls,
        transaction_uuid: str,
        amount: float,
        tax_amount: float = 0,
        service_charge: float = 0,
        delivery_charge: float = 0,
        success_url: str = "",
        failure_url: str = "",
    ) -> dict:
        """Generate eSewa payment form data for frontend submission."""
        total = amount + tax_amount + service_charge + delivery_charge
        product_code = cls._product_code()

        # Signature message format: total_amount,transaction_uuid,product_code
        sign_message = f"total_amount={total},transaction_uuid={transaction_uuid},product_code={product_code}"
        signature = cls._generate_signature(sign_message)

        return {
            "payment_url": f"{cls._base_url()}/api/epay/main/v2/form",
            "form_data": {
                "amount": str(amount),
                "tax_amount": str(tax_amount),
                "total_amount": str(total),
                "transaction_uuid": transaction_uuid,
                "product_code": product_code,
                "product_service_charge": str(service_charge),
                "product_delivery_charge": str(delivery_charge),
                "success_url": success_url or current_app.config.get("ESEWA_SUCCESS_URL", ""),
                "failure_url": failure_url or current_app.config.get("ESEWA_FAILURE_URL", ""),
                "signed_field_names": "total_amount,transaction_uuid,product_code",
                "signature": signature,
            },
        }

    @classmethod
    def verify_payment(cls, encoded_data: str) -> dict:
        """Verify eSewa payment callback data."""
        try:
            decoded = base64.b64decode(encoded_data).decode()
            data = json.loads(decoded)
        except Exception:
            return {"verified": False, "error": "Invalid callback data"}

        transaction_uuid = data.get("transaction_uuid", "")
        total_amount = data.get("total_amount", "")
        product_code = data.get("product_code", "")
        status = data.get("status", "")

        # Verify signature
        sign_message = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={product_code}"
        expected_sig = cls._generate_signature(sign_message)

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
    def check_transaction_status(cls, transaction_uuid: str, total_amount: float) -> dict:
        """Lookup transaction status via eSewa API."""
        product_code = cls._product_code()
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
