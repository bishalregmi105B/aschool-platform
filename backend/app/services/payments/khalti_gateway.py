"""Khalti Payment Gateway integration for Nepal.

All merchant credentials MUST be supplied by the caller (loaded from the school's
fee_config).  No system-wide environment variable fallbacks exist.
"""

import requests
from flask import current_app


class KhaltiGateway:
    """Khalti ePay v2 API integration."""

    @classmethod
    def _is_production(cls) -> bool:
        return current_app.config.get("KHALTI_ENVIRONMENT", "sandbox") == "production"

    @classmethod
    def _base_url(cls) -> str:
        if cls._is_production():
            return "https://khalti.com/api/v2"
        return "https://a.khalti.com/api/v2"

    @classmethod
    def initiate_payment(
        cls,
        purchase_order_id: str,
        purchase_order_name: str,
        amount_paisa: int,
        return_url: str,
        secret_key: str,
        website_url: str = "",
        customer_info: dict | None = None,
    ) -> dict:
        """Initiate a Khalti payment — returns payment URL for redirect.

        Raises ValueError if secret_key is missing.
        """
        if not secret_key:
            raise ValueError("Khalti secret_key is not configured for this school")

        url = f"{cls._base_url()}/epayment/initiate/"
        headers = {
            "Authorization": f"key {secret_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "return_url": return_url,
            "website_url": website_url or current_app.config.get("FRONTEND_URL", ""),
            "amount": amount_paisa,
            "purchase_order_id": purchase_order_id,
            "purchase_order_name": purchase_order_name,
        }

        if customer_info:
            payload["customer_info"] = customer_info

        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        data = resp.json()

        if resp.status_code == 200:
            return {
                "success": True,
                "payment_url": data.get("payment_url"),
                "pidx": data.get("pidx"),
            }

        return {
            "success": False,
            "error": data.get("detail", "Payment initiation failed"),
        }

    @classmethod
    def verify_payment(cls, pidx: str, secret_key: str) -> dict:
        """Verify/lookup a Khalti payment by pidx.

        Raises ValueError if secret_key is missing. A network/API failure is
        reported as {"verified": False, "network_error": True} — the caller
        must never treat "could not verify" as "not paid".
        """
        if not secret_key:
            raise ValueError("Khalti secret_key is required to verify payment")

        url = f"{cls._base_url()}/epayment/lookup/"
        headers = {
            "Authorization": f"key {secret_key}",
            "Content-Type": "application/json",
        }

        try:
            resp = requests.post(url, headers=headers, json={"pidx": pidx}, timeout=30)
            data = resp.json()
        except (requests.RequestException, ValueError) as exc:
            return {
                "verified": False,
                "network_error": True,
                "error": str(exc),
                "status": "lookup_failed",
                "pidx": pidx,
            }

        return {
            "verified": data.get("status") == "Completed",
            "status": data.get("status"),
            "pidx": pidx,
            # Khalti echoes the purchase_order_id the payment was created
            # with — the callback handler cross-checks it against the local
            # collection so a pidx from another payment cannot be replayed.
            "purchase_order_id": data.get("purchase_order_id"),
            "transaction_id": data.get("transaction_id"),
            "amount_paisa": data.get("total_amount"),
            "amount_npr": data.get("total_amount", 0) / 100,
            "fee": data.get("fee", 0),
            "refunded": data.get("refunded", False),
        }

    @classmethod
    def refund_payment(cls, pidx: str, secret_key: str) -> dict:
        """Initiate a full refund for a Khalti payment.

        Khalti refund API: POST /api/v2/transaction/refund/
        The payment must be in Completed status to be refunded.

        Raises ValueError if secret_key is missing.
        """
        if not secret_key:
            raise ValueError("Khalti secret_key is required to process refund")

        url = f"{cls._base_url()}/transaction/refund/"
        headers = {
            "Authorization": f"key {secret_key}",
            "Content-Type": "application/json",
        }

        resp = requests.post(url, headers=headers, json={"pidx": pidx}, timeout=30)
        data = resp.json()

        if resp.status_code == 200:
            return {
                "success": True,
                "pidx": pidx,
                "status": data.get("status", "refunded"),
                "message": data.get("detail", "Refund initiated successfully"),
            }

        return {
            "success": False,
            "pidx": pidx,
            "error": data.get("detail", "Refund failed"),
            "status_code": resp.status_code,
        }
