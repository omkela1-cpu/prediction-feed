# Cloudflare setup (T-014)

Plain steps for Om to put the Kalshi relay online. It takes about 10 minutes. A computer is easier than a phone for steps 3 and 4 (copying the code).

**Why:** Kalshi blocks requests that come straight from a phone browser. The relay is one small program (a "Worker") that runs free on Cloudflare. It asks Kalshi for market data and passes it to the app.

**What it does not need:** no API keys, no passwords, no card, no settings or "bindings". The code is in `kalshi-relay-worker.js` and only reads public market data.

## 1. Create a free Cloudflare account
1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with your email and a new password. Pick the **Free** plan if asked.
3. Open the email from Cloudflare and click the link to confirm your address.
4. If Cloudflare asks you to add a website or domain, skip it. You do not need one.

## 2. Create the Worker
1. In the Cloudflare dashboard, open **Workers & Pages** in the left menu (it may sit under **Compute**).
2. Click **Create application**, then choose **Start with Hello World!**.
3. Name it `prediction-feed-relay`.
4. Click **Deploy**. Cloudflare publishes a demo Worker and shows its address, like
   `https://prediction-feed-relay.YOURNAME.workers.dev`
   If it asks you to choose a `workers.dev` subdomain first, pick any short name (for example your name).

## 3. Paste the relay code
1. Open this page and copy all of the text on it:
   https://raw.githubusercontent.com/omkela1-cpu/prediction-feed/main/kalshi-relay-worker.js
2. Back on the Worker page in Cloudflare, click **Edit code**.
3. In the editor, click inside the file called `worker.js`, select everything (Ctrl+A, or Cmd+A on a Mac) and delete it.
4. Paste the code you copied.
5. Click **Deploy** (top right), and confirm if asked.

## 4. Check it works
1. Copy your Worker address from step 2 and add `/kalshi/event/KXELONMARS-99` to the end, for example:
   `https://prediction-feed-relay.YOURNAME.workers.dev/kalshi/event/KXELONMARS-99`
2. Open that in a browser. The first time can take a few seconds.
3. Good result: a page of text that starts with `{"event":{` and mentions Elon Musk and Mars.
4. Bad result: an error page. Note what it says (see "If something goes wrong" below).

Note: the relay does not choose which markets are hot. A scheduled GitHub job does that every 10 minutes (see `scripts/kalshi-top.mjs`). The relay only supplies live prices for them.

## 5. Try it in the app (this phone only)
1. Open the app: https://omkela1-cpu.github.io/prediction-feed/
2. Tap the gear (Settings).
3. In **Kalshi relay URL**, paste your Worker address only, without any path after `.workers.dev`, for example
   `https://prediction-feed-relay.YOURNAME.workers.dev`
4. Tap **Save**. Kalshi markets are already in the app from the hot list; after saving, their prices should become live and the note about older prices disappears.

## 6. Make it the default for every device
Settings only changes one phone. To make it permanent, send the Worker address to the coding agent (that is backlog item T-015), or do it yourself on GitHub:
1. Open https://github.com/omkela1-cpu/prediction-feed/blob/main/index.html
2. Click the pencil icon (Edit).
3. Find this line:
   `const KALSHI_RELAY_URL = "";`
4. Paste your Worker address between the quotes, for example
   `const KALSHI_RELAY_URL = "https://prediction-feed-relay.YOURNAME.workers.dev";`
5. Click **Commit changes**. The live app updates within a few minutes.

## Updating the relay later
If an agent changes `kalshi-relay-worker.js`, repeat step 3 (copy, Edit code, paste, Deploy). The Worker address stays the same.

## If something goes wrong
- **`{"error":"origin not allowed"}`**: the relay only answers the app at `https://omkela1-cpu.github.io`. This is expected from any other website.
- **Error 1102, or "Worker exceeded resource limits"**: the free plan limits how much work each call can do. Tell the agent. A quick fix is to change `PAGES_PER_CALL = 2` to `PAGES_PER_CALL = 1` near the top of the code and Deploy again.
- **`{"error":"Kalshi unavailable"}`** or **`Kalshi HTTP ...`**: Kalshi did not answer. Wait a minute and try again.
- **The app still says Kalshi is off**: the relay URL is empty. Check step 5 or step 6.

## Free plan limits
The free plan allows 100,000 calls a day. The app makes about one call a minute while it is open, so one person stays far below that.
