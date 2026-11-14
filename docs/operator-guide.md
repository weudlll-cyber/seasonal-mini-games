# Operator guide — installing and running Seasonal Mini Games on a VPS

Two ways to install, chosen by the installer's first question:

- **Standalone** — the games on their own domain (e.g. `games.example.org`) with their own HTTPS.
- **Website** — the games inside the Seasonal Entertainment website on the same server, at `https://<website domain>/games/mini-games/`, behind the website's own proxy.

Seasonal Mini Games can run **next to Seasonal Bingo Royale on the same server** (section 9). There is no signed release image yet, so the installer builds the app on the server from the source code (a few minutes). Commands in grey boxes are typed exactly as shown; `<…>` is replaced by your value.

## 1. What to prepare (both types)

1. **A VPS** with Ubuntu 24.04. Good size: 4 CPU, 8 GB RAM, 100 GB disk. Smallest that works: 2 CPU, 4 GB RAM, 20 GB free disk.
2. **An SSH key** on your Windows PC (skip if you have one). In PowerShell:
   ```
   ssh-keygen -t ed25519
   ```
   Press Enter for the default file. When you order the VPS, give the provider the content of `C:\Users\<you>\.ssh\id_ed25519.pub` as your SSH key (or, later, add that line to `/root/.ssh/authorized_keys` on the server).
3. **An age key for the backups.** Backups are encrypted so that only you can open them. In PowerShell:
   ```
   winget install FiloSottile.age
   age-keygen -o $HOME\smg-age-key.txt
   ```
   It prints a line `Public key: age1…`; the installer asks for that public key. **Keep `smg-age-key.txt` safe and never leave it on the server**: without it no backup can be opened; with it anyone can. (If you run Bingo too, you may use the same key for both.)
4. **Standalone only: a domain** (e.g. `games.example.org`) with an **A record** pointing at the VPS's IPv4 address (and an AAAA record for IPv6 if the VPS has one). Set it before installing; HTTPS certificates come automatically once the name points at the server. Without a domain you can install on the bare IP address, but browsers then warn about the certificate.
5. **Website only:** the Seasonal Entertainment website must already run on this VPS with Mini Games switched on (its `docs/DEPLOYMENT.md`; section 3, step 2).

## 2. Install — standalone

1. Log in to the VPS from PowerShell:
   ```
   ssh root@<VPS address>
   ```
2. Fetch the installer and run it (the one install command):
   ```
   git clone https://github.com/weudlll-cyber/seasonal-mini-games.git smg && sudo bash smg/ops/install.sh
   ```
   It builds the branch you cloned (`git clone -b <branch> …` for another one; `--ref <branch or tag>` overrides it, and a re-run keeps the ref of the last install, DECISIONS T244).
3. Answer the questions: **standalone**; environment **prod**; your **domain** (or the IP address); your **e-mail** (for certificates); your **age public key** (`age1…`). For an unattended run every answer is a flag (top of `ops/install.sh`), with `--yes`.
4. Wait until it says **Done**. It installs Docker if needed, builds the app, starts it and checks that it answers.
5. Create the first admin (section 4), then open `https://<your domain>/`.

## 3. Install — inside the Seasonal Entertainment website

1. Log in to the VPS (`ssh root@<VPS address>`).
2. **Switch Mini Games on in the website** (once). In the website's checkout on the same server (usually `/opt/seasonal-entertainment`):
   ```
   cd /opt/seasonal-entertainment && sudo ./deploy/install.sh --update --mini-games
   ```
   Answer **yes** to its Mini Games question. The website then serves its sign-in check for the games, makes the sync token for the account feed and prepares its proxy for the game's route.
3. Run the same command as in section 2:
   ```
   git clone https://github.com/weudlll-cyber/seasonal-mini-games.git smg && sudo bash smg/ops/install.sh
   ```
4. Answer the questions: **website**; environment **prod**; your **age public key** (`age1…`). Nothing else is asked: the installer finds the website (its own Caddy or nginx), its domain, its network and what the website prepared. It asks for the domain or the network only if it cannot tell.
5. Wait until it says **Done**. It installs Docker if needed, builds and starts the app, and writes the game's route into the website's proxy: `/etc/seasonal/routes/mini-games.conf` for nginx, `mini-games.caddy` in the website's Caddy routes folder for Caddy (0600, it holds the proxy secret). It checks the website's configuration (`nginx -t` or `caddy validate`), reloads it and checks through the website that the games, the sign-in and the chat room `mini-games` answer. You edit no file of the website, and there is no step afterwards.
6. If the installer stops with "the website does not serve Mini Games yet", step 2 is missing: run the command it prints, then the installer again (it keeps your answers).
7. Open `https://<website domain>/games/mini-games/` and sign in with your website account. Players sign in only through the website. Its admins are the game's admins, and members it lets start games may host. Guests can watch matches and leaderboards. The chat is the website's room `mini-games`.
8. Make yourself the super admin (section 4, "On a website install") after that first sign-in.

## 4. Create the first admin

**On a standalone install:**

```
sudo smg admin create-super
```

It asks for e-mail, display name (3–24 letters or digits) and a password of at least 12 characters (not shown while you type). This account can host matches and open the admin app.

**On a website install** players sign in only through the website, so a local account could never sign in: `create-super` refuses there and names the command below. Instead, your website account becomes the super admin:

1. Open `https://<website domain>/games/mini-games/` and sign in once with your website account (that makes its game account).
2. On the server:
   ```
   sudo smg admin promote-super --name <your website name>
   ```
   or, by your website user id, `sudo smg admin promote-super --website-id <id>`. The name is your website name or the name the games show (a number is added when another player has it); upper and lower case do not matter.
3. Reload the games page: you are signed in again, now with the admin app.

It says what it did, or why not: nobody with that id or name has signed in to the games yet (sign in first), several members have that name (use `--website-id`; it lists their ids), or the account is suspended. The super admin role stays at every later sign-in: the website's roles only decide game admin and host rights. Running it again only says that the account is super admin already.

## 5. Backups to your Windows PC

The server makes an encrypted backup every night at 03:30 in `/var/backups/smg/prod/` and keeps the 14 newest plus one a week for 8 more weeks. The files belong to the group `smg-backup`, so a normal user can pull them; root login over SSH can stay off.

1. Once, on the server: a user for pulling, in the group `smg-backup`, with your SSH key:
   ```
   sudo adduser --disabled-password --gecos "" backup-pull
   sudo usermod -aG smg-backup backup-pull
   sudo install -d -m 700 -o backup-pull -g backup-pull /home/backup-pull/.ssh
   sudo cp ~/.ssh/authorized_keys /home/backup-pull/.ssh/ && sudo chown backup-pull: /home/backup-pull/.ssh/authorized_keys
   ```
   (With Bingo on the same server, the same user can also be in `sbr-backup`.)
2. Pull the new ones to your PC (only files you do not have yet are copied; a copy counts only when it is complete), in PowerShell from the folder with the source (or copy `ops\pull-backups.ps1` anywhere):
   ```
   powershell -ExecutionPolicy Bypass -File ops\pull-backups.ps1 -Server backup-pull@<VPS address>
   ```
   They land in `Documents\smg-backups\prod`. (Optional: run it daily with Windows Task Scheduler.) On Linux or macOS: `ops/pull-backups.sh backup-pull@<VPS address>`.
3. A backup taken right now: `sudo smg backup`.
4. Check that a backup can really be restored (monthly is good): copy your key up for a moment, run the drill, delete the key:
   ```
   scp $HOME\smg-age-key.txt <you>@<VPS address>:smg-age-key.txt
   ssh -t <you>@<VPS address> "sudo smg restore --drill /var/backups/smg/prod/<file> --identity smg-age-key.txt; rm smg-age-key.txt"
   ```
   It restores into a throw-away database and says how many migrations, accounts, matches and round events came back.
5. A real restore (replaces the live data; it asks first): the same, with `smg restore <file> --identity …` instead of `--drill`. It refuses a backup of another environment (a staging file on prod) unless you add `--force-env`.
6. On a development machine the same drill runs against the dev database: `pnpm drill:dev` (with the dev stack up).

## 6. Updating and rolling back

1. Update to a newer version of the source (a branch, tag or commit):
   ```
   sudo smg update <git ref>
   ```
   It waits up to 10 minutes for running rounds to end (`--now` restarts at once; running rounds then resume from their event log, with their cooldowns and Frost-held answers), takes a backup and a plain database dump for a rollback, then builds and starts the new version (the games are away for a few seconds).
2. All good? Confirm it, which deletes the plain dump (it is not encrypted) and frees the old image:
   ```
   sudo smg confirm
   ```
3. Something wrong after an update (before `smg confirm`)?
   ```
   sudo smg rollback
   ```
   It takes a backup of the current state, asks, and goes back to the version before. **If the update changed the database layout, the database goes back to the moment before the update: accounts, matches and points since then are lost** (they stay in the backup it took first). Without a layout change the data stays as it is.
4. Before a planned update you can stop new matches and rounds: `sudo smg maintenance on` (running rounds finish), and afterwards `sudo smg maintenance off`.
5. Everyday checks: `sudo smg status` (what runs, health, rounds running, last backup) and `sudo smg logs app`.
6. Which version runs? Every game page ends with a small line at its bottom right, "Mini Games · <commit> · <build date>": the first seven characters of the commit `smg update` built, and the day it was built.

## 7. Hardening checklist

1. SSH: keys only, no passwords, no root login (`PasswordAuthentication no`, `PermitRootLogin no` in `/etc/ssh/sshd_config`); work as your own user with `sudo`, and pull backups as the user of section 5. Before turning root login off, check that your own user can log in and use `sudo`.
2. Automatic security updates: `apt install unattended-upgrades` (on by default on Ubuntu 24.04).
3. Firewall: allow only 22, 80 and 443 — `ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw enable`. (With the website installed, keep the website's own ports too, see its DEPLOYMENT.md.)
4. fail2ban for SSH: `apt install fail2ban`.
5. Docker: `live-restore` on (`/etc/docker/daemon.json`: `{ "live-restore": true }`); log rotation is already set by the stack.
6. Domain: a CAA record allowing your certificate authority (Let's Encrypt: `0 issue "letsencrypt.org"`), and DNSSEC if your registrar offers it.
7. Optional: Cloudflare in front for DDoS protection; then the app must trust Cloudflare's addresses (`SMG_TRUSTED_PROXIES` in `/etc/smg/prod.env`).
8. Keep `SMG_ROUND_KEY` in `/etc/smg/prod.env` as it is: it seals the seeds of running rounds; a new key would make them unrecoverable after a restart.

## 8. Good to know

- Settings and secrets live in `/etc/smg/prod.env` (readable by root only). Running the installer again (also with `--yes`) keeps the secrets and your earlier answers, and changes only what you changed; it never switches between standalone and website without asking.
- One environment per server for now: a staging install needs its own VPS (standalone staging would need ports 80/443 of prod, website staging the same `/games/mini-games` route). The installer refuses a second environment on the same server.
- Behind another proxy (nginx, your own Caddy): examples in `ops/examples/`.
- Not there yet: a signed release image (the server builds from source), e-mail sending, a maintenance page for players (maintenance already stops new matches and rounds).

## 9. Next to Seasonal Bingo Royale on one server

Both can be installed as the **website** type on the same server, in either order. Nothing is shared:

|                                         | Seasonal Mini Games                                 | Seasonal Bingo Royale                      |
| --------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| Install root, config, backups           | `/opt/smg`, `/etc/smg`, `/var/backups/smg`          | `/opt/sbr`, `/etc/sbr`, `/var/backups/sbr` |
| CLI                                     | `smg`                                               | `sbr`                                      |
| Compose project, containers, volumes    | `smg-prod` (`smg-prod-app-1`, `smg-prod_pgdata`, …) | `sbr-prod`                                 |
| Name on the website's network, app port | `smg-mini-games-prod:3100`                          | `sbr-bingo-prod:3000`                      |
| Behind nginx: loopback port, subnet     | `127.0.0.1:3920`, `172.30.250.0/24`                 | `127.0.0.1:3900`, `172.30.249.0/24`        |
| Website route and route file            | `/games/mini-games/`, `mini-games.conf` / `.caddy`  | `/games/bingo/`, `bingo.conf` / `.caddy`   |
| Backup group and timer                  | `smg-backup`, `smg-backup@prod.timer`               | `sbr-backup`, `sbr-backup@prod.timer`      |

Two **standalone** installs cannot share a server: both need ports 80 and 443, and the installer refuses when they are taken. A standalone Bingo and a website-type Mini Games cannot share a server either, because the website needs 80 and 443 too.

## 10. Watching it run

- `sudo smg status`: the containers, readiness, the rounds running, the last and next backup, maintenance and, for website installs, the sign-in mode, whether the website's authorize endpoint answers, the account feed's last success and whether the proxy range still matches.
- Logs: `sudo smg logs app` (JSON lines; each request has an id that error answers carry as `requestId`). Docker keeps at most 5 × 20 MB per service, compressed.
- Metrics: the app serves Prometheus metrics at `/metrics` to scrapers on the server only; a request that came through a proxy gets 404. From the server: `sudo docker exec smg-prod-app-1 wget -qO- http://127.0.0.1:3100/metrics`. Worth watching: `smg_guess_ack_seconds` (a guess's answer time), `smg_round_queue_depth`, `smg_round_batch_seconds` (database commits), `smg_special_lag_seconds` and `smg_frost_delivery_lag_seconds` (timers running late), `smg_season_feed_age_seconds` (the In Season feed), `smg_http_requests_total` by status, and the Node process metrics. The full list is in the specification ([06 §4.6](spec/06-data-model-api-realtime.md)).
- Maintenance: while `smg maintenance on` holds, opening a match or a round answers "The games are being updated"; running rounds finish.
