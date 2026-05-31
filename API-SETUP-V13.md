# Calibre V13 — API-Football setup

## Production setup on Vercel

1. Create an API-Football account and copy the API key from the provider dashboard.
2. Open the Calibre project in Vercel.
3. Open **Settings → Environment Variables**.
4. Add a variable named exactly:

   `API_FOOTBALL_KEY`

5. Paste the API-Football key as the value.
6. Enable the variable for **Production**, **Preview**, and **Development**.
7. Save the variable.
8. Redeploy the newest GitHub commit. Environment-variable changes do not affect deployments that already exist.

## Important security rule

Do not put the live key in GitHub. Do not add a real key to `.env.example`. Do not use `VITE_API_FOOTBALL_KEY` in Vercel production. Variables beginning with `VITE_` are available to browser code.

The production site calls the server-side bridge:

`/api/football`

The bridge adds the secret API key to the upstream request without exposing it to visitors.

## Check whether the connection works

After redeployment:

1. Open the Calibre website.
2. Find the **CALIBRE DATA BRIDGE** strip underneath the live ticker.
3. Press the refresh icon.
4. A successful connection changes **SNAPSHOT MODE** to **CONNECTED**.
5. Test **Competitions → Top Leagues** and **System Fit → Team Search / Player Search**.

You can also open this route on your deployed domain:

`/api/football?endpoint=status`

A JSON response with account quota information confirms that the server bridge can reach API-Football.
