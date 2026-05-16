"""FonePay Payment Gateway integration for Nepal.

FonePay is a major payment aggregator in Nepal, used by most banks for
QR-code and online banking payments.

All merchant credentials MUST be supplied by the caller (loaded from the school's
fee_config).  No system-wide environment variable fallbacks exist.

API Docs: https://docs.fonepay.com/
"""
import hashlib
import hmac
import logging
from datetime import datetime

import requests
from flask import current_app

logger = logging.getLogger(__name__)


class FonePayGateway:
    """FonePay merchant integration for school fee payments."""

    @classmethod
    def _is_production(cls) -> bool:
        return current_app.config.get("FONEPAY_ENVIRONMENT", "sandbox") == "production"

    @classmethod
    def _base_url(cls) -> str:
        if cls._is_production():
            return "https://merchantapi.fonepay.com/api/merchant"
        return "https://dev-merchantapi.fonepay.com/api/merchant"

    @classmethod
    def _generate_signature(cls, *values, secret_key: str) -> str:
        """Generate HMAC-SHA512 signature for FonePay request validation."""
        message = ",".join(str(v) for v in values)
        return hmac.new(
            secret_key.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha512,
        ).hexdigest()

    @classmethod
    def initiate_payment(
        cls,
        prn: str,
        amount: float,
        return_url: str,
        merchant_code: str,
        secret_key: str,
        remarks: str = "",
    ) -> dict:
        """Initiate a FonePay payment — returns redirect URL for the payment form.

        Args:
            prn: Payment Reference Number (unique per transaction)
            amount: Payment amount in NPR
            return_url: URL to redirect after payment completion
            merchant_code: School's FonePay merchant code (PID).
            secret_key: School's FonePay HMAC secret.
            remarks: Optional payment description

        Raises ValueError if required credentials are missing.
        """
        if not merchant_code:
            raise ValueError("FonePay merchant_code (PID) is not configured for this school")
        if not secret_key:
            raise ValueError("FonePay secret_key is not configured for this school")

        dt = datetime.now().strftime("%m/%d/%Y")
        crn = "NPR"

        # FonePay signature fields (order matters): PID, MD, PRN, AMT, CRN, DT, R1, R2, RU
        signature = cls._generate_signature(
            merchant_code, "P", prn, f"{amount:.2f}", crn, dt, remarks, "", return_url,
            secret_key=secret_key,
        )

        params = {
            "PID": merchant_code,
            "MD": "P",
            "PRN": prn,
            "AMT": f"{amount:.2f}",
            "CRN": crn,
            "DT": dt,
            "R1": remarks,
            "R2": "",
            "RU": return_url,
            "DV": signature,
        }

        redirect_url = f"{cls._base_url()}/merchantRequest"
        query_string = "&".join(f"{k}={v}" for k, v in params.items())

        return {
            "success": True,
            "redirect_url": f"{redirect_url}?{query_string}",
            "prn": prn,
            "params": params,
        }

    @classmethod
    def verify_payment(cls, prn: str, data: dict, merchant_code: str, secret_key: str) -> dict:
        """Verify a FonePay payment callback.

        FonePay sends these params on callback:
        PRN, BID (Bank ID), PID, PS (Payment Status), RC (Response Code),
        UID, BC, INI, P_AMT, R_AMT, DV (signature)

        Raises ValueError if required credentials are missing.
        """
        if not merchant_code:
            raise ValueError("FonePay merchant_code is required to verify payment")
        if not secret_key:
            raise ValueError("FonePay secret_key is required to verify payment")

        payment_status = data.get("PS", "")
        response_code = data.get("RC", "")
        bid = data.get("BID", "")
        uid = data.get("UID", "")
        p_amt = data.get("P_AMT", "0")
        r_amt = data.get("R_AMT", "0")
        received_dv = data.get("DV", "")

        expected_sig = cls._generate_signature(
            merchant_code, "P", prn, p_amt, "NPR",
            data.get("DT", ""), data.get("R1", ""), data.get("R2", ""),
            data.get("RU", ""),
            secret_key=secret_key,
        )

        if not hmac.compare_digest(expected_sig.lower(), received_dv.lower()):
            logger.warning("FonePay signature mismatch for PRN=%s", prn)
            return {
                "verified": False,
                "error": "Signature verification failed",
                "prn": prn,
            }

        is_success = payment_status.lower() == "true" and response_code == "successful"

        if is_success:
            server_result = cls._server_verify(
                prn, bid, uid, p_amt,
                merchant_code=merchant_code,
                secret_key=secret_key,
            )
            if not server_result.get("verified"):
                return server_result

        return {
            "verified": is_success,
            "prn": prn,
            "bid": bid,
            "uid": uid,
            "amount": float(p_amt),
            "refunded_amount": float(r_amt or 0),
            "transaction_id": uid,
            "status": "success" if is_success else "failed",
            "response_code": response_code,
        }

    @classmethod
    def _server_verify(
        cls,
        prn: str,
        bid: str,
        uid: str,
        amount: str,
        merchant_code: str,
        secret_key: str,
    ) -> dict:
        """Server-to-server payment verification with FonePay."""
        try:
            signature = cls._generate_signature(
                merchant_code, prn, amount, bid,
                secret_key=secret_key,
            )

            resp = requests.get(
                f"{cls._base_url()}/merchantRequest/verify",
                params={
                    "PID": merchant_code,
                    "PRN": prn,
                    "BID": bid,
                    "AMT": amount,
                    "DV": signature,
                },
                timeout=15,
            )

            if resp.status_code == 200:
                result = resp.json()
                return {
                    "verified": result.get("statusCode") == "success",
                    "prn": prn,
                    "bid": bid,
                    "uid": uid,
                    "amount": float(amount),
                }
            else:
                logger.error("FonePay verify failed: %s %s", resp.status_code, resp.text)
                return {"verified": False, "error": f"HTTP {resp.status_code}"}

        except Exception as exc:
            logger.exception("FonePay server verify failed: %s", exc)
            return {"verified": False, "error": str(exc)}

    @classmethod
    def initiate_fee_payment(
        cls,
        school_slug: str,
        fee_collection_id: str,
        amount: float,
        student_name: str,
        return_url: str,
        merchant_code: str,
        secret_key: str,
    ) -> dict:
        """Convenience method for school fee payments via FonePay."""
        prn = f"FP-{school_slug[:10]}-{str(fee_collection_id).split('-')[0]}"
        return cls.initiate_payment(
            prn=prn,
            amount=amount,
            return_url=return_url,
            merchant_code=merchant_code,
            secret_key=secret_key,
            remarks=f"School Fee - {student_name}",
        )
