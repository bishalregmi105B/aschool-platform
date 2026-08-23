"""Email Service — SMTP-based email sending."""

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib

from flask import current_app, render_template_string


class EmailService:
    """Send transactional and notification emails."""

    @classmethod
    def _get_smtp(cls) -> smtplib.SMTP:
        import os

        # MAIL_* keys live in the environment (.env.example documents them);
        # config.py doesn't map them, so read env directly with sane defaults.
        username = os.getenv("MAIL_USERNAME", "")
        password = os.getenv("MAIL_PASSWORD", "")
        if not username or not password:
            raise RuntimeError(
                "MAIL_USERNAME/MAIL_PASSWORD not configured — email sending disabled"
            )
        smtp = smtplib.SMTP(
            os.getenv("MAIL_SERVER", "smtp.gmail.com"),
            int(os.getenv("MAIL_PORT", "587")),
        )
        smtp.starttls()
        smtp.login(username, password)
        return smtp

    @classmethod
    def send_email(cls, to: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
        """Send a single email."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = current_app.config.get("MAIL_DEFAULT_SENDER", "noreply@aschool.com.np")
        msg["To"] = to

        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        try:
            smtp = cls._get_smtp()
            smtp.sendmail(msg["From"], [to], msg.as_string())
            smtp.quit()
            return True
        except Exception as e:
            current_app.logger.error(f"Email send failed: {e}")
            return False

    @classmethod
    def send_welcome_email(cls, to: str, school_name: str, admin_name: str) -> bool:
        """Send welcome email after school registration."""
        html = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ASchool!</h2>
            <p>Namaste {admin_name},</p>
            <p>Your school <strong>{school_name}</strong> has been successfully registered on ASchool.</p>
            <p>You can now start managing your school, students, and staff from your dashboard.</p>
            <p>— The ASchool Team</p>
        </div>"""
        return cls.send_email(to, f"Welcome to ASchool — {school_name}", html)

    @classmethod
    def send_fee_receipt(cls, to: str, student_name: str, amount: str, receipt_no: str) -> bool:
        """Send fee payment receipt."""
        html = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Fee Payment Receipt</h2>
            <p>Payment received for <strong>{student_name}</strong></p>
            <p>Amount: <strong>NPR {amount}</strong></p>
            <p>Receipt No: {receipt_no}</p>
            <p>Thank you for your payment.</p>
            <p>— ASchool</p>
        </div>"""
        return cls.send_email(to, f"Fee Receipt — {receipt_no}", html)

    @classmethod
    def send_bulk_email(cls, recipients: list[dict], subject: str, html_body: str) -> dict:
        """Send bulk emails. Each recipient dict has 'email' and optional 'name'."""
        sent = 0
        failed = 0
        for r in recipients:
            success = cls.send_email(r["email"], subject, html_body)
            if success:
                sent += 1
            else:
                failed += 1
        return {"total": len(recipients), "sent": sent, "failed": failed}
