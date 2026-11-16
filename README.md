# ScentMath

A mobile-first web app for blending the essential oils you already own. It suggests oils from your shelf that pair well, works out exact drop counts for a diffuser, roller or massage oil, and shows safety notes on every blend. Everything is stored on your device; there is no account and no server.

`PLAN.md` is the full spec. `CLAUDE.md` holds the working rules for the project.

## Put it online with GitHub Pages

GitHub builds and publishes the app for you each time you upload files. You do this setup once.

### One-time setup

1. Sign in at [github.com](https://github.com) and create a new repository. Name it `scentmath`, set it to **Public**, and leave the "Add a README" box unticked. (GitHub Pages is free for public repositories.)
2. On the new repository's page, click **uploading an existing file**.
3. Open this project folder on your PC and select everything **except** these two folders:
   - `node_modules`
   - `dist`

   Drag the rest into the GitHub page. Make sure the `.github` folder and the `package-lock.json` file are included; the publish step needs both.
4. Wait for the upload to finish, then click **Commit changes**. If GitHub says there are too many files, upload the `src` folder on its own first, commit, then upload the rest.
5. In the repository, go to **Settings**, then **Pages**. Under "Build and deployment", set **Source** to **GitHub Actions**.
6. Go to the **Actions** tab. A run called "Publish to GitHub Pages" should be in progress or finished. If none has started, open that workflow and click **Run workflow**.
7. When the run shows a green tick, your app is live at:

   `https://YOUR-USERNAME.github.io/scentmath/`

   The address is also shown on the Settings > Pages screen.

### Updating the app later

Upload the changed files to the same repository (**Add file > Upload files**) and commit. GitHub rebuilds and republishes in a minute or two. If a test fails, the publish stops and the previous version stays live; the Actions tab shows what failed.

### Using it on your phone

Open the address in your phone's browser. To install it like an app:

- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome):** tap the menu, then **Install app** or **Add to Home screen**.

The address uses https, so the barcode scanner can use the camera. After the first visit the app also works offline.

Your shelf and saved blends live in that phone's browser. They are not shared between devices, and clearing the browser's site data removes them.

## Working on it locally

You need [Node.js](https://nodejs.org) (LTS).

```
npm install      # once
npm run dev      # start the app at http://localhost:5173
npm test         # run all tests
npm run build    # type check, test, and build into dist/
```
