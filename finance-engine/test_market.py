import unittest
import datetime as dt
from market import normalize_history, route
from twelve_data import TwelveData
NOW=dt.datetime(2026,11,24,tzinfo=dt.timezone.utc)
def payload():
    return {"meta":{"symbol":"AAPL","exchange":"NASDAQ","currency":"USD"},"values":[{"datetime":"2026-11-23","open":"100","high":"110","low":"95","close":"105","volume":"1000"}]}
class MarketTests(unittest.TestCase):
    def test_valid(self):
        x=normalize_history(payload(),"AAPL","NASDAQ","test","https://example.org",NOW)
        self.assertEqual(x["bars"][0]["close"],105)
        self.assertEqual(x["delay_status"],"unknown")
    def test_wrong_exchange(self):
        with self.assertRaises(ValueError): normalize_history(payload(),"AAPL","NYSE","test","https://example.org",NOW)
    def test_invalid_ohlc(self):
        p=payload();p["values"][0]["high"]="90"
        with self.assertRaises(ValueError): normalize_history(p,"AAPL","NASDAQ","test","https://example.org",NOW)
    def test_disabled(self):
        x=route([TwelveData("dummy")],"AAPL","NASDAQ")
        self.assertEqual(x["status"],"unavailable")
    def test_fallback(self):
        class Good:
            name="fixture"
            def history(self,symbol,exchange,days):
                return normalize_history(payload(),symbol,exchange,self.name,"https://example.org",NOW)
        x=route([TwelveData("dummy"),Good()],"AAPL","NASDAQ")
        self.assertEqual(x["provider"],"fixture")
        self.assertEqual(len(x["fallback_diagnostics"]),1)
    def test_nonfinite(self):
        p=payload();p["values"][0]["close"]="NaN"
        with self.assertRaises(ValueError): normalize_history(p,"AAPL","NASDAQ","test","https://example.org",NOW)
if __name__=="__main__": unittest.main()
