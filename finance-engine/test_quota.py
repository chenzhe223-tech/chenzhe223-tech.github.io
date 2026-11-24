import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from quota import Quota
from api import FinanceAPI

class QuotaTests(unittest.TestCase):
    def test_concurrent(self):
        with tempfile.TemporaryDirectory() as d:
            q=Quota(str(Path(d)/"quota.db"),limit=7,clock=lambda:120)
            with ThreadPoolExecutor(max_workers=8) as pool:
                results=list(pool.map(lambda _:q.allow("client"),range(32)))
            self.assertEqual(sum(ok for ok,_ in results),7)
            self.assertTrue(all(retry==60 for ok,retry in results if not ok))
    def test_persistence_and_reset(self):
        with tempfile.TemporaryDirectory() as d:
            path=str(Path(d)/"quota.db")
            now=[119]
            q=Quota(path,limit=1,clock=lambda:now[0])
            self.assertEqual(q.allow("a"),(True,0))
            q=Quota(path,limit=1,clock=lambda:now[0])
            self.assertEqual(q.allow("a"),(False,1))
            self.assertEqual(q.allow("b"),(True,0))
            now[0]=120
            self.assertEqual(q.allow("a"),(True,0))
    def test_api(self):
        with tempfile.TemporaryDirectory() as d:
            token="fixture-token-not-a-real-secret"
            app=FinanceAPI(token,quota=Quota(str(Path(d)/"q.db"),limit=1,clock=lambda:120))
            def request(auth):
                result=[]
                app({"REQUEST_METHOD":"GET","PATH_INFO":"/api/v1/health","HTTP_AUTHORIZATION":auth},lambda status,headers:result.extend([status,dict(headers)]))
                return result
            self.assertTrue(request("wrong")[0].startswith("401"))
            self.assertTrue(request("Bearer "+token)[0].startswith("200"))
            status,headers=request("Bearer "+token)
            self.assertTrue(status.startswith("429"))
            self.assertEqual(headers["Retry-After"],"60")
if __name__=="__main__": unittest.main()
