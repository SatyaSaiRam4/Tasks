from datetime import datetime, timezone

from app.integrations.messages import whatsapp_variables

AT = datetime(2026, 10, 10, 13, 0, tzinfo=timezone.utc)  # 6:30 PM in India


def test_single_template_is_one_line():
    (line,) = whatsapp_variables("single", "Satya Sai", "Call the electrician", "Bring\nthe card", AT, "Asia/Kolkata")
    assert line == "⏰ Call the electrician · Sat, 10 Oct at 6:30 PM · 📝 Bring the card"
    assert "\n" not in line  # WhatsApp rejects line breaks in template variables


def test_detailed_template_fills_four_variables():
    assert whatsapp_variables("detailed", "Satya Sai", "Pay the bill", None, AT, "Asia/Kolkata") == [
        "Satya",
        "Pay the bill",
        "Sat, 10 Oct at 6:30 PM",
        "No extra notes",
    ]
