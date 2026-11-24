"""Twelve Data adapter; explicitly opt in only after data rights review."""
import json
import urllib.request
import urllib.parse
from market import normalize_history

class TwelveData:
    name="twelve_data"
    def __init__(self, key, *, authorized=False, opener=urllib.request.urlopen):
        self.key=key
        self.authorized=authorized
        self.opener=opener
    def history(self,symbol,exchange,days):
        if not self.authorized or not self.key:
            raise RuntimeError("provider disabled until entitlement verified")
        params=urllib.parse.urlencode({"symbol":symbol,"exchange":exchange,"interval":"1day","outputsize":days,"apikey":self.key})
        request=urllib.request.Request("https://api.twelvedata.com/time_series?"+params,headers={"Accept":"application/json"})
        with self.opener(request,timeout=12) as response:
            data=response.read(2_000_001)
        if len(data)>2_000_000: raise ValueError("oversized response")
        payload=json.loads(data)
        if payload.get("status")=="error": raise ValueError("upstream rejected")
        return normalize_history(payload,symbol,exchange,self.name,"https://twelvedata.com/docs")
