from datetime import UTC, datetime

from app.integrations.messages import whatsapp_variables

AT = datetime(2026, 10, 10, 13, 0, tzinfo=UTC)  # 6:30 PM in India


def test_single_template_is_one_line():
    (line,) = whatsapp_variables("single", "Satya Sai", "Call the electrician", "Bring\nthe card", AT, "Asia/Kolkata")
    assert line == "⏰ Call the electrician · Sat, 10 Oct at 6:30 PM · 📝 Bring the card"
    assert "\n" not in line  # WhatsApp rejects line breaks in template variables


def test_detailed_template_fills_three_variables():
    assert whatsapp_variables("detailed", "Satya Sai", "Pay the bill", "Online", AT, "Asia/Kolkata") == [
        "Satya",
        "Pay the bill",
        "Sat, 10 Oct at 6:30 PM",
    ]


def test_task_time_template_fills_two_variables():
    from app.integrations.messages import consent_variables

    assert whatsapp_variables("task_time", "Satya Sai", "Pay the bill", "Online", AT, "Asia/Kolkata") == [
        "Pay the bill · 📝 Online",
        whatsapp_variables("detailed", "x", "y", None, AT, "Asia/Kolkata")[2],
    ]
    assert len(whatsapp_variables("task_time", "A", "Call", None, AT, None)) == 2
    asks = consent_variables("task_time", "Satya Sai")
    assert len(asks) == 2 and "YES" in asks[0] and "*" not in asks[0]
