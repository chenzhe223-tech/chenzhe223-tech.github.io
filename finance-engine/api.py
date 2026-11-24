"""Authenticated internal API contract, usable with injected providers.
No external calls or provider enablement at import time.
"""
import json
import hmac
from urllib.parse import parse_qs
from market import route
from sec_provider import SEC

class FinanceAPI:
    def __init__(self,token,market_providers=(),search_providers=(),sec=None,quota=None):
        if not isinstance(token,str) or len(token)<24: raise ValueError("strong internal token required")
        self.token=token
        self.market_providers=tuple(market_providers)
        self.search_providers=tuple(search_providers)
        self.sec=sec
        self.quota=quota
    def __call__(self,environ,start_response):
        def reply(code,data,extra=()):
            body=json.dumps(data,ensure_ascii=False,allow_nan=False).encode()
            start_response(code,[("Content-Type","application/json; charset=utf-8"),("Cache-Control","no-store"),("X-Content-Type-Options","nosniff"),("Content-Length",str(len(body))),*extra])
            return [body]
        if environ.get("REQUEST_METHOD")!="GET": return reply("405 Method Not Allowed",{"error":"read_only"})
        auth=environ.get("HTTP_AUTHORIZATION","")
        if not hmac.compare_digest(auth.encode(),("Bearer "+self.token).encode()): return reply("401 Unauthorized",{"error":"unauthorized"})
        if self.quota is not None:
            try:
                allowed,retry=self.quota.allow(self.token)
            except Exception:
                return reply("503 Service Unavailable",{"error":"quota_unavailable"})
            if not allowed:
                return reply("429 Too Many Requests",{"error":"quota_exceeded"},[("Retry-After",str(retry))])
        path=environ.get("PATH_INFO","")
        try:
            query=parse_qs(environ.get("QUERY_STRING",""),max_num_fields=12)
            def arg(name,default=""):
                v=query.get(name,[default])
                if len(v)!=1 or len(v[0])>128: raise ValueError("invalid parameter")
                return v[0]
            if path=="/api/v1/health":
                return reply("200 OK",{"service":"finance-engine","market_providers":[p.name for p in self.market_providers],"search_providers":[p.name for p in self.search_providers],"sec_configured":self.sec is not None,"live_status":"not_checked"})
            if path=="/api/v1/history":
                result=route(self.market_providers,arg("symbol"),arg("exchange"),int(arg("days","90")))
                return reply("200 OK" if result["status"]=="ok" else "503 Service Unavailable",result)
            if path=="/api/v1/search":
                q=arg("q").strip()
                if not q: raise ValueError("query required")
                rows={}; diagnostics=[]
                for provider in self.search_providers:
                    try:
                        for item in provider.search(q):
                            key=(item["symbol"].upper(),item["exchange"].upper())
                            rows.setdefault(key,item)
                        diagnostics.append({"provider":provider.name,"status":"ok"})
                    except Exception as exc:
                        diagnostics.append({"provider":provider.name,"status":"unavailable","error_type":type(exc).__name__})
                available=any(d["status"]=="ok" for d in diagnostics)
                return reply("200 OK" if available else "503 Service Unavailable",{"status":"ok" if available else "unavailable","results":list(rows.values())[:50],"diagnostics":diagnostics})
            if path=="/api/v1/filings":
                if self.sec is None: return reply("503 Service Unavailable",{"status":"unavailable","reason":"SEC provider not configured"})
                rows=self.sec.filings(arg("cik"),int(arg("years","3")))
                return reply("200 OK",{"status":"ok","filings":rows,"archive_status":"metadata_only"})
            return reply("404 Not Found",{"error":"not_implemented"})
        except (ValueError,TypeError,KeyError): return reply("400 Bad Request",{"error":"invalid_request_or_provider_payload"})
        except Exception: return reply("503 Service Unavailable",{"error":"upstream_unavailable"})
