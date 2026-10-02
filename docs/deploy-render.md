# Put PersonBrief online with Render

This takes about 15 minutes, most of it waiting for the first build. You need
a Render account and a payment card. The setup below costs roughly **$20 a
month** (two always-on Starter services at about $7 each, plus a small
database). Render shows the exact price before you confirm. You can delete
everything at any time from the Render dashboard.

## 1. Create the services

1. Go to [render.com](https://render.com) and sign up with **GitHub**.
2. Allow Render to see the repository **tnhasanov/whoisapp**.
3. In the Render dashboard click **New → Blueprint**.
4. Pick **tnhasanov/whoisapp**, and for the branch pick
   **claude/new-session-boz9mq** (or `main` once it has been merged).
5. Render reads `render.yaml` and lists three things: **personbrief** (the
   website), **personbrief-worker** (does the research in the background) and
   **personbrief-db** (the database).
6. Render asks for three values:
   - **OWNER_SETUP_TOKEN** — make up a long private phrase, at least 16
     characters (for example four random words). You will type it once in
     step 2. Keep it to yourself.
   - **TAVILY_API_KEY** and **ANTHROPIC_API_KEY** — leave them empty for now
     if you do not have them yet. The demo works without them.
7. Click **Deploy Blueprint** (add a card if Render asks). The first build
   takes about 5–10 minutes.

## 2. Create your account

1. When **personbrief** shows **Live**, open it and copy its address — it looks
   like `https://personbrief.onrender.com` (Render may add a few letters).
2. Open `https://<your address>/setup` in your browser.
3. Enter the setup phrase from step 1.6, your name, email and a password of at
   least 12 characters. You are signed in straight away.
4. The setup page closes itself once your account exists. Nobody else can
   sign up.

## 3. Try it

Click **Demo** in the workspace switch and run one of the fictional examples.
Everything in the demo is invented, so you can click around freely.

## 4. Put it on your phone

- **iPhone:** open your address in **Safari**, tap **Share**, then **Add to
  Home Screen**.
- **Android:** open your address in **Chrome**, open the menu, then tap
  **Install app**.

PersonBrief then opens full-screen from your home screen, like any other app.

## 5. Turn on real research (when you are ready)

1. Get an API key from [Tavily](https://app.tavily.com) (web search) and one
   from the [Anthropic Console](https://console.anthropic.com) (reading and
   summarising). Both charge per use.
2. In Render open **personbrief → Environment**, fill in `TAVILY_API_KEY` and
   `ANTHROPIC_API_KEY`, and save. The website restarts by itself.
3. Open **personbrief-worker** and click **Manual Deploy → Deploy latest
   commit**, so the worker picks up the keys too.
4. In PersonBrief, switch to **Live** and check **Settings**: both providers
   should show **Configured**. Run one small search to confirm.

## Good to know

- **Updates:** every new commit on the chosen branch is deployed
  automatically.
- **Own domain:** add it in Render under **personbrief → Settings → Custom
  Domains**, then set `APP_URL` to `https://your-domain` in the website's
  environment.
- **Backups:** look at the recovery and backup options on **personbrief-db**
  in Render, and make sure they fit how much research you keep there.
- **Cheaper trial:** you can switch the services to Render's free plans, but
  free websites fall asleep after 15 minutes (the next visit takes about a
  minute) and free databases are deleted after 30 days. The research worker
  has no free plan.
- **Something wrong?** Open the service in Render and look at **Logs**.
  `https://<your address>/api/health` shows whether the database and the
  worker are running.
