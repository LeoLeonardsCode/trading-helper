# Trading 212 Investment Assistant

A local, read-only FinTech dashboard for monitoring a Trading 212 portfolio. The app supports local user accounts, saved encrypted Trading 212 API credentials, account summary and open positions, local snapshots, allocation views, and report drafts.

## Start

1. Install Node.js 18 or newer.
2. Run either:

```powershell
.\run-app.bat
```

Or:

```powershell
npm start
```

3. Open:

```text
http://localhost:4173
```

Create a local app account first. After signing in, open **Settings** and connect Trading 212 by entering both your API key and API secret. Credentials are encrypted before they are saved under the local `data` folder.

For real portfolio data, choose **Live** in Settings and use API credentials generated for the live Trading 212 account. Choosing **Demo** will only show demo/paper-trading data.

## Moving Out of OneDrive

If OneDrive causes file locking or sync problems, copy this whole folder to a local path such as:

```text
C:\Trading-platform
```

Then open that copied folder and run `run-app.bat`.

## Current Scope

- Read-only Trading 212 API usage.
- Demo environment by default.
- Local app accounts with password hashing.
- Saved encrypted Trading 212 API connection per app user.
- Separate Settings page for Trading 212 connection, profile, and password changes.
- Account summary and open positions.
- Local portfolio snapshots per app user.
- Mock fallback data when no API credentials are connected.

## API Notes

The current connector uses:

- `GET /api/v0/equity/account/summary`
- `GET /api/v0/equity/positions`
- `GET /api/v0/equity/metadata/instruments`

The app does not place, edit, or cancel orders.

Trading 212 currently requires API Key + API Secret using Basic authentication. If connection fails, check that the selected environment matches where the key was generated, that the account type supports the Public API, and that any IP restrictions in Trading 212 allow this computer.
