# @file   ops/test/stub-website.py
# @module ops/test
# @brief  A stand-in for the Seasonal Entertainment website's Mini Games endpoints, for the installer test.
#
# Responsibility: answer like the website (its server/src/bingo/routes.js, generalised for
#                 mini-games, docs/AUTH.md) while /state/mini-games-on exists, else 404 on every
#                 Mini Games path (the website with Mini Games switched off):
#                 GET /api/games/mini-games/authorize — without X-Original-Method GET/HEAD/OPTIONS
#                 403 (the website fails closed); carrying X-Smg-Proxy-Secret 500 (the secret
#                 must never reach the website); with the cookie "stub_user=u-1" 204 and the six
#                 identity headers; anyone else 204 with X-Acting-Guest: true alone (never 401).
#                 GET /api/games/mini-games/account-changes — 200 and an empty page with the token
#                 of /etc/seasonal/games-sync-token in X-Games-Sync-Token, else 401.
#                 GET /embed/chat?room=mini-games — 200 (the chat room's page); GET /login 200;
#                 every other path 200 "the website". Adapted from Bingo's ops/test/stub-website.py.
#                 Test only: never part of an install.
# Used by:        ops/test/website-cases.sh (service "site" of the stand-in website)
# Spec:           docs/spec/07-integration.md §2; docs/spec/10-repository-structure.md §6

import base64
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PREFIX = "/api/games/mini-games/"
READS = {"GET", "HEAD", "OPTIONS"}
STEPS = base64.urlsafe_b64encode(json.dumps([{"ladder": "events", "name": "Gold", "icon": None}]).encode()).decode().rstrip("=")
MEMBER = {
    "X-Acting-User-Id": "u-1",
    "X-Acting-User": "Walter",
    "X-Acting-User-Roles": "member",
    "X-Acting-User-Email-Verified": "true",
    "X-Acting-User-Can-Host": "true",
    "X-Acting-User-Steps": STEPS,
}


def switched_on():
    return os.path.exists("/state/mini-games-on")


def sync_token():
    try:
        with open("/etc/seasonal/games-sync-token", encoding="utf-8") as file:
            return file.read().strip()
    except OSError:
        return None


class Handler(BaseHTTPRequestHandler):
    def answer(self, status, headers=None, body=b""):
        self.send_response(status)
        self.send_header("Cache-Control", "no-store")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorize(self):
        if self.headers.get("X-Smg-Proxy-Secret") is not None:
            return self.answer(500)
        if (self.headers.get("X-Original-Method") or "").upper() not in READS:
            return self.answer(403)
        member = "stub_user=u-1" in (self.headers.get("Cookie") or "")
        self.answer(204, MEMBER if member else {"X-Acting-Guest": "true"})

    def account_changes(self):
        token = sync_token()
        if token is None or self.headers.get("X-Games-Sync-Token") != token:
            return self.answer(401)
        self.answer(200, {"Content-Type": "application/json"}, b'{"changes":[],"cursor":"0"}')

    def do_GET(self):
        path = self.path.split("?")[0]
        mini = path.startswith(PREFIX) or path == "/embed/chat" and "room=mini-games" in self.path
        if mini and not switched_on():
            self.answer(404)
        elif path == PREFIX + "authorize":
            self.authorize()
        elif path == PREFIX + "account-changes":
            self.account_changes()
        elif path in ("/embed/chat", "/login"):
            self.answer(200, {"Content-Type": "text/html"}, b"<p>" + path.encode() + b"</p>\n")
        else:
            self.answer(200, {"Content-Type": "text/plain"}, b"the website\n")


ThreadingHTTPServer(("0.0.0.0", 3800), Handler).serve_forever()
