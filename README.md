# Prediction Feed

A read-only phone app that shows the highest-volume prediction markets from Polymarket and Kalshi, grouped into topic buckets, with live prices and pins. No trading, no keys, no backend.

## Run it
It is one static file. Host it on GitHub Pages:
1. Repo Settings > Pages > Deploy from branch > `main` / root.
2. Open `https://<username>.github.io/prediction-feed/` on your phone.
3. Share > Add to Home Screen.

## Project management (ALM)
Everything an agent or person needs is in the repo:
- `AGENTS.md`: rules and workflow for any coding bot (Grok, Claude, others).
- `docs/REQUIREMENTS.md`: what the app must do and its status.
- `docs/BACKLOG.md`: tasks and status.
- `docs/ACTIVITY_LOG.md`: what each agent did and how it was tested.
- `docs/DECISIONS.md`: why things are the way they are.

To see what a bot has done: read `docs/ACTIVITY_LOG.md` and the commit history.
To hand a bot work: set a backlog item to `TODO` and point the bot at `AGENTS.md`.

## Kalshi note
If Kalshi shows a warning in the app, it may be blocking browser access. Deploy `kalshi-relay-worker.js` as a free Cloudflare Worker and paste its URL in Settings.
