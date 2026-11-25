"""Loopback HTTP contract tests; no external providers or credentials."""
import unittest
import tempfile
import threading
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from wsgiref.simple_server import make_server
import json
from api import FinanceAPI
from quota import Quota

TOKEN = "fixture-token-not-a-real-secret"

class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.now = datetime.now(timezone.utc)
        self.doc = {"status":"ok","generated_at":self.now.isoformat(),"stories":[]}
        self.app = FinanceAPI(TOKEN, quota=Quota(self.tmp.name+"/quota.db", limit=10), news=lambda:self.doc)
        self.server = make_server("127.0.0.1", 0, self.app)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.thread.join, 3)
        self.addCleanup(self.server.shutdown)

    def request(self, path="health", token=TOKEN):
        headers = {} if token is None else {"Authorization":"Bearer "+token}
        req = Request("http://127.0.0.1:%d/api/v1/%s"%(self.server.server_port,path), headers=headers)
        try:
            response = urlopen(req, timeout=3)
        except HTTPError as exc:
            response = exc
        with response:
            return response.status, response.headers, json.load(response)

    def test_auth(self):
        self.assertEqual(self.request(token=None)[0],401)
        self.assertEqual(self.request(token="wrong")[0],401)
        self.assertEqual(self.request()[0],200)

    def test_quota(self):
        self.app.quota = Quota(self.tmp.name+"/limited.db",limit=1,clock=lambda:120)
        self.assertEqual(self.request()[0],200)
        status, headers, body = self.request()
        self.assertEqual(status,429)
        self.assertEqual(headers["Retry-After"],"60")
        self.assertEqual(body["error"],"quota_exceeded")

    def test_stale_snapshot(self):
        self.doc["generated_at"] = (self.now-timedelta(hours=25)).isoformat()
        self.assertEqual(self.request("news")[0],503)

    def test_old_story_filtered(self):
        self.doc["stories"] = [{"title":"old","source":"fixture","published_at":(self.now-timedelta(days=8)).isoformat()},
                               {"title":"fresh","source":"fixture","published_at":self.now.isoformat()}]
        status, _, body = self.request("news")
        self.assertEqual(status,200)
        self.assertEqual([r["title"] for r in body["stories"]],["fresh"])

    def test_provider_failure(self):
        def fail():
            raise OSError("fixture failure")
        self.app.news = fail
        self.assertEqual(self.request("news")[0],503)

    def test_quota_failure(self):
        class Broken:
            def allow(self, client):
                raise OSError("fixture failure")
        self.app.quota = Broken()
        status, _, body = self.request()
        self.assertEqual(status,503)
        self.assertEqual(body["error"],"quota_unavailable")

if __name__ == "__main__":
    unittest.main()
