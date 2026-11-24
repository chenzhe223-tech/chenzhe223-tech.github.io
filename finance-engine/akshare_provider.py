"""AKShare mainland daily bars. Explicit authorization and injected client."""
import datetime as dt
import re
from market import normalize_history, instrument

def mainland_exchange(code):
    if re.fullmatch(r"(60|68)\d{4}",code): return "SSE"
    if re.fullmatch(r"(00|30)\d{4}",code): return "SZSE"
    if re.fullmatch(r"(43|83|87|88|92)\d{4}",code): return "BSE"
    return None

class AKShare:
    name="akshare"
    def __init__(self, client=None, *, authorized=False):
        self.client=client
        self.authorized=authorized
    def _client(self):
        if not self.authorized: raise RuntimeError("provider rights not approved")
        if self.client is None:
            import akshare
            self.client=akshare
        return self.client
    def search(self,q):
        q=str(q).strip().casefold()
        if not q: return []
        rows=self._client().stock_info_a_code_name().to_dict("records")
        result=[]
        for row in rows:
            code=str(row["code"]).zfill(6)
            name=str(row["name"])
            exchange=mainland_exchange(code)
            if exchange and (q in code or q in name.casefold()):
                result.append({"symbol":code,"name":name,"exchange":exchange,"currency":"CNY","provider":self.name})
        return result[:50]
    def history(self,symbol,exchange,days):
        symbol,exchange=instrument(symbol,exchange)
        if mainland_exchange(symbol)!=exchange: raise ValueError("exchange mismatch")
        if type(days) is not int or not 1<=days<=1000: raise ValueError("invalid days")
        today=dt.date.today()
        start=today-dt.timedelta(days=days*2+14)
        rows=self._client().stock_zh_a_hist(symbol=symbol,period="daily",start_date=start.strftime("%Y%m%d"),end_date=today.strftime("%Y%m%d"),adjust="").to_dict("records")
        values=[]
        for r in rows:
            if str(r.get("股票代码",symbol)).zfill(6)!=symbol: raise ValueError("upstream ticker mismatch")
            values.append({"datetime":str(r["日期"])[:10],"open":r["开盘"],"high":r["最高"],"low":r["最低"],"close":r["收盘"],"volume":float(r["成交量"])*100})
        values.sort(key=lambda r:r["datetime"])
        data=normalize_history({"meta":{"symbol":symbol,"exchange":exchange,"currency":"CNY"},"values":values[-days:]},symbol,exchange,self.name,"https://akshare.akfamily.xyz/")
        return {**data,"adjustment":"unadjusted","volume_unit":"shares","interval":"1day"}
