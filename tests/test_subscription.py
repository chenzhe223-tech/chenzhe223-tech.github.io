import pathlib
import re
import unittest
import tomllib

ROOT = pathlib.Path(__file__).resolve().parents[1]

class SubscriptionContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.worker = (ROOT / "worker/src/index.js").read_text(encoding="utf-8")
        cls.schema = (ROOT / "worker/schema.sql").read_text(encoding="utf-8")
        cls.page = (ROOT / "radar/subscribe/index.html").read_text(encoding="utf-8")
        cls.config = tomllib.loads((ROOT / "worker/wrangler.toml").read_text(encoding="utf-8"))

    def test_china_0730_cron(self):
        self.assertEqual(self.config["triggers"]["crons"], ["30 23 * * *"])

    def test_required_tables_and_audit(self):
        for table in ("subscribers", "deliveries", "delivery_runs"):
            self.assertIn(f"CREATE TABLE IF NOT EXISTS {table}", self.schema)

    def test_double_opt_in_and_unsubscribe_routes(self):
        for route in ("/api/subscribe", "/api/confirm", "/api/unsubscribe"):
            self.assertIn(route, self.worker)

    def test_email_is_only_sent_after_quality_gate(self):
        self.assertIn("quality_gate_failed", self.worker)
        self.assertIn("uniqueUrls.size<4", self.worker)
        self.assertIn("storyComplete", self.worker)
        self.assertIn("await mail(env,sub.email", self.worker)

    def test_no_secret_committed(self):
        self.assertIn("env.BREVO_API_KEY", self.worker)
        self.assertNotRegex(self.worker, r"xkeysib-[A-Za-z0-9]+")

    def test_subscription_page_is_branded_and_mobile_ready(self):
        for phrase in ("DAVYLAB", "SPARK &amp; PULSE", "07:30", 'type="email"', 'name="topic"'):
            self.assertIn(phrase, self.page)
        self.assertIn("@media(max-width:650px)", self.page)
        self.assertIn("YOUR_ACCOUNT", self.page)  # deliberate until Worker deployment hostname is known

if __name__ == "__main__":
    unittest.main()
