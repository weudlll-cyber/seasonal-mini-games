# @file   ops/test/stub-app.py
# @module ops/test
# @brief  A stand-in for the app in the installer test's website cases (the installer is under test, not the app).
#
# Responsibility: listen on 3100 under SMG_BASE_PATH like the app, with what the installer's
#                 proxy route and checks touch: /healthz and /readyz (its websiteFeed.lastSuccessAt
#                 set once the website's account-changes feed at SMG_WEBSITE_LOCAL_URL answered
#                 200 to SMG_WEBSITE_SYNC_TOKEN, polled every 2 s); <base> 200; <base>auth/website
#                 403 without the right X-Smg-Proxy-Secret, a member (X-Acting-User-Id and
#                 X-Acting-User) sent to "next" with the cookie smg_stub=<id>:<name>:<can host>:<steps
#                 present>, a guest sent to <base>auth/website/login with "next";
#                 <base>auth/website/login to SMG_WEBSITE_LOGIN_PATH with the sign-in route and
#                 "next"; <base>api/v1/session the identity and secret headers it was sent (JSON);
#                 <base>metrics 200 (the proxy must answer it 404). Test only: never part of an install.
# Used by:        ops/test/website-cases.sh (built as the image smg-app:<commit>)
# Spec:           docs/spec/10-repository-structure.md §6

import hmac
import json
import os
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlsplit

BASE = os.environ.get("SMG_BASE_PATH", "/")
SECRET = os.environ.get("SMG_WEBSITE_PROXY_SECRET", "")
LOGIN = os.environ.get("SMG_WEBSITE_LOGIN_PATH", "/login?next=")
FEED = {"lastSuccessAt": None}


def poll_feed():
    url = os.environ.get("SMG_WEBSITE_LOCAL_URL", "") + "/api/games/mini-games/account-changes?since=0"
    token = os.environ.get("SMG_WEBSITE_SYNC_TOKEN", "")
    while True:
        try:
            request = urllib.request.Request(url, headers={"X-Games-Sync-Token": token})
            with urllib.request.urlopen(request, timeout=3) as answer:
                if answer.status == 200:
                    FEED["lastSuccessAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        except Exception:  # noqa: BLE001 - the stand-in keeps polling, as the app's poller backs off
            pass
        time.sleep(2)


class Handler(BaseHTTPRequestHandler):
    def answer(self, status, headers=None, body=b""):
        self.send_response(status)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def json(self, value):
        self.answer(200, {"Content-Type": "application/json"}, json.dumps(value).encode())

    def sign_in(self, nxt):
        given = self.headers.get("X-Smg-Proxy-Secret") or ""
        if not SECRET or not hmac.compare_digest(given, SECRET):
            return self.answer(403)
        user_id, name = self.headers.get("X-Acting-User-Id"), self.headers.get("X-Acting-User")
        if user_id and name:
            steps = "steps" if self.headers.get("X-Acting-User-Steps") else "none"
            cookie = f"smg_stub={user_id}:{name}:{self.headers.get('X-Acting-User-Can-Host')}:{steps}"
            return self.answer(302, {"Location": nxt, "Set-Cookie": cookie})
        self.answer(302, {"Location": f"{BASE}auth/website/login?next={quote(nxt, safe='')}"})

    def do_GET(self):
        url = urlsplit(self.path)
        path = "/" + url.path[len(BASE):] if url.path.startswith(BASE) else url.path
        nxt = parse_qs(url.query).get("next", [BASE])[0]
        if path == "/healthz":
            self.json({"status": "ok"})
        elif path == "/readyz":
            self.json({"status": "ready", "websiteFeed": FEED})
        elif path == "/auth/website":
            self.sign_in(nxt)
        elif path == "/auth/website/login":
            back = f"{BASE}auth/website?next={quote(nxt, safe='')}"
            self.answer(302, {"Location": LOGIN + quote(back, safe="")})
        elif path == "/api/v1/session":
            seen = {k: v for k, v in self.headers.items() if k.lower().startswith(("x-acting-", "x-smg-"))}
            self.json({"headers": seen})
        elif path.startswith("/metrics"):
            self.answer(200, body=b"metrics\n")
        elif path == "/":
            self.answer(200, {"Content-Type": "text/html"}, b"<p>Seasonal Mini Games (stand-in)</p>\n")
        else:
            self.answer(404)


threading.Thread(target=poll_feed, daemon=True).start()
ThreadingHTTPServer(("0.0.0.0", 3100), Handler).serve_forever()
