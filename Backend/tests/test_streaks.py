from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, text

from app.modules.streaks.engine import compute_bonus
from tests.conftest import register

API = "/api/v1"


def make_track(client, auth, name="Gym", **extra):
    res = client.post(f"{API}/tracks", json={"name": name, **extra}, headers=auth)
    assert res.status_code == 201, res.text
    return res.json()


def make_action(client, auth, track_id, title="Workout", **extra):
    payload = {"title": title, "repeat_type": "DAILY", **extra}
    res = client.post(f"{API}/tracks/{track_id}/actions", json=payload, headers=auth)
    assert res.status_code == 201, res.text
    return res.json()


def complete(client, auth, action_id, **extra):
    return client.post(f"{API}/actions/{action_id}/complete", json={"confirmed": True, **extra}, headers=auth)


def streak(client, auth):
    res = client.get(f"{API}/streaks/me", headers=auth)
    assert res.status_code == 200, res.text
    return res.json()


def next_day(clock):
    clock.advance(days=1)


# ---- completion integrity ----------------------------------------------------


def test_completion_requires_explicit_confirmation(client, auth):
    track = make_track(client, auth)
    action = make_action(client, auth, track["id"])
    res = client.post(f"{API}/actions/{action['id']}/complete", json={"confirmed": False}, headers=auth)
    assert res.status_code == 422
    assert "confirm" in res.json()["error"]["message"].lower()


def test_cannot_complete_future_or_past_days(client, auth, clock):
    track = make_track(client, auth)
    action = make_action(client, auth, track["id"])
    today = clock.now.date()
    assert complete(client, auth, action["id"], date=str(today + timedelta(days=1))).status_code == 422
    next_day(clock)
    res = complete(client, auth, action["id"], date=str(today))
    assert res.status_code == 422
    assert "locked" in res.json()["error"]["message"].lower()


def test_cannot_complete_an_action_not_due_today(client, auth, clock):
    track = make_track(client, auth)
    tomorrow = clock.now.date() + timedelta(days=1)
    action = make_action(client, auth, track["id"], repeat_type="ONCE", start_date=str(tomorrow))
    assert complete(client, auth, action["id"]).status_code == 422


def test_duplicate_completion_is_idempotent(client, auth, db):
    track = make_track(client, auth)
    action = make_action(client, auth, track["id"])
    first = complete(client, auth, action["id"])
    second = complete(client, auth, action["id"])
    assert first.status_code == second.status_code == 200
    assert second.json()["already_completed"] is True
    live = db.execute(text("SELECT count(*) FROM action_completions WHERE revoked_at IS NULL")).scalar()
    assert live == 1


def test_uncomplete_keeps_an_audit_record(client, auth, db):
    track = make_track(client, auth)
    action = make_action(client, auth, track["id"])
    complete(client, auth, action["id"])
    res = client.post(f"{API}/actions/{action['id']}/uncomplete", json={}, headers=auth)
    assert res.status_code == 200 and res.json()["is_completed"] is False
    rows = db.execute(text("SELECT revoked_at IS NOT NULL FROM action_completions")).scalars().all()
    assert rows == [True]
    # …and it can be completed again afterwards.
    assert complete(client, auth, action["id"]).json()["is_completed"] is True


def test_completion_result_reports_day_secured(client, auth):
    track = make_track(client, auth)
    a1 = make_action(client, auth, track["id"], title="One")
    a2 = make_action(client, auth, track["id"], title="Two")
    r1 = complete(client, auth, a1["id"]).json()
    assert r1["day_secured"] is False and r1["today_completed"] == 1 and r1["today_required"] == 2
    r2 = complete(client, auth, a2["id"]).json()
    assert r2["day_secured"] is True and r2["day_just_secured"] is True
    assert r2["current_streak"] == 1  # today counts once secured


def test_finishing_one_plan_is_reported_for_its_celebration(client, auth):
    first = make_track(client, auth)
    second = make_track(client, auth, name="Reading")
    a1 = make_action(client, auth, first["id"], title="One")
    a2 = make_action(client, auth, first["id"], title="Two")
    make_action(client, auth, second["id"], title="Other plan")
    r1 = complete(client, auth, a1["id"]).json()
    assert r1["plan_just_finished"] is False and r1["plans_done"] == 0
    r2 = complete(client, auth, a2["id"]).json()
    assert r2["plan_just_finished"] is True and r2["plan_name"] == first["name"]
    assert r2["day_just_secured"] is False and r2["plans_done"] == 1 and r2["plans_due"] == 2
    assert r2["current_streak"] == 1
    again = complete(client, auth, a2["id"]).json()
    assert again["already_completed"] is True and again["plan_just_finished"] is False


def test_totals_count_a_secured_today_like_the_streak_does(client, auth):
    track = make_track(client, auth)
    action = make_action(client, auth, track["id"])
    s = streak(client, auth)
    assert s["total_success_days"] == 0 and s["consistency_pct"] == 0.0  # unfinished today isn't judged

    complete(client, auth, action["id"])
    s = streak(client, auth)
    assert s["current_streak"] == 1
    assert s["total_success_days"] == 1 and s["consistency_pct"] == 100.0 and s["consistency_score"] == 1
    profile = client.get(f"{API}/users/me/profile", headers=auth).json()
    assert profile["stats"]["total_success_days"] == 1 and profile["stats"]["consistency_pct"] == 100.0

    # Undoing it takes the provisional success back.
    client.post(f"{API}/actions/{action['id']}/uncomplete", headers=auth)
    assert streak(client, auth)["total_success_days"] == 0


# ---- streak rules ------------------------------------------------------------


def test_streak_builds_and_a_missed_day_deducts_a_point(client, auth, clock):
    track = make_track(client, auth)
    action = make_action(client, auth, track["id"])

    for _ in range(3):
        complete(client, auth, action["id"])
        next_day(clock)
    s = streak(client, auth)
    assert s["current_streak"] == 3 and s["best_streak"] == 3
    assert s["today"]["secured"] is False

    next_day(clock)  # today (day 4) passes with nothing done
    s = streak(client, auth)
    assert s["current_streak"] == 2  # one plan missed: -1, not a reset
    assert s["best_streak"] == 3
    assert s["total_failed_days"] == 1


def test_each_finished_plan_earns_a_point(client, auth, clock):
    plans = [make_track(client, auth, name=f"Plan {i}") for i in range(3)]
    actions = [make_action(client, auth, p["id"]) for p in plans]
    complete(client, auth, actions[0]["id"])
    complete(client, auth, actions[1]["id"])
    s = streak(client, auth)
    # Finished plans count today already; the unfinished one isn't judged yet.
    assert s["current_streak"] == 2
    assert s["today"]["plans_done"] == 2 and s["today"]["plans_due"] == 3

    next_day(clock)  # two finished (+2), one missed (-1)
    assert streak(client, auth)["current_streak"] == 1


def test_points_never_go_below_zero(client, auth, clock):
    for i in range(2):
        make_action(client, auth, make_track(client, auth, name=f"Plan {i}")["id"])
    next_day(clock)  # both missed
    s = streak(client, auth)
    assert s["current_streak"] == 0 and s["best_streak"] == 0


def test_optional_actions_do_not_affect_the_streak(client, auth, clock):
    track = make_track(client, auth)
    required = make_action(client, auth, track["id"], title="Required")
    make_action(client, auth, track["id"], title="Optional", is_required=False)
    complete(client, auth, required["id"])
    next_day(clock)
    assert streak(client, auth)["current_streak"] == 1


def test_days_with_nothing_required_neither_extend_nor_break(client, auth, clock):
    track = make_track(client, auth)
    monday = clock.now.date()
    assert monday.weekday() == 0
    # Mon / Wed only
    action = make_action(client, auth, track["id"], repeat_type="WEEKLY", repeat_weekdays=[0, 2])
    complete(client, auth, action["id"])  # Mon
    next_day(clock)  # Tue: nothing due
    next_day(clock)  # Wed
    complete(client, auth, action["id"])
    next_day(clock)  # Thu
    s = streak(client, auth)
    assert s["current_streak"] == 2
    history = client.get(f"{API}/streaks/history", params={"from": str(monday), "to": str(monday + timedelta(days=2))}, headers=auth).json()
    assert [d["status"] for d in history] == ["SUCCESS", "NO_ACTIONS", "SUCCESS"]


def test_finalized_history_is_not_rewritten_by_later_edits(client, auth, clock, db):
    track = make_track(client, auth)
    a1 = make_action(client, auth, track["id"], title="One")
    make_action(client, auth, track["id"], title="Two")
    complete(client, auth, a1["id"])  # only 1 of 2 → day fails
    next_day(clock)
    assert streak(client, auth)["total_failed_days"] == 1
    # Deleting the missed action today must not turn yesterday into a success.
    second = next(a for a in client.get(f"{API}/tracks/{track['id']}/actions", headers=auth).json() if a["title"] == "Two")
    assert client.delete(f"{API}/actions/{second['id']}", headers=auth).status_code == 204
    s = streak(client, auth)
    assert s["total_failed_days"] == 1 and s["current_streak"] == 0
    status = db.execute(text("SELECT status FROM daily_records")).scalar()
    assert status == "FAILED"


def test_days_are_judged_in_the_users_timezone(client, clock):
    # 06:00 UTC on Mon = 20:00 Sun in Honolulu (UTC-10).
    headers, _ = register(client, email="hi@example.com", tz="Pacific/Honolulu")
    agenda = client.get(f"{API}/actions/agenda", headers=headers).json()
    assert agenda["date"] == str(clock.now.date() - timedelta(days=1))


# ---- track completion bonus --------------------------------------------------


def test_bonus_is_normalized_by_duration():
    assert compute_bonus(duration_days=5, required_total=5, completed_total=5) == 0  # too short to farm
    assert compute_bonus(duration_days=7, required_total=7, completed_total=7) == 7
    assert compute_bonus(duration_days=30, required_total=30, completed_total=30) == 30
    assert compute_bonus(duration_days=30, required_total=90, completed_total=90) == 36  # 3/day → ×1.2
    assert compute_bonus(duration_days=30, required_total=30, completed_total=29) == 0  # not perfect


def test_perfect_track_earns_bonus_and_achievements(client, auth, clock):
    start = clock.now.date()
    end = start + timedelta(days=6)
    track = make_track(client, auth, name="Week", start_date=str(start), end_date=str(end))
    action = make_action(client, auth, track["id"])
    for _ in range(7):
        complete(client, auth, action["id"])
        next_day(clock)

    completions = client.get(f"{API}/streaks/track-completions", headers=auth).json()
    assert len(completions) == 1
    tc = completions[0]
    assert tc["is_perfect"] is True and tc["duration_days"] == 7 and tc["bonus_points"] == 7

    s = streak(client, auth)
    assert s["bonus_points"] == 7 and s["consistency_score"] == 7 + 7

    earned = {a["code"] for a in client.get(f"{API}/achievements", headers=auth).json() if a["earned"]}
    assert {"FIRST_STEP", "STREAK_3", "STREAK_7", "PERFECT_TRACK", "TRACK_FINISHER"} <= earned


def test_imperfect_track_earns_no_bonus(client, auth, clock):
    start = clock.now.date()
    track = make_track(client, auth, name="Week", start_date=str(start), end_date=str(start + timedelta(days=6)))
    action = make_action(client, auth, track["id"])
    for day in range(7):
        if day != 3:
            complete(client, auth, action["id"])
        next_day(clock)
    tc = client.get(f"{API}/streaks/track-completions", headers=auth).json()[0]
    assert tc["is_perfect"] is False and tc["bonus_points"] == 0


def test_comeback_achievement(client, auth, clock):
    track = make_track(client, auth)
    action = make_action(client, auth, track["id"])
    complete(client, auth, action["id"])
    next_day(clock)
    next_day(clock)  # missed
    complete(client, auth, action["id"])
    next_day(clock)
    earned = {a["code"] for a in client.get(f"{API}/achievements", headers=auth).json() if a["earned"]}
    assert "COMEBACK" in earned


# ---- tracks ------------------------------------------------------------------


def test_track_progress_fields(client, auth, clock):
    start = clock.now.date()
    track = make_track(client, auth, start_date=str(start), end_date=str(start + timedelta(days=29)))
    action = make_action(client, auth, track["id"])
    complete(client, auth, action["id"])
    t = client.get(f"{API}/tracks/{track['id']}", headers=auth).json()
    assert t["status"] == "ACTIVE"
    assert t["day_number"] == 1 and t["total_days"] == 30 and t["days_remaining"] == 29
    assert t["today_required"] == 1 and t["today_completed"] == 1 and t["streak"] == 1


def test_track_names_are_unique_per_user_case_insensitively(client, auth):
    make_track(client, auth, name="Gym")
    res = client.post(f"{API}/tracks", json={"name": "gym"}, headers=auth)
    assert res.status_code == 409


def test_users_cannot_touch_each_others_tracks(client, auth):
    track = make_track(client, auth)
    other, _ = register(client, email="other@example.com", name="Other")
    assert client.get(f"{API}/tracks/{track['id']}", headers=other).status_code == 404
    assert client.post(f"{API}/tracks/{track['id']}/actions", json={"title": "x"}, headers=other).status_code == 404


def test_category_grid_marks_each_task_per_day(client, auth, clock):
    today = clock.now.date()
    track = make_track(client, auth, start_date=str(today), end_date=str(today + timedelta(days=6)))
    walk = make_action(client, auth, track["id"], title="Walk")
    read = make_action(client, auth, track["id"], title="Read")
    complete(client, auth, walk["id"])

    grid = client.get(f"{API}/tracks/{track['id']}/grid", headers=auth).json()
    assert len(grid["days"]) == 7 and grid["days"][0] == str(today) and grid["today"] == str(today)
    cells = {row["title"]: row["cells"] for row in grid["rows"]}
    assert cells["Walk"][:2] == ["DONE", "FUTURE"]
    assert cells["Read"][:2] == ["TODO", "FUTURE"]

    next_day(clock)  # yesterday is now judged: done stays done, not done becomes missed
    grid = client.get(f"{API}/tracks/{track['id']}/grid", headers=auth).json()
    cells = {row["title"]: row["cells"] for row in grid["rows"]}
    assert cells["Walk"][:2] == ["DONE", "TODO"]
    assert cells["Read"][:2] == ["MISSED", "TODO"]


# ---- limits ---------------------------------------------------------------------


def test_plan_and_task_limits(client, auth):
    plans = [make_track(client, auth, name=f"Plan {i}") for i in range(10)]
    assert client.post(f"{API}/tracks", json={"name": "Eleventh"}, headers=auth).status_code == 409
    for i in range(15):
        make_action(client, auth, plans[0]["id"], title=f"Task {i}")
    res = client.post(f"{API}/tracks/{plans[0]['id']}/actions", json={"title": "Sixteenth", "repeat_type": "DAILY"}, headers=auth)
    assert res.status_code == 409


def test_a_task_cannot_outlast_its_plan(client, auth, clock):
    today = clock.now.date()
    plan = make_track(client, auth, start_date=str(today), end_date=str(today + timedelta(days=9)))
    late = {"title": "Too long", "repeat_type": "DAILY", "end_date": str(today + timedelta(days=20))}
    assert client.post(f"{API}/tracks/{plan['id']}/actions", json=late, headers=auth).status_code == 422
    ok = make_action(client, auth, plan["id"], end_date=str(today + timedelta(days=4)))
    assert ok["end_date"] == str(today + timedelta(days=4))


# ---- daily cleanup -----------------------------------------------------------------


def test_cleanup_needs_the_secret(client, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config, "CRON_SECRET", "")
    assert client.post(f"{API}/maintenance/cleanup", headers={"X-Cron-Secret": "x"}).status_code == 404
    monkeypatch.setattr(config, "CRON_SECRET", "s3cret")
    assert client.post(f"{API}/maintenance/cleanup", headers={"X-Cron-Secret": "wrong"}).status_code == 403


def test_cleanup_removes_ended_plans_tasks_and_done_reminders_but_keeps_streaks(client, auth, clock, monkeypatch, db):
    from app.core import config

    monkeypatch.setattr(config, "CRON_SECRET", "s3cret")
    today = clock.now.date()
    short = make_track(client, auth, name="Short", start_date=str(today), end_date=str(today))
    action = make_action(client, auth, short["id"], steps=["Warm up"])
    complete(client, auth, action["id"])
    keep = make_track(client, auth, name="Ongoing")
    brief = make_action(client, auth, keep["id"], title="Brief", end_date=str(today + timedelta(days=1)))
    lasting = make_action(client, auth, keep["id"], title="Lasting")
    complete(client, auth, brief["id"])
    complete(client, auth, lasting["id"])
    at = (clock.now + timedelta(hours=1)).isoformat()
    reminder = client.post(f"{API}/reminders", json={"title": "Call", "remind_at": at}, headers=auth).json()
    client.post(f"{API}/reminders/{reminder['id']}/complete", headers=auth)

    for _ in range(9):
        next_day(clock)
    # Reminders stamp completed_at with the real clock; move it into the test's past.
    db.execute(text("UPDATE reminders SET completed_at = :t"), {"t": clock.now - timedelta(days=8)})
    db.commit()
    res = client.post(f"{API}/maintenance/cleanup", headers={"X-Cron-Secret": "s3cret"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["plans_deleted"] == 1 and body["tasks_deleted"] == 1 and body["reminders_deleted"] == 1

    names = [t["name"] for t in client.get(f"{API}/tracks", headers=auth).json()]
    assert names == ["Ongoing"]
    tasks = [a["title"] for a in client.get(f"{API}/tracks/{keep['id']}/actions", headers=auth).json()]
    assert tasks == ["Lasting"] and brief["id"] != lasting["id"]
    assert client.get(f"{API}/reminders/{reminder['id']}", headers=auth).status_code == 404
    s = streak(client, auth)
    assert s["best_streak"] == 2 and s["total_success_days"] == 1
