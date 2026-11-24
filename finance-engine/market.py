"""Provider-neutral market data contracts. No network by default."""
import datetime as dt
import math
import re

def number(value):
    if isinstance(value, bool): raise ValueError("invalid number")
    x=float(value)
    if not math.isfinite(x): raise ValueError("nonfinite number")
    return x

def instrument(symbol, exchange):
    symbol=str(symbol).strip().upper()
    exchange=str(exchange).strip().upper()
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9.\-]{0,19}",symbol) or not re.fullmatch(r"[A-Z0-9]{2,12}",exchange):
        raise ValueError("explicit symbol and exchange required")
    return symbol,exchange

def normalize_history(payload, symbol, exchange, provider, source_url, now=None):
    symbol,exchange=instrument(symbol,exchange)
    now=now or dt.datetime.now(dt.timezone.utc)
    meta=payload.get("meta",{})
    if str(meta.get("symbol","")).upper()!=symbol or str(meta.get("exchange","")).upper()!=exchange:
        raise ValueError("instrument mismatch")
    currency=str(meta.get("currency","")).upper()
    if not re.fullmatch("[A-Z]{3}",currency): raise ValueError("currency missing")
    rows={}
    for row in payload["values"]:
        day=dt.date.fromisoformat(row["datetime"])
        if day>now.date()+dt.timedelta(days=1): raise ValueError("future bar")
        o,h,l,c=[number(row[k]) for k in ("open","high","low","close")]
        v=number(row["volume"]) if row.get("volume") not in (None,"") else None
        if min(o,h,l,c)<=0 or h<max(o,l,c) or l>min(o,h,c) or (v is not None and v<0):
            raise ValueError("invalid OHLCV")
        bar={"date":day.isoformat(),"open":o,"high":h,"low":l,"close":c,"volume":v}
        if day in rows and rows[day]!=bar: raise ValueError("conflicting duplicate")
        rows[day]=bar
    if not rows: raise ValueError("empty series")
    return {"status":"ok","symbol":symbol,"exchange":exchange,"currency":currency,
            "provider":provider,"source_url":source_url,"retrieved_at":now.isoformat(),
            "delay_status":"unknown","interval":"1day","adjustment":"unknown",
            "bars":[rows[d] for d in sorted(rows)]}

def route(providers,symbol,exchange,days=90):
    symbol,exchange=instrument(symbol,exchange)
    if not isinstance(days,int) or not 1<=days<=1000: raise ValueError("invalid days")
    failures=[]
    for provider in providers:
        try:
            result=provider.history(symbol,exchange,days)
            if result.get("status")!="ok" or not result.get("bars"): raise ValueError("no data")
            if result.get("symbol")!=symbol or result.get("exchange")!=exchange: raise ValueError("instrument mismatch")
            return {**result,"fallback_diagnostics":failures}
        except (ValueError,TypeError,KeyError,OSError,RuntimeError) as exc:
            failures.append({"provider":provider.name,"error_type":type(exc).__name__})
    return {"status":"unavailable","symbol":symbol,"exchange":exchange,"bars":[],"fallback_diagnostics":failures}
