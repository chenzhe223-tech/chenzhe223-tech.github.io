"""Local HTTP integration tests using only Python standard library."""
import json
import tempfile
import threading
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from wsgiref.simple_server import make_server
from api import FinanceAPI
from quota import Quota

TOKEN = "fixture-only-token-not-a-secret"
class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.now = datetime.now(timezone.utc)
        self.doc = {"status":"partial","generated_at":self.now.isoformat(),
                    "horizon_status":"not_configured","stories":[
                        {"title":"Central bank decision","source":"Fixture","published_at":self.now.isoformat()},
                        {"title":"Old central bank story","source":"Fixture","published_at":(self.now-timedelta(days=8)).isoformat()}]}
        self.app = FinanceAPI(TOKEN, quota=Quota(str(Path(self.tmp.name)/"quota.db"),limit=10),news=lambda:self.doc)
        self.server = make_server("127.0.0.1",0,self.app)
        self.thread = threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.thread.join,3)
        self.addCleanup(self.server.shutdown)
    def request(self,path,token=TOKEN,method="GET"):
        headers={} if token is None else {"Authorization":"Bearer "+token}
        req=Request("http://127.0.0.1:"+str(self.server.server_port)+path,headers=headers,method=method)
        try: response=urlopen(req,timeout=3)
        except HTTPError as e: response=e
        with response: return response.code,dict(response.headers),json.loads(response.read())
    def test_auth(self):
        self.assertEqual(self.request("/api/v1/health",None)[0],401)
        self.assertEqual(self.request("/api/v1/health","wrong")[0],401)
        self.assertEqual(self.request("/api/v1/health")[0],200)
    def test_read_only(self):
        self.assertEqual(self.request("/api/v1/health",method="POST")[0],405)
    def test_quota(self):
        self.app.quota=Quota(str(Path(self.tmp.name)/"low.db"),limit=1,clock=lambda:120)
        self.assertEqual(self.request("/api/v1/health")[0],200)
        status,headers,body=self.request("/api/v1/health")
        self.assertEqual(status,429)
        self.assertEqual(headers["Retry-After"],"60")
        self.assertEqual(body["error"],"quota_exceeded")
    def test_news(self):
        status,headers,body=self.request("/api/v1/news?q=central&limit=1")
        self.assertEqual(status,200)
        self.assertEqual(len(body["stories"]),1)
        self.assertEqual(body["stories"][0]["title"],"Central bank decision")
        self.assertEqual(body["status"],"partial")
        self.assertEqual(headers["Cache-Control"],"no-store")
    def test_stale(self):
        self.doc["generated_at"]=(self.now-timedelta(hours=25)).isoformat()
        self.assertEqual(self.request("/api/v1/news")[0],503)
    def test_unavailable(self):
        for path in ("/api/v1/history?symbol=AAPL&exchange=NASDAQ","/api/v1/search?q=Apple","/api/v1/filings?cik=320193"):
            self.assertEqual(self.request(path)[0],503)
    def test_invalid(self):
        self.assertEqual(self.request("/api/v1/news?limit=101")[0],400)
        self.assertEqual(self.request("/api/v1/news?limit=1&limit=2")[0],400)
    def test_quota_failure(self):
        class Broken:
            def allow(self,client): raise OSError("fixture")
        self.app.quota=Broken()
        self.assertEqual(self.request("/api/v1/health")[0],503)
if __name__=="__main__": unittest.main()
