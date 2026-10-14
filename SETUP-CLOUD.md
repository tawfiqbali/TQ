# Connect the website to the cloud (Supabase, free) – about 15 minutes

After this, every change made in the admin panel is saved online and shows up
for every visitor, on every phone and computer, within a second or two.
Trial requests from every visitor arrive in **Admin → Inquiries**.

**Your project (`jigbsunxutjgxxehjeuy`) is already built into the code**, so you
only need steps 2, 3, 4 and 7 below. Steps 1, 5 and 6 are for reference, e.g. if
you ever move to a different Supabase project.

---

## Step 1 – Create a free Supabase account and project
1. Go to **https://supabase.com** → **Start your project** → sign in with GitHub or email.
2. Click **New project**.
   - **Name:** `qit-website`
   - **Database password:** click *Generate a password* and save it somewhere safe
     (you won't need it for the website, only for Supabase itself).
   - **Region:** *Southeast Asia (Singapore)* – closest to Bangladesh.
   - Plan: **Free**.
3. Click **Create new project** and wait about 2 minutes until it says the project is ready.

## Step 2 – Create the two Executive logins
1. In the left menu open **Authentication → Users → Add user → Create new user**.
2. Email `qitoffice.info@gmail.com`, password **admin5050** (or a stronger one),
   and tick **Auto Confirm User**. Click **Create user**.
3. Repeat for `gmmuhit1632@gmail.com`.

These are the passwords Executives now use on the website's **Executive** tab.
(Junior Admins are not affected: they still sign in with any Gmail and their own password.)

## Step 3 – Create the database tables
1. Left menu → **SQL Editor** → **New query**.
2. Open the file `supabase/complete-setup.sql` from this project, copy **everything**, paste it in.
   (It includes `setup.sql` and also sets the Executive password to admin5050.)
3. Click **Run**. At the bottom you should see both executive emails listed.
   If one is missing, create that user (step 2) and click **Run** again – it is safe to repeat.

## Step 4 – Stop strangers from creating accounts
Left menu → **Authentication → Sign In / Providers** (called *Providers* in some
versions) → under **Email**, turn **off** "Allow new users to sign up" → **Save**.

## Step 5 – Copy your two keys
Left menu → **Project Settings** (gear icon) → **API** (or **Data API** / **API Keys**).
- **Project URL** – looks like `https://abcdefghijklm.supabase.co`
- **anon public** key – a long text starting with `eyJ…`
  (newer projects may show a **Publishable key** starting with `sb_publishable_…` – that works too)

⚠️ Never copy the **service_role** / **secret** key into the website. Only the anon/publishable one.

## Step 6 – Paste them into Netlify
1. **app.netlify.com** → your site → **Site configuration → Environment variables → Add a variable**.
2. Add:
   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon / publishable key |
3. **Deploys → Trigger deploy → Deploy site**. Wait until it says *Published*.

(Working on your computer instead? Put the same two lines in a file called `.env`
in the project folder and restart `npm run dev`.)

## Step 7 – Check it works
1. Open **yoursite/admin**, choose **Executive**, sign in.
   The bottom of the sidebar now says **"Live – synced to the cloud"**.
2. If you had made edits before connecting, the dashboard shows
   **"Upload to cloud"** – click it once to publish them for everyone.
3. Change something small (e.g. the hero headline), save, then open the website
   on your phone. The change is there. Pages that are already open update by themselves.

## If something goes wrong
| Message | Fix |
|---|---|
| "The cloud database is not set up yet" | Run `supabase/setup.sql` (step 3). |
| "The cloud database refused the change" | Your email is not an admin – check step 2, then run setup.sql again. |
| "That email and password combination was not recognised" | Use the password you set in step 2, and make sure *Auto Confirm User* was ticked (or click the user → *Confirm*). |
| Sidebar still says "Cloud not connected yet" | The two Netlify variables are missing or misspelled, or you did not redeploy (step 6). |

**Free plan notes:** plenty for this site (500 MB database, unlimited visitors
reading content). Supabase pauses a free project after about a week with **no**
visits at all; any visit or admin sign-in keeps it active, and a paused project
can be restored with one click in the Supabase dashboard.
