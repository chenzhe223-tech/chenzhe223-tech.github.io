"""SEC public filing discovery. Metadata only, no document download."""
import datetime as dt
import json
import re
import time
import urllib.request
from urllib.parse import quote

INDEX="https://www.sec.gov/files/company_tickers_exchange.json"
FORMS={"10-K","20-F","40-F"}

def search_index(payload,q,limit=30):
    q=str(q).strip().casefold()
    if not q: return []
    fields=payload["fields"]
    results=[]
    for values in payload["data"]:
        row=dict(zip(fields,values))
        ticker=str(row.get("ticker") or "")
        name=str(row.get("name") or "")
        exchange=str(row.get("exchange") or "")
        cik=str(row.get("cik") or "")
        if not ticker or not name or not cik.isdigit(): continue
        if q not in ticker.casefold() and q not in name.casefold(): continue
        results.append({"symbol":ticker,"name":name,"exchange":exchange,"cik":cik.zfill(10),
                        "provider":"sec_edgar","source_url":INDEX})
    results.sort(key=lambda r:(r["symbol"].casefold()!=q,r["name"].casefold()!=q,r["symbol"]))
    return results[:max(1,min(50,limit))]

def annual_filings(payload,cik,years=3):
    if type(years) is not int or not 1<=years<=3: raise ValueError("years must be 1..3")
    if not re.fullmatch(r"\d{1,10}",str(cik)): raise ValueError("invalid CIK")
    if int(payload["cik"])!=int(cik): raise ValueError("CIK mismatch")
    recent=payload["filings"]["recent"]
    results={}
    for form,accession,doc,filed,period in zip(*(recent[k] for k in ("form","accessionNumber","primaryDocument","filingDate","reportDate"))):
        if form not in FORMS or not re.fullmatch(r"\d{10}-\d{2}-\d{6}",accession) or not re.fullmatch(r"[A-Za-z0-9_.-]+",doc or ""): continue
        try:
            date=dt.date.fromisoformat(period); filing=dt.date.fromisoformat(filed)
        except (TypeError,ValueError): continue
        if filing<date: continue
        url=f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-','')}/{quote(doc)}"
        row={"form":form,"accession":accession,"report_date":period,"filed_at":filed,"url":url,
             "provider":"sec_edgar","archive_status":"metadata_only"}
        if period not in results or filed>results[period]["filed_at"]: results[period]=row
    return sorted(results.values(),key=lambda r:r["report_date"],reverse=True)[:years]

class SEC:
    name="sec_edgar"
    def __init__(self,contact,opener=urllib.request.urlopen):
        if not contact or "@" not in contact or any(c in contact for c in "\r\n"): raise ValueError("real contact email required")
        self.agent="DAVYLAB Finance Engine "+contact
        self.opener=opener
        self.last=0
    def _json(self,url):
        time.sleep(max(0,0.25-(time.monotonic()-self.last)))
        self.last=time.monotonic()
        with self.opener(urllib.request.Request(url,headers={"User-Agent":self.agent,"Accept":"application/json"}),timeout=15) as res:
            raw=res.read(12_000_001)
        if len(raw)>12_000_000: raise ValueError("oversized SEC response")
        return json.loads(raw)
    def search(self,q): return search_index(self._json(INDEX),q)
    def filings(self,cik,years=3):
        if not re.fullmatch(r"\d{1,10}",str(cik)): raise ValueError("invalid CIK")
        return annual_filings(self._json(f"https://data.sec.gov/submissions/CIK{str(cik).zfill(10)}.json"),cik,years)
