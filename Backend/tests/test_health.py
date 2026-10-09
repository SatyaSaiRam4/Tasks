def test_health_needs_no_auth_and_reveals_nothing(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
    assert client.get("/health/live").json() == {"status": "ok"}
