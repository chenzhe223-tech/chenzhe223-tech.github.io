"""Gateway adapter tests never use a real API or spend tokens."""
import datetime as dt
import io
import json
import unittest
from unittest.mock import patch

import gateway_client as gateway

CANDIDATE = {
    "id": "candidate-1", "title": "A published AI model release",
    "source_urls": ["https://github.blog/verified-original-source"],
}


class FakeResponse:
    status = 200
    def __init__(self, payload):
        self.payload = payload
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self, size):
        return self.payload[:size]


def invoke(**kwargs):
    return gateway.gateway_outline(
        CANDIDATE, endpoint="https://gateway.example.test/v1/chat/completions",
        allowed_host="gateway.example.test", api_key="test-secret", model="approved-free-model",
        authorized=True, now=dt.datetime(2026, 11, 19, tzinfo=dt.timezone.utc),
        transport=lambda request, timeout: FakeResponse(
            json.dumps({"choices": [{"message": {"content": "待核实：公告原文与发布时间"}}]}).encode()),
        **kwargs,
    )


class GatewayTests(unittest.TestCase):
    def test_returns_unverified_outline(self):
        r = invoke()
        self.assertFalse(r["publishable"])
        self.assertEqual(r["verification_status"], "unverified_ai_draft")
        self.assertNotIn("test-secret", json.dumps(r))

    def test_fails_without_permission(self):
        with self.assertRaises(gateway.GatewayNotConfigured):
            gateway.gateway_outline(CANDIDATE, endpoint="https://gateway.example.test",
                                    allowed_host="gateway.example.test", api_key="k",
                                    model="m", authorized=False)

    def test_rejects_wrong_host(self):
        with self.assertRaises(ValueError):
            gateway._host("https://evil.example.test/v1", "gateway.example.test")

    def test_rejects_localhost_and_ip(self):
        for host in ("localhost", "127.0.0.1", "192.168.1.5", "server.local"):
            with self.subTest(host=host), self.assertRaises(ValueError):
                gateway._host("https://" + host + "/v1", host)

    def test_rejects_invalid_response(self):
        with self.assertRaises(ValueError):
            gateway.gateway_outline(
                CANDIDATE, endpoint="https://gateway.example.test/v1",
                allowed_host="gateway.example.test", api_key="k", model="m",
                authorized=True, transport=lambda request, timeout: FakeResponse(b"{}"))

    def test_rejects_non_https_source(self):
        bad = {**CANDIDATE, "source_urls": ["http://insecure.example"]}
        with self.assertRaises(ValueError):
            gateway.gateway_outline(bad, endpoint="https://gateway.example.test/v1",
                                    allowed_host="gateway.example.test", api_key="k", model="m",
                                    authorized=True, transport=lambda *args: None)


if __name__ == "__main__":
    unittest.main()
