# Setup guide

The app is a static site on **GitHub Pages**. Users sign in with Microsoft 365 and all data is stored in a **SharePoint List** in your tenant (via Microsoft Graph). There is no server to run.

You need: a GitHub repo, a SharePoint site, and permission to register an Azure AD (Entra ID) app (or an admin who can).

## 1. Create the SharePoint list
Run once as a site owner (PowerShell with `PnP.PowerShell`):
```powershell
./scripts/Create-BreakList.ps1 -SiteUrl https://<tenant>.sharepoint.com/sites/<YourSite>
```
Then give your agents/managers **Contribute** permission on the site (or on just this list). Admins/managers read everything in the list.

## 2. Register the Azure AD app
Entra admin center → App registrations → **New registration**
1. Name: `Break Management`, Single tenant.
2. **Authentication** → Add platform → **Single-page application**. Redirect URI:
   `https://<github-user>.github.io/<repo>/redirect.html`  (exact match, with the trailing `redirect.html`).
3. **API permissions** → Microsoft Graph → *Delegated*: `User.Read`, `Sites.ReadWrite.All` → **Grant admin consent**.
4. Copy the **Application (client) ID** and **Directory (tenant) ID**.

## 3. Configure the app
Edit `client/public/config.json`: `clientId`, `tenantId`, `siteHostname`, `sitePath`, `listName`, `teams`, `adminEmails` (Admin panel + CSV download), `managerEmails` (Floor Manager view + all-team dashboard). Anyone else is an agent (own break tool + own history only).

## 4. Publish on GitHub Pages
1. Merge to `main`.
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. The *Deploy* workflow publishes to `https://<github-user>.github.io/<repo>/`. (Pages on private repos needs a paid GitHub plan; the site itself is public, but without a Microsoft sign-in it shows nothing.)

## 5. Embed in SharePoint
1. SharePoint Admin Center → Settings → *HTML Field Security* (or site-level “Site Settings → HTML Field Security”) → allow `github.io`.
2. Edit a page → add the **Embed** web part → paste, one per page:
```html
<iframe src="https://<github-user>.github.io/<repo>/?view=agent&nav=0" width="100%" height="700" frameborder="0"></iframe>
```
Use `view=agent`, `view=manager`, `view=dashboard`, `view=admin`. `nav=0` hides the app's own menu for embedded use.
3. First use: user clicks **Sign in with Microsoft** (a popup; allow popups for the SharePoint site). If the popup is blocked inside the frame, open the app URL directly in a tab.

## Testing
1. Open the Pages URL directly, sign in, pick a team, start/end a QBB.
2. In SharePoint, confirm a new row appears in `BreakLog`.
3. Sign in as a manager email → `?view=manager` shows the active break within 15s.
4. Sign in as an admin email → `?view=admin` → **Export CSV**.
5. Local dev: `cd client && npm install && npm run dev`, and add `http://localhost:5173/redirect.html` as a second redirect URI.

## Security notes
- Role checks (admin/manager) hide views in the UI; the real access control is SharePoint list permissions. Agents with list access can technically read other rows via Graph.
- No secrets are in the repo; the client ID/tenant ID are public identifiers.
