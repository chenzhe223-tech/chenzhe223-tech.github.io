"""Persistent per-client fixed-window request quota for a single SQLite host."""
import sqlite3
import time
import hashlib

class Quota:
    def __init__(self,path,limit=60,window=60,clock=time.time):
        if type(limit) is not int or limit<1 or type(window) is not int or window<1:
            raise ValueError("invalid quota")
        self.path=path
        self.limit=limit
        self.window=window
        self.clock=clock
        with sqlite3.connect(path,timeout=5) as db:
            db.execute("CREATE TABLE IF NOT EXISTS quota (client TEXT, bucket INTEGER, count INTEGER NOT NULL, PRIMARY KEY(client,bucket))")
    def allow(self,client):
        now=int(self.clock())
        bucket=now//self.window
        key=hashlib.sha256(client.encode()).hexdigest()
        with sqlite3.connect(self.path,timeout=5) as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM quota WHERE bucket < ?",(bucket-1,))
            row=db.execute("SELECT count FROM quota WHERE client=? AND bucket=?",(key,bucket)).fetchone()
            if row and row[0]>=self.limit:
                return False,self.window-now%self.window
            db.execute("INSERT INTO quota VALUES (?,?,1) ON CONFLICT(client,bucket) DO UPDATE SET count=count+1",(key,bucket))
            return True,0
