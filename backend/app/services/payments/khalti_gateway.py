"""Khalti Payment Gateway integration for Nepal."""

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
    def _secret_key(cls) -> str:
        return current_app.config["KHALTI_SECRET_KEY"]

    @classmethod
    def _headers(cls) -> dict:
        return {
            "Authorization": f"key {cls._secret_key()}",
            "Content-Type": "application/json",
        }

    @classmethod
    def initiate_payment(
        cls,
        purchase_order_id: str,
        purchase_order_name: str,
        amount_paisa: int,
        return_url: str,
        website_url: str = "",
        customer_info: dict | None = None,
    ) -> dict:
        """Initiate a Khalti payment — returns payment URL for redirect."""
        url = f"{cls._base_url()}/epayment/initiate/"

        payload = {
            "return_url": return_url,
            "website_url": website_url or current_app.config.get("FRONTEND_URL", ""),
            "amount": amount_paisa,  # Khalti uses paisa (1 NPR = 100 paisa)
            "purchase_order_id": purchase_order_id,
            "purchase_order_name": purchase_order_name,
        }

        if customer_info:
            payload["customer_info"] = customer_info

        resp = requests.post(url, headers=cls._headers(), json=payload, timeout=30)
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
    def verify_payment(cls, pidx: str) -> dict:
        """Verify/lookup a Khalti payment by pidx."""
        url = f"{cls._base_url()}/epayment/lookup/"

        resp = requests.post(url, headers=cls._headers(), json={"pidx": pidx}, timeout=30)
        data = resp.json()

        return {
            "verified": data.get("status") == "Completed",
            "status": data.get("status"),
            "pidx": pidx,
            "transaction_id": data.get("transaction_id"),
            "amount_paisa": data.get("total_amount"),
            "amount_npr": data.get("total_amount", 0) / 100,
            "fee": data.get("fee", 0),
            "refunded": data.get("refunded", False),
        }

    @classmethod
    def initiate_fee_payment(
        cls,
        school_slug: str,
        student_id: str,
        fee_collection_id: str,
        amount_npr: float,
        student_name: str,
        return_url: str,
    ) -> dict:
        """Convenience method for school fee payments."""
        purchase_order_id = f"fee_{school_slug}_{fee_collection_id}"
        amount_paisa = int(amount_npr * 100)

        return cls.initiate_payment(
            purchase_order_id=purchase_order_id,
            purchase_order_name=f"School Fee — {student_name}",
            amount_paisa=amount_paisa,
            return_url=return_url,
            customer_info={"name": student_name},
        )
