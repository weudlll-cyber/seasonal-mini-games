# Seasonal Mini Games

Short multiplayer games built around the four Seasonal Tokens seasons. Everyone plays the same round at the same time, and the server decides every result. It runs on its own or embedded in a host website, such as the Seasonal Entertainment website.

The first game is **Guess The Number**: the server picks a secret number and players race to find it. Every guess is followed by a short waiting time, and the seasons change the rules for everyone at once.

**Status:** in development; four games are playable, standalone or inside the website.

No prizes of monetary value exist in these games. Players compete for placings and leaderboard rank.

## Install

On an Ubuntu 24.04 server, as root or with `sudo`:

```sh
git clone https://github.com/weudlll-cyber/seasonal-mini-games.git smg
sudo bash smg/ops/install.sh
```

It builds the app from the branch you cloned (here `master`). The installer asks the type first, then only what that type needs:

- **standalone** (own domain, own HTTPS, the game's own accounts and chat): the environment (`prod`), the domain or the server's IP address, the admin e-mail and your age public key for the encrypted backups.
- **website** (inside the Seasonal Entertainment website on the same server, at `/games/mini-games`, sign-in through the website's login and its chat): the environment (`prod`) and your age public key. It finds the website, its domain and its proxy (its own Caddy or nginx) itself, writes the game's route into the website's proxy, reloads it and checks the result. The website must have Mini Games switched on first, in its checkout: `sudo ./deploy/install.sh --update --mini-games`. The installer stops and names this command when it is missing.

The first admin: on a standalone install `sudo smg admin create-super` (e-mail, name, password). A website install has no local accounts (`create-super` refuses there): sign in once through the website, then make that account the super admin with `sudo smg admin promote-super --name <your website name>` (or `--website-id <your website user id>`).

A re-run keeps every earlier answer. Every answer can also be given as a flag, with `--yes` for an unattended run (the top of `ops/install.sh`). The full guide is [docs/operator-guide.md](docs/operator-guide.md).

## License

Copyright (C) 2026 weudlll-cyber. Licensed under the GNU Affero General Public License v3.0 or later ([LICENSE](LICENSE)). The Seasonal Tokens icons, logo and font come from the Seasonal Entertainment website project and are not covered by this licence.
