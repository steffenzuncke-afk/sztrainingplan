# sztrainingplan

Climbing, gym, stretching and running. Tells you what to do next, shows what you
did last and best, sets an intention, and times your intervals.

## Put it online

**GitHub**
1. New repository → name it `sztrainingplan` → Public → Create.
2. "uploading an existing file" → drag in **every file in this folder** → Commit.

**Netlify**
1. netlify.com → Log in with GitHub.
2. Add new site → Import an existing project → GitHub → `sztrainingplan`.
3. Leave build command empty. Publish directory: `/`. Deploy.

You get a URL like `sztrainingplan.netlify.app`. Every future upload to GitHub
redeploys it automatically.

## Put it on your phone (Android)

Open the URL in **Chrome** → menu (⋮) → **Install app**, or **Add to Home screen**.

Launch it from that icon, not from a Chrome tab. Installed, it runs full screen,
holds the screen awake during timers, and Chrome grants it persistent storage
that survives low space.

### Sound and vibration

The timer beeps and vibrates at every interval change. The beep plays as
**media**, so turn the media volume up — silent/ringer mode does not mute it.
Vibration works whether or not the volume is up.

## First thing to do

Log one throwaway entry. Force-close the app. Reopen it.

If the entry is still there, storage works and you can start logging for real.
If it isn't, the home screen will tell you why.

## Files

| File | What it is |
|---|---|
| `index.html` | The page |
| `app.js` | The whole app, including the storage layer |
| `app.css` | Styling |
| `manifest.webmanifest` | Makes it installable |
| `sw.js` | Offline cache |
| `icon-*.png` | Home screen icons, including a maskable one for Android |

## Updating it

Replace the changed file on GitHub. **Also bump `CACHE` in `sw.js`** — change
`training-v1` to `training-v2`. Without that, phones keep serving the old
version from cache and you will think the update failed.

## Your data

Lives in your phone's browser storage, under this site's address only. It is not
on any server and nobody else can see it.

Installed as an app, Chrome marks that storage persistent and will not clear it
to reclaim space. It is still one copy in one place, so **Data and backup** at
the bottom of the home screen exports everything as text — keep a copy in
Notion. Clearing Chrome's site data by hand still wipes it.

If the browser ever refuses to store anything, the home screen says so in red.
It will not quietly pretend to save.

Never change a `Key` in the Notion blocks database. It is what ties an exercise
to its history.
