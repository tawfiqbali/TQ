# Quran International Institute: website + admin panel

A React (Vite) + Tailwind CSS website for an online Quran academy, with an admin
panel at `/admin` that edits courses, page text, teachers, reviews and student
inquiries without touching code.

---

## 1. Run it locally

Requirements: **Node.js 18 or newer**.

```bash
npm install
npm run dev
```

Open http://localhost:5173 for the website and http://localhost:5173/admin for
the admin panel. Super Admins sign in with their email and **admin5050**;
Junior Admins and teachers use **Continue with Google** (see section 8h).

---

## 2. Changing the admin password

The password **admin5050** is set in `src/lib/auth.js` (as a SHA-256 hash).
To change it without editing code, use the steps below; a
`VITE_ADMIN_PASSWORD_HASH` variable in Netlify replaces admin5050.


```bash
npm run hash-password -- "choose-a-strong-password"
```

Copy the printed line into a new file named `.env` in the project root:

```
VITE_ADMIN_PASSWORD_HASH=5e884898da2804...
```

Restart `npm run dev`. The warning on the login screen disappears once a hash is set.

---

## 3. Choose where data is saved

| | LocalStorage (default) | Supabase (recommended for a live site) |
|---|---|---|
| Setup | None | ~10 minutes, free tier is enough |
| Admin edits visible to | Only the browser you edited in | Every visitor, instantly |
| Inquiries collected from | Only this browser | Every visitor |
| Admin login | Password checked in the browser | Real email + password accounts |
| Security | Keeps casual visitors out only | Enforced by the database |

**Important:** in LocalStorage mode, data lives in *your* browser. It is great for
building and demoing, but visitors on other devices will see the default content
and their trial requests won't reach you. For the real site, use Supabase.

### Connecting Supabase

Follow **SETUP-CLOUD.md** (step by step, about 15 minutes). In short: create a
free Supabase project, add the two Executive users, run `supabase/setup.sql` in
the SQL Editor, and put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
Netlify's environment variables, then redeploy.

Once connected:
- Admin edits are saved to the cloud and appear for every visitor within a second
  or two (open pages update live; others get the new content on their next visit).
- Returning visitors see the page instantly from a cached copy while the latest
  content loads in the background.
- If this browser holds edits made before connecting, the dashboard offers a
  one-click **Upload to cloud**.

---

## 4. Version 2 features: how they work

### Prices per country (Admin → Pricing & currency)
- Base course prices are in USD (Admin → Courses → Plans).
- **Automatic prices:** every country's currency is picked from the country
  (Canada → CAD, UAE → AED, …) and the USD prices are converted at today's
  rate and rounded. Bangladesh always has its fixed BDT prices.
- **Custom prices:** choose any country from the dropdown. The page shows its
  automatic prices; type a custom price for any plan and **Save**. Empty boxes
  stay automatic. **Reset** removes a country's custom prices (Bangladesh goes
  back to its built-in BDT prices). The list at the bottom shows every country
  with custom prices.
- Visitors' countries are detected from their IP address (device time zone as
  backup). Signed-in Executives can preview any country above the courses.

### Light and dark mode
The sun/moon button in the header switches themes. The choice is saved in the
visitor's browser; first-time visitors get their device's setting. Colours are
CSS variables at the top of `src/index.css` (`--c-paper` is the cream page
background). The admin panel always stays light.

### Hero slideshow
The top-right slideshow slides `public/images/hero-qit-1.webp` to `-3.webp`
sideways every 2.5 seconds (a quick 0.4-second slide) in an endless loop. Change
the pace in *Site content → Hero → Seconds per photo*. It pauses while a mouse is over
it and has arrows, dots, swipe and a pause button. Change the photos or their order in *Site content → Hero → Slideshow photos*
(one path per line). Landscape 3:2 images fit without cropping.

### WhatsApp buttons
All WhatsApp links go to the number in *Site content → Contact details*
(+8801928616108).
- **Buy Course** opens WhatsApp with the course, the plan the visitor selected
  and the price shown. Edit the wording in *Site content → WhatsApp messages*.
- **Book Trial / Book Free Trial** opens the trial form. **Send my request**
  opens WhatsApp with every answer filled in, and at the same time saves the
  request in *Admin → Inquiries* and emails it (below).
- The green round button and "Chat on WhatsApp" open a general chat. The round
  call buttons (header and above the WhatsApp button) dial the phone number.
- The trial form has a Course dropdown. Opening it from a course card selects
  that course; the header and banner buttons start on "Not sure yet".
- Clicking the email opens Gmail's compose window addressed to
  qitoffice.info@gmail.com (in a new tab; the Gmail app on phones).
  Clicking the office address opens Google Maps.

### Getting trial requests in Gmail (qitoffice.info@gmail.com)
**Netlify Forms (built in):** `index.html` contains hidden copies of the two forms
so Netlify detects them on deploy. After your first deploy:
1. Netlify → your site → **Forms**. Enable form detection if asked, then redeploy.
   You should see `trial-request` and `contact-message`.
2. **Site configuration → Notifications → Emails and webhooks → Form submission
   notifications → Add notification → Email notification**, enter
   `qitoffice.info@gmail.com`, choose the `trial-request` form. Repeat for
   `contact-message`.
3. Submit a test request from the live site and check your inbox (and Spam once).

**Google Form (optional, also fills a Google Sheet):**
1. Create a Google Form with short-answer questions: Name, Country, WhatsApp,
   Preferred class time, Class date, Teacher, Medium, Platform, Course.
2. In the form's ⋮ menu choose **Get pre-filled link**, type a sample answer in
   every question, click **Get link** and copy it. Each question appears as
   `entry.123456789=...` in that link.
3. In Netlify → **Environment variables**, add:
   - `VITE_GOOGLE_FORM_ACTION` = `https://docs.google.com/forms/d/e/<FORM_ID>/formResponse`
   - `VITE_GOOGLE_FORM_FIELDS` = `{"name":"entry.111","country":"entry.222","whatsapp":"entry.333","preferredTime":"entry.444","classDate":"entry.555","teacher":"entry.666","medium":"entry.777","platform":"entry.888","course":"entry.999"}`
     (use your own entry numbers).
4. Redeploy. In the form's Responses tab you can turn on email notifications.

### Logo and photos
- `public/brand/` holds the logo in four versions (mark, white mark for dark
  backgrounds, full logo, wordmark), generated from your files. Favicons are
  `public/favicon-32.png`, `favicon-64.png` and `apple-touch-icon.png`.
- `public/images/` holds the four photos: `quran-live.jpg` (hero card),
  `trial-class.jpg` (trial class section), `why-us.jpg` (promise card background)
  and `cta-class.jpg` (Book free trial banner background). Replace a file with the
  same name, or point to another image in *Site content* (Hero, Trial class,
  Why us, Book trial banner). Keep photos around 1000–1800 px wide and under
  300 KB so the page stays fast.

### Font
Headings, cards and inputs use **Bahnschrift**. It is installed only on Windows,
so phones and Macs use **Barlow**, a close match loaded from Google Fonts.
To make every device use Bahnschrift you would need a web-font licence from
Microsoft and to self-host the file.

### Upgrading from the first version
The content format changed (`CONTENT_VERSION = 2`). Content saved by version 1
is replaced by the new defaults on the next load. Inquiries are kept.

---

## 5. Deploy

Build locally with `npm run build`; the output goes to `dist/`.

**Vercel:** push the project to GitHub, import it at vercel.com, and add your
`VITE_…` variables under *Settings → Environment Variables*. Framework preset:
Vite. `vercel.json` already routes every URL to the app so `/admin` works on refresh.

**Netlify (your current host):** import from GitHub (or drag the `dist` folder
onto Netlify → Deploys), build command `npm run build`, publish directory
`dist`, and add your environment variables. `public/_redirects` handles routing.
Then set up form email notifications as described in section 4.

**Any static host (cPanel, Hostinger, etc.):** upload the contents of `dist/`
and configure the server to serve `index.html` for unknown paths.

Environment variables are baked in at build time, so redeploy after changing them.

---

## 6. Project structure

```
├── index.html                 Fonts, meta tags, hidden Netlify form definitions
├── public/brand/              Logo files; public/images/ photos
├── vercel.json                SPA routing for Vercel
├── public/_redirects          SPA routing for Netlify
├── scripts/hash-password.mjs  Generates VITE_ADMIN_PASSWORD_HASH
└── src/
    ├── App.jsx                Routes; admin screens are lazy-loaded
    ├── index.css              Background gradient, buttons, soft inputs, 3D cards
    ├── data/defaultContent.js All starting content (courses, teachers, text…)
    ├── lib/
    │   ├── storage.js         LocalStorage and Supabase adapters (same interface)
    │   ├── auth.js            Admin sign-in for both modes
    │   ├── currency.js        Visitor country, exchange rates, price formatting
    │   ├── formDelivery.js    Netlify Forms + optional Google Form
    │   ├── supabaseClient.js
    │   └── utils.js
    ├── context/
    │   ├── SiteDataContext.jsx   Single source of truth + all edit actions
    │   ├── CurrencyContext.jsx   Prices in the visitor's currency
    │   └── TrialModalContext.jsx "Book a free trial" dialog, openable from anywhere
    ├── components/
    │   ├── layout/            Navbar, Footer, AnnouncementBar, FloatingWhatsApp, PublicLayout
    │   ├── home/              Hero, CoursesSection, HowItWorks (trial class), Features (why us), Testimonials, Faq, CtaBand
    │   ├── shared/            CourseCard, CurrencyNote, TrialForm, InquiryForm (contact), InstructorCard, PageHeader…
    │   └── ui/                Modal, ConfirmDialog, Toast, FullPageLoader
    ├── pages/                 Home, Courses, About, Instructors, Contact, NotFound
    └── admin/
        ├── AdminLogin.jsx     Password gate with attempt lockout
        ├── ProtectedRoute.jsx
        ├── AdminLayout.jsx    Sidebar shell
        ├── Dashboard.jsx      Stats, latest inquiries, backup / restore / reset
        ├── CourseManager.jsx  Add, edit, delete, publish, feature courses
        ├── ContentEditor.jsx  Every text section, contact details, WhatsApp messages, settings
        ├── PeopleManager.jsx  Teachers, reviews, "why us" reasons, FAQ (with ordering)
        ├── InquiryManager.jsx Filter, search, status updates, CSV export
        ├── schemas.js         Field definitions for every admin form
        └── components/        RecordForm, Field, StatusBadge, AdminPageHeader
```

### How the admin controls the site

Every page reads from `useSiteData()`. Admin screens call actions such as
`saveItem('courses', course)` or `updateSite('hero', values)`. The context updates
React state immediately (so the change appears at once), then persists it through
the active storage adapter. Other open tabs (LocalStorage) or other visitors
(Supabase realtime) receive the change and re-render.

### Adding a new editable field

1. Add the default value in `src/data/defaultContent.js`.
2. Add a field definition to the matching schema in `src/admin/schemas.js`.
3. Display it in the component that should show it.

Existing saved data picks up new defaults automatically.

---

## 7. Who can sign in to the admin panel
Only these emails can sign in:
`gmmuhit1632@gmail.com` and `qitoffice.info@gmail.com` (Executive tab), plus any
Gmail address on the **Junior Admin** tab.
Change the list with the `VITE_ADMIN_EMAILS` environment variable
(comma-separated) and redeploy.

- There is no public Admin button. Go to **yoursite.netlify.app/admin**. Once
  an authorised admin is signed in, an **Admin** button appears in the header
  (and the currency preview above the courses).
- **LocalStorage mode:** email must be on the list *and* the password must match
  `VITE_ADMIN_PASSWORD_HASH`. This check runs in the browser, so treat it as a
  lock on the front door, not a safe.
- **Supabase mode (recommended):** create a Supabase user for each email
  (Authentication → Users → Add user), then run:
  ```sql
  insert into public.admins (user_id)
  select id from auth.users
  where email in ('gmmuhit1632@gmail.com', 'qitoffice.info@gmail.com')
  on conflict do nothing;
  ```
  The database then refuses edits from anyone else, whatever happens in the browser.

## 8. Management Portal (teachers, students, salaries, progress reports)

The portal from the old Apps Script app now lives inside the admin panel at
**/admin/portal** (sidebar → *Management Portal*). Everything is kept: the
financial dashboard with charts, the Salary Directory (no PIN: the Super Admin
sign-in protects it) with teacher workspaces and payouts, the student roster, bulk Enroll Teacher /
Enroll Student tables, the WhatsApp report parser, the bilingual progress
report builder and the printable two-page dossier with the CEO signature.

### Roles
| | Executive (Super Admin) | Junior Admin | Teacher |
|---|---|---|---|
| Who | gmmuhit1632@gmail.com, qitoffice.info@gmail.com | a Gmail an Executive added in **Team & Roles** | any Gmail, after onboarding |
| Sign in | /admin/login → Executive → admin5050 (or Google) | /admin/login → Junior Admin → Continue with Google | /teacher → Continue with Google |
| Management Portal (salaries, students, enrolment, reports, contents) | ✓ | ✗ | ✗ |
| Teacher list + review teachers' monthly reports (/admin/review) | ✓ | ✓ (only this) | ✗ |
| Website editor, inquiries | ✓ | ✗ | ✗ |
| Own students, schedule, monthly reports, salary, support (/teacher) | ✗ | ✗ | ✓ (own only) |

All of this is enforced by the database (`supabase/teacher-dashboard.sql`), not
just hidden in the browser. The Junior Admin password (1010) is no longer used.

### Version 42 changes
- **Salary Directory:** no PIN. A search box filters teachers inside the open tab
  (name, ID, department, phone, account). Each card shows a **Department** tag
  (Bangla Dept. / English Dept.) and a pencil button on the far right to edit.
- **Disbursing salary:** the *Salary month* is set to the month before the
  payment date (paid on 1 September → August; paid in January → December of the
  previous year). It stays editable, and the payment is confirmed before saving.
- **Enroll Teacher / Edit Teacher:** new *Department* field. It is saved in a new
  column N ("Department") of the Teachers sheet, added automatically.
- **Students:** several WhatsApp numbers per student (+ Add number). They are
  saved in the same Student Phone column, separated by commas.
- **Junior Admins** no longer see Teacher Share anywhere (roster, edit form,
  enrollment), and the server never sends it to them. Students they enroll get a
  share of 0 until a Super Admin sets it.
- **Dropdowns:** every dropdown in the portal is searchable: type to filter,
  Backspace to edit, ↑/↓ and Enter to pick, Esc to close.
- **WhatsApp parser** (`src/admin/portal/lib/whatsappParser.js`): reads
  "Label: value" lines in English or Bangla with many wordings, plus sentences
  such as "২০ দিনের মধ্যে ১৮ দিন ক্লাস করেছে" or "attended 14 out of 16 classes".
  It extracts attendance (present / absent / total / %), the current lesson (surah,
  para, page, ayah…), what was taught, homework, and the study status, which it
  rates Excellent → Needs improvement and uses to pre-fill the grades.
- **Progress report:** redesigned two-page A4 layout (letterhead, reference number,
  details tables, attendance bar, evaluation table with level bars, grading key,
  signatures and seal, page footer).

### Version 43 changes
- **Portal Contents** tab (Super Admins): every word of the printed progress
  report (English and Bangla: headings, labels, grade and rating descriptions,
  greeting letters, default text, footer) and of the salary certificate can be
  edited and saved without touching the code. *Report layout* switches blocks on
  or off (reference number, letter, attendance bar, level bars, grading key,
  seal, teacher signature). **Preview** shows the result with sample data. The
  text is saved with the website content (cloud). Defaults:
  `src/admin/portal/lib/portalContent.js`.
- **Salary certificate:** Salary Directory → open a teacher → **Generate Salary
  Certificate**. It follows the institute's official salary certificate on the
  QIT letterhead: logo, name and address, seal, date, "To Whom It May Concern",
  certification paragraph, numbered salary & allowances table (Basic, House Rent,
  Medical, Education, Transport, Tiffin, Special Benefits), Gross Salary,
  deductions (Employee Welfare Fund 100, Stamp Duty 10), Net Paid, amount in
  words, festival-bonus line, good wishes, Head of Accounts sign-off, contact
  block and authorised signature. The disbursed amount is the Net Paid.
  Basic salary: 17,000 → 13,000; 15,000 → 12,000; 18,000 → 14,000 (other
  amounts ≈ 78%). The rest of the gross is split House Rent 50%, Medical 20%,
  Transport 13%, Tiffin 7%, Special Benefits the remainder, so it always adds up.
  The joining date is typed in (shown as "1st December, 2024"); every word and
  figure can be edited before **Print / Save PDF**; default wording in Portal
  Contents. Images in `public/certificate/`: `qit-logo.png`, `qit-mark.png`,
  `seal.png`, `jubayer-sign.png` (Jubayer Hossain's signature).

**If you use Google Sheets:** paste the new `portal-backend/Code.gs` into Apps
Script and publish it (**Deploy → Manage deployments → Edit → New version**).

### Connecting it to your Google Sheet (recommended)
Until this is done the portal runs in **Demo mode**: records are saved only in
the browser you are using, which is fine for trying it out but not for real work.

1. Open the Google Sheet your old portal used → **Extensions → Apps Script**.
2. Replace the old `Code.gs` with `portal-backend/Code.gs` from this project
   (the old `Index.html` is no longer needed). Save.
3. **Deploy → New deployment → Select type: Web app**. Execute as **Me**, Who has
   access **Anyone**. Deploy and authorise. Copy the **Web app URL**.
4. In Netlify → Environment variables add `VITE_PORTAL_API_URL` = that URL, then
   redeploy. The portal header now shows **Google Sheets** instead of Demo mode.
5. Your existing Teachers / Students / SalaryPayments / StudentReports tabs are
   used as they are.

The script checks the email, password and role on Google's side for every
request, so a Junior Admin cannot load salary payments, bank details or change
salaries even by tinkering with the browser. The portal passwords are stored by the
script (defaults admin5050 and 1010, same as the website). To change them, run
`setAdminPassword('New')` or `setJuniorPassword('New')` once in the Apps Script
editor, and set the same password for the website: `VITE_ADMIN_PASSWORD_HASH` or
`VITE_JUNIOR_PASSWORD_HASH` (make the hash with `npm run hash-password`).
After 5 wrong passwords an email is locked for 15 minutes. Whenever you edit Code.gs, use
**Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## 8b. Assignment messages and teacher directory
- **Admin → Assignment message** builds a WhatsApp message from whichever
  fields you fill in and sends it to the chosen teacher group (Re. / Ma. / Fe.).
  WhatsApp does not let websites pick the sender or post into a group directly,
  so the button copies the message and opens the group (via its invite link,
  saved per device under "Teacher group links") for you to paste and send, or
  opens WhatsApp's chat picker with the message filled in. Use it on the
  phone / WhatsApp Web logged in as +880 1403-291872.
- **Teacher IDs** are QIT-001, QIT-002, … (continuing after the highest number
  in use). The 76-teacher starting directory loads automatically the first time
  the portal has no teachers (demo mode and Google Sheets). For Google Sheets,
  paste the new `portal-backend/Code.gs` and publish a new version first.

**Send to WhatsApp as:** *Picture of this card* (default) copies the preview card
as an image, so WhatsApp shows exactly the preview; *Text message* copies text in
the same layout (bold labels, value on the next line). WhatsApp text cannot show
icons or boxes, which is why the picture option exists. The choice is remembered.

**Generate & Send Message** copies the assignment and opens the Student
Group QIT chat directly in the **WhatsApp Desktop app** (`whatsapp://chat?code=…`),
skipping WhatsApp Web. Press Ctrl+V and send. The first time, the browser asks
"Open WhatsApp?" — tick **Always allow** so it opens straight away afterwards.
If the app is not installed, buttons appear to try again or open the group on
WhatsApp Web (the message stays copied).

## 8c. English / বাংলা (bilingual website)

Visitors switch language with the **English | বাংলা** toggle in the header. The choice is
saved in the browser (`localStorage` key `qit:lang`) and applied before the page
paints on the next visit. The admin panel always stays in English.

**Who sees the toggle.** Only visitors in Bangladesh, Malaysia, Singapore and the
Middle East (Saudi Arabia, UAE/Dubai, Oman, Qatar, Kuwait, Bahrain, Jordan, Lebanon,
Iraq, Syria, Yemen, Palestine, Israel, Egypt, Iran, Türkiye). A visitor qualifies if
their device time zone OR their IP country is one of these. Everyone else gets the
English site with no toggle, even if they chose বাংলা before from an eligible
country. To change the countries, edit `BANGLA_COUNTRIES` and `BANGLA_TIMEZONES` in
`src/i18n/LanguageContext.jsx`, and the matching `bnZones` list in `index.html`.

**Files**
- `src/i18n/locales/en.json`: English interface text (buttons, labels, messages).
- `src/i18n/locales/bn.json`: the same keys in Bengali, plus a `content` section with
  Bengali versions of the editable site content (hero, courses, FAQ, board titles…).
- `src/i18n/LanguageContext.jsx`: `useLanguage()` gives `t('key')`, `n()` (Bengali
  numerals) and `money()` (e.g. `৳৩,০০০`); `useContent()` gives the site content in
  the chosen language.
- `src/components/layout/LanguageToggle.jsx`: the header switch.

**How translated content behaves.** Each English text in the admin panel is matched
to its Bengali version in `bn.json`. Matching is tolerant: small differences such as
capital letters, curly vs straight quotes, "-ize"/"-ise" spelling, punctuation or a
review saved again under a new id still find the translation (about 60% similarity
is required). If you rewrite a sentence completely in the admin panel, Bengali
visitors see your new English text until its Bengali version is added to `bn.json`,
so a wrong translation is never shown.

**Reviews in Bangla.** In Admin → Board, teachers & reviews → Reviews, each review
has optional Bangla fields: *Review in Bangla*, *Where they are from, in Bangla* and
*Course, in Bangla*. Reviews with Bangla text show "বাংলা ✓" in the list. If the
place or course field is left empty, it is translated automatically: all countries,
common cities and known course names (`src/i18n/autoTranslate.js`, where you can
add more). The review text itself needs the Bangla field; without it, Bangla
visitors see the English review.

**What stays in English on purpose.** Admin data (bookings, trial form values such as
`Female` / `Quran Hifz / Memorization`), board members' names, the brand name, phone
numbers and platform names (WhatsApp, Zoom…). A Bengali visitor's WhatsApp message
to the office is written in Bengali.

**Adding a new text.** Add the same key to both `en.json` and `bn.json`, then use
`t('section.key')` in the component. Keep the two files' keys identical.

**Bangla fonts.** Two free (OFL) fonts in `public/fonts/`, loaded only in বাংলা mode:
- `HindSiliguri-Regular.woff2`: regular weight, for menus, paragraphs, lists, course
  details and the footer.
- `Aikya.woff2` (+ `Aikya.ttf`): bold, for headings, buttons and small section labels.

Both are one family, "QIT Bangla", in `src/index.css` (section "Bangla fonts"): text
at weight 600 or lighter uses Hind Siliguri, 700 or heavier uses Aikya. They cover
Bangla letters only; English words keep Bahnschrift / Barlow and English visitors
never download them. `size-adjust` (Aikya 120%, Hind Siliguri 98%) makes both the
standard Bangla size. To make something else bold in Bangla, add it to the rule
`html[lang='bn'] :is(h1, h2, h3, h4, [class*='btn'], .eyebrow)` in that section.

**Extra phrases.** Text added later in the admin panel (a new bullet, a new course
name) has no Bangla version. Add it to `src/i18n/locales/bn.json` → `phrases`
(English on the left, Bangla on the right) and it is translated everywhere it appears.

`src/index.css` (section "Bengali typography") also adds taller line heights,
removes letter-spacing from Bengali and enlarges very small text. The Bengali text
file (~8 KB) is downloaded only when needed.

## 8d. Reviews marquee and site version

The reviews scroll slowly from right to left in an endless loop
(`src/components/home/Testimonials.jsx`, animation `animate-marquee` in
`tailwind.config.js`). The row pauses while the mouse is over it, while a finger
holds it and while keyboard focus is inside, and the round pause button stops it.
Visitors who choose "reduce motion" on their device see a still row they can swipe.
Speed: Admin → Board, teachers & reviews → Reviews → **Scrolling speed** (seconds
each review takes to pass; default 8, higher = slower).

The site version (e.g. v36) is no longer shown in the public footer. Check it at the
bottom of the admin panel's left menu, next to "Live – synced to the cloud".

## 8e. Videos (Vimeo, in the hero)

`src/components/home/VideoShowcase.jsx` shows Vimeo videos in the hero's right-hand
column, right above the photo slideshow card, in the same thin frame (a hairline edge, a soft shadow and a faint teal-to-gold box peeking out at the bottom-right), in a 16:9
box (the video's own shape) so the video fills it with no bars. Change them in Admin → Page content → **Videos**: one Vimeo link per line
(unlisted links such as `https://vimeo.com/123/abc` work too). More links are shown
one under another.

Speed: no Vimeo player code loads with the page. Each video is a poster image
(sized for the screen, ~30–60 KB) with a play button; the real player is created
only when the visitor presses play. Hovering or touching the button opens the
connection to Vimeo first, so playback starts quickly. The poster and title of a
new link are fetched once from Vimeo (a tiny request) and remembered in the browser.
To show a video title in Bangla, add it to `src/i18n/locales/bn.json` → `phrases`.

Signatures: the progress report uses `public/certificate/ceo-sign.png` (CEO) and
the salary certificate `public/certificate/jubayer-sign.png` (Head of Accounts).
Replace a file with the same name to change a signature.

## 8f. Admin & portal Bangla font

All Bangla text in the admin panel and the Management Portal (forms, lists,
dropdowns, pop-ups, the progress report and salary certificate, on screen and
in print/PDF) uses **Aikya** from `public/fonts/`. AdminLayout adds the class
`admin-ui` to the page; the rules are at the end of `src/index.css`. English
text keeps Bahnschrift / Barlow.

## 8g. Teacher report format (monthly)

Portal → **Progress Reports** → **Monthly Notice & Report Format for Teachers** card (top of the page). It is a full notice: salam, the purpose, a note that the salary is counted from this report, how to fill it, the format, and the CEO's signature line.

- Pick **বাংলা** or **English**, then **Copy & Open WhatsApp**: the format is copied and the
  Student Group QIT opens in WhatsApp Desktop — paste with Ctrl+V. If the app does not open,
  a WhatsApp Web link is shown. **Copy** only copies it.
- Send it on the 1st of every month. Teachers fill one block per student (Student Name → Remarks).
- Paste their replies into the importer below and press **Detect & Parse**. The teacher name and
  month from the top carry over to every student, the student is matched by **WhatsApp number**
  first (then by name), and **Apply** also fills the report month and year.
- The text lives in `src/admin/portal/lib/reportFormat.js`; the WhatsApp helpers in `src/lib/whatsappGroup.js`.

## 8h. Teacher Dashboard, Junior Admins & roles (Supabase)

Teachers, students, salary payments and saved reports now live in Supabase, shared by
the Management Portal and the new **Teacher Dashboard**. (Set `VITE_PORTAL_BACKEND=sheets`
to go back to the Google Sheet.)

### One-time setup
1. **Database** – Supabase → SQL Editor → New query → paste all of
   `supabase/teacher-dashboard.sql` → Run. (Safe to run again.)
2. **Google sign-in**
   - Google Cloud Console → APIs & Services → **OAuth consent screen**: app name
     "Quran International Institute", your support email; set Publishing status to
     **In production** (in "Testing" only listed test users can sign in).
   - **Credentials → Create credentials → OAuth client ID → Web application**.
     Authorized redirect URI: `https://jigbsunxutjgxxehjeuy.supabase.co/auth/v1/callback`.
   - Supabase → Authentication → **Sign In / Providers → Google**: enable, paste the
     Client ID and Client Secret, Save.
   - Supabase → Authentication → **URL Configuration**: Site URL
     `https://quraninternational.academy`; Redirect URLs: add
     `https://quraninternational.academy/auth/callback` (and
     `http://localhost:5173/auth/callback` for local testing).
3. **Move the data** – Admin → Management Portal → **Import Data**: read the Google Sheet
   (Apps Script URL + the old portal password) or this browser's demo data, then
   **Import now**. IDs are kept; importing again updates instead of duplicating.
4. **Connect teachers** – Salary Directory → Edit Teacher → **Gmail**. A teacher who signs in
   with that Gmail lands on their own Teacher ID with their students and salary.
   Anyone else gets a new ID (QIT-###) at sign-up; link them to their real record in
   **Team & Roles → Teacher Dashboard accounts** (it suggests matches by WhatsApp/name).
5. **Junior Admins** – Team & Roles → add their Gmail. Remove it to revoke access at once.

### Links to share (also copyable in Team & Roles)
| Link | For |
|---|---|
| `/teacher` | Teacher Dashboard (Google sign-in; first time: name + WhatsApp → Teacher ID) |
| `/teacher/report` | Monthly report form, direct (`?student=QIT-S001&month=August&year=2026` optional) |
| `/admin/login` → Junior Admin | Junior Admin sign-in |

### Language
The whole Teacher Dashboard (sign-in, onboarding, all pages, messages) is in **বাংলা** by
default, with an **English** button in the header; each teacher's choice is remembered in
their browser. Bangla uses the website's Bangla fonts, Bangla digits, Bangla dates, ৳ amounts
and times such as "বিকাল ৫:৩০". Teachers can type numbers with Bangla or English digits.
Texts: `src/teacher/i18n.js`.

### What teachers get
- **My Students** – assigned students (name, ID, WhatsApp, class times), which reports are due.
- **Schedule** – week view (Sat → Fri) and add / edit / remove class times per student.
- **Monthly Report** – pick a student → their background and last report fill in
  automatically; attendance (total, present, absent worked out, reason), current level,
  lesson progress, next targets, **Remarks (required)**. The class count is suggested from
  the schedule. One report per student per month; it can be corrected until the office
  marks it *Reviewed*; *Needs changes* sends it back with a note.
- **Salary** (read-only) – each month **Paid**, **Pending** (last month, or part-paid) or
  **Unpaid** (older, nothing paid), with payment dates.
- **Support** – questions, problems, salary queries and leave requests (with dates); the
  office replies from Management Portal → **Teacher Support**.

### For the office
- **Teacher Reports** (Executives) / **Teachers & Reports** (Junior Admins): filter by month,
  teacher and status; *Mark reviewed* / *Needs changes…*. Executives also get
  **Use in progress report →**, which fills the Progress Report engine like a detected
  WhatsApp message. The *teacher list* view shows who has an account and how many reports
  are in for the month (`2 / 3`), with a **Reports missing** filter.
- Security: teachers never receive fees, teacher shares of other teachers, bank details or
  anyone else's data; Junior Admins never receive salary, fee or bank data. Code:
  `src/teacher/`, `src/admin/staff/`, `src/lib/teacherData.js`, `src/pages/AuthCallback.jsx`.

## 8i. Version 62: attendance, points, admin override, PDFs, custom alerts

**After uploading v62, re-run the whole `supabase/teacher-dashboard.sql` in the Supabase SQL Editor.** It is safe to run again; nothing is lost.

### One teacher record everywhere
- When a teacher signs in and finishes onboarding, the system links them to the Salary Directory (`portal_teachers`), which is the single source of truth:
  - **Gmail matches** an existing teacher: linked straight away to that Teacher ID.
  - **Only the name matches** (a new Gmail): the account waits as a *claim*. An Executive confirms it in **Management Portal → Teacher Dashboards** ("It’s them" or "New ID"). This stops anyone from typing a teacher's name and seeing their salary.
  - **New name and new Gmail**: a new entry with the next `QIT-###` ID.
- Name, WhatsApp and Gmail edited from the admin view update both the directory and the teacher's profile.

### Encryption and security
- Bank name, branch and account number are encrypted in the database (pgcrypto). The key is kept in Supabase Vault, or in a private table if Vault is off. Only Executives get the decrypted values, through `admin_portal_teachers()`.
- Row Level Security still applies to every table:
  - teachers see only their own students, salary, attendance and requests;
  - Junior Admins see no money;
  - anonymous visitors see nothing.
- Supabase also encrypts all data at rest.

### Teacher dashboard
- **Light/dark toggle** in the header (remembered per device).
- **Emergency button** (bottom right): call or WhatsApp the office on +880 140-3291872.
- **Attendance**: mark each student Present or Absent per day, for today or up to 31 days back. The monthly report pre-fills its class counts from this.
- **My Progress**:
  - attendance rate, points this month and in total, Hardworking Level, rank, streak;
  - a six-month chart and rewards;
  - **Download PDF** (a summary report).

### For Executives
- **Teacher Dashboards** tab: open any teacher's dashboard exactly as they see it, and edit everything there: attendance, schedule, reports (including reviewed ones), requests and replies, profile, and bonus/penalty points.
- **Points & Rewards** tab: edit every point value, the levels and their points, and the rewards. The tab also shows a leaderboard.
- **Salary Directory**:
  - a **Names only** toggle for quick scanning with no money shown;
  - **Download PDF** of the full list or the names-only list (account numbers are never printed).

### PDFs
PDFs open a print window; choose **Save as PDF**. This keeps Bangla lettering correct. If nothing opens, allow pop-ups for the site.

### Alerts and notifications
- All browser pop-up confirms are replaced with in-app dialogs and small toasts (success, error, info).
- When a teacher sends a support request, a floating card appears in the admin panel (bottom left) and stays until the request is resolved or dismissed. It updates live.

### Version 63: name fix
- The name is **Quran International Institute** everywhere. Header subtitle: **Online Quran Academy** (Bangla: অনলাইন কুরআন একাডেমি).
- If any saved text still contains "The Q Light Academy", the site replaces it automatically when it loads. This covers the brand, taglines and portal message templates.
- The next time an admin saves, the corrected text is written back to the database.

## 8j. Version 64: Teacher ID sign-in, report auto-fill, clearer light mode

**After uploading v64, re-run the whole `supabase/teacher-dashboard.sql` in the Supabase SQL Editor** (safe to run again). If Supabase shows "Potential issues detected", choose **Run and enable RLS**.

### How teachers sign in
1. **First time: Google.** The teacher signs in with Gmail and enters their name and WhatsApp number.
   - If the Gmail is on a teacher's record, they get that Teacher ID.
   - If they are new, they get the next ID (QIT-###).
   - If only their name matches a record, the office confirms it in Teacher Dashboards.
2. **Their Teacher ID sign-in switches on** straight away:
   - The password is **1009 + the ID number**: QIT-001 = 1010, QIT-002 = 1011, QIT-050 = 1059.
   - It is shown to them once, after that first sign-in (and on their dashboard until they tap "Got it").
   - It is stored hashed by Supabase Auth.
   - Teachers cannot change it.
3. **Next visits:** the sign-in page remembers the Teacher ID on that device and only asks for the password. "Not you?" goes back to the normal page.

Behind the scenes QIT-077 is a normal Supabase Auth account with a hidden address (`qit-077@institute.local`) that teachers never see. Keep **Authentication → Providers → Email** switched on in Supabase (it is on by default, and Executives use it too).

### For Executives
- **Teacher Dashboards → Password**:
  - reset to the automatic password;
  - set your own password;
  - or switch the sign-in off.
  Any change signs the teacher out on every device.
- **Handing a Teacher ID to a new teacher:** open the teacher in the Salary Directory and change the Gmail (and the name and WhatsApp).
  - The previous person is unlinked and signed out.
  - The password goes back to the automatic one.
  - When the new person signs in with Google using the new Gmail, they get that Teacher ID, its students and history.
- Deleting a teacher switches their sign-in off. Their reports and requests stay.

**Security note:** because the automatic password follows a rule, anyone who knows the rule and a Teacher ID could sign in as that teacher. For teachers who see salary or student phone numbers, consider setting an office password in Teacher Dashboards.

### Progress reports fill themselves in
In **Management Portal → Progress Reports**, choosing a student loads the newest monthly report their teacher sent from the dashboard. Attendance, level, taught, next target and remarks are filled into the form. A note shows whose report it is and whether it was reviewed. "Reload teacher’s report" fetches it again.

### Clearer light mode
The Teacher Dashboard now uses:
- white cards with a border and shadow on a cooler page;
- QIT teal (#034751 / #005359) for headings, numbers and the active tab;
- darker body text.
Dark mode is unchanged.

### Version 65: grouped portal menu
The Management Portal menu is split into five coloured boxes:
- **Overview**
- **Salaries & students**
- **Reports**
- **Teachers**
- **Settings & data**

The open section is filled with its group's colour. On phones the menu folds behind one "Menu" button that shows the current section.

### Version 66: colour-coded Teacher Dashboard
The Teacher Dashboard menu uses the same boxed, coloured groups as the portal, in light and dark mode:

| Group | Colour | Pages |
|---|---|---|
| My classes | teal-blue | My Students, Attendance, Schedule |
| Reports & progress | amber | Monthly Report, My Progress |
| Salary & support | indigo | Salary, Support |

Each page's heading bar, stat numbers and stat tile edges use its group's colour. On phones the menu folds behind one button that shows the current page.

### Version 67: one calm look for every admin area, CEO signature
- **Three colours only** everywhere in the admin:
  - QIT **teal** (#005359 / #034751);
  - **gold** (#9a6412 for text, #C8943F for accents);
  - neutral **slate** (#475569).
- **Website admin:**
  - The sidebar is grouped into boxes (Management / Website / Messages & leads), and the open page is a white tile with a gold edge.
  - Pages have a gold bar beside the title.
  - Cards are white with a border and shadow, and stat tiles have teal or gold tops.
- **Management Portal:**
  - Menu groups alternate teal and gold, with slate for Settings.
  - Overview boxes use the same three colours, with icons instead of emoji.
  - Charts are teal with gold highlights.
- **Teacher Dashboard:** My classes = teal, Reports & progress = gold, Salary & support = slate, in light and dark mode.
- **CEO signature:** it is now built into the progress report itself, so it always shows on screen and in print. To change it later, replace `src/admin/portal/lib/ceoSignature.js`, or ask for the new image to be converted. The file `public/certificate/ceo-sign.png` is also updated.

### Version 68: automatic passwords for every teacher, removing sign-ups
- **Every teacher in the Teachers List** can sign in with Teacher ID + **1009 + ID number** (QIT-001 = 1010), set automatically.
  - This includes teachers who never used Google, and new teachers the moment they are added.
  - Teachers cannot change it.
  - The office can reset it, set its own password, or switch the sign-in off. A teacher switched off stays off, even when the SQL is run again.
- **Salary Directory → "New sign-ups (no panel yet)"** tab: teachers who signed up with Google get no panel, so they appear here. Edit them to choose their panel.
- **Removing a Gmail sign-up:** use **Team & Roles → Teacher Dashboard accounts → Remove**, or **Remove** on a waiting claim in Teacher Dashboards.
  - The Google account is deleted and signed out.
  - If the sign-up created a new teacher with no students, payments or reports, that entry is deleted too.
  - Real teachers' records are only unlinked, never deleted.
- **Hand-over or password reset:** it signs the previous person out at once, not after up to an hour.

### Version 69: automatic matching, Junior Admins in the portal, portal-style Teacher Dashboard
- **First Google sign-in finds the existing teacher automatically**, in this order:
  1. the Gmail on their record;
  2. the same WhatsApp number;
  3. the same name (titles like Hafez or Md. are ignored).
  The teacher gets that Teacher ID straight away, and their **Gmail (and WhatsApp if missing) is saved on their record** in the Salary Directory.
- **Nothing matches:** a new teacher is added with the next ID, their Gmail, and the password 1009 + number. They appear in Salary Directory → "New sign-ups".
- **Shared names:** if a name matches more than one teacher, the office chooses in Teacher Dashboards.
- **Checking automatic matches:** in Team & Roles, accounts matched by name or WhatsApp show a "Matched by … · check it’s them" badge. **Remove** undoes a wrong match.
- **Junior Admins now work inside the Management Portal** and can only open:
  - **Students** (no teacher share; they can edit but not delete);
  - **Enroll Teacher** and **Enroll Student** (a Junior can't set the teacher's share);
  - **Progress Reports** and **Teacher Reports**.
  The database gives them no salaries, payments, bank details or shares.
- **Teacher Dashboard styled like the Management Portal:** a header card with the QIT tile, name and ID tags, framed boxes, and uppercase section titles with a gold bar.

### Version 70: delete teachers from Teacher Dashboards
Each row in **Teacher Dashboards** has a **Delete** button. It follows the same rule as the Salary Directory: a teacher who still has students must have them moved or removed first.

Deleting a teacher:
- removes them from the Teachers List and Salary Directory;
- unlinks their Google account;
- switches their Teacher ID sign-in off at once.

Past monthly reports and requests are kept.

### Version 73: My Progress refinement, forgiving name matching
- **My Progress in light mode:**
  - the level card is white with a gold top line and a gold level name (dark mode stays plain deep teal);
  - the points breakdown uses soft rows with "+N" pills, and the total sits in a light gold panel;
  - the six-month chart shows a pale track per month;
  - earned rewards turn gold with a tick, and locked ones stay grey with their level chip.
- **Name matching on first Google sign-in** now allows an extra or missing word. For example, "Abdul Karim QIT" finds "Abdul Karim" or "Hafez Abdul Karim".
  - Titles, dots and the word "QIT" are ignored.
  - At least two words must match, and only one teacher may fit; otherwise the office chooses.
  - A single word like "Karim" never matches.

### Version 74: the Management Portal updates instantly
When a teacher signs up, or another admin changes a teacher, student or payment, the portal refreshes by itself. No page reload is needed. This covers the lists, Teacher Dashboards, Team & Roles and the Salary Directory.
- It uses Supabase Realtime. `teacher-dashboard.sql` switches it on for those tables.
- The portal also refreshes whenever you come back to its browser tab, and every 2 minutes as a safety net.
- **Light mode contrast:** the page background is a deeper grey-green (#E1EAE9), so white boxes and panels stand out, with crisper borders and a clearer shadow. This applies to the Teacher Dashboard and the admin.

### Version 75: delete reports, edit and delete teachers from the teacher list
- **Monthly reports:** Executives see a **Delete** button on each report, both on Teachers & Monthly Reports and in the portal's Teacher Reports tab.
  - Deleting also removes the report's points.
  - The teacher can send the report again.
- **Teacher list:** each teacher has **Edit** and **Delete** buttons for Executives.
  - **Edit** opens the same form as the Salary Directory (name, panel, department, salary model, WhatsApp, Gmail, payment details).
  - **Delete** follows the same rule as the Salary Directory: students must be moved first.
- Junior Admins don't see these buttons.

### Version 76: slimmer hero frames
- The hero video and the photo slideshow with the "Class update" box have lost the thick green and gold border.
- Each now sits in a thin, professional frame: a hairline edge and a soft shadow.
- The gap between the video and the slideshow is smaller, and the "Class update" and "Every tutor certified" cards are neater and more compact.
- Edit this in `src/components/home/Hero.jsx` and `VideoShowcase.jsx` (the class string marked "Thin frame").

### Version 77: gradient side box on the hero frames
- The hero video and the photo slideshow each have a soft teal-to-gold gradient box behind them, peeking out about 12 px at the bottom-right.
- Dark mode has its own softer version.
- The frame and box styles are in `src/components/home/heroFrame.js`, and the `.hero-fx` style is in `src/index.css`.

### Version 78: the same gradient box on the home page sections
- The soft teal-to-gold box now peeks out behind:
  - the Why us cards and the Our promise panel;
  - the trial class card;
  - the spotlight banner;
  - the Book free trial box.
- The box alternates sides, bottom-right then bottom-left, so the page has a gentle zig-zag.
- The light cards now have a solid backing, so the box never shows through them.
- The helper is `src/components/shared/fxBox.js`, and the `.fx` and `.fx-bl` styles are in `src/index.css`.

### Version 79: attendance portal with lessons, locking and recovery classes
**Run `supabase/teacher-dashboard.sql` again** (Supabase → SQL Editor → paste → Run). It is safe to re-run, and existing attendance is kept.

**Teacher Dashboard → Attendance**
- Each student gets Present / Absent, a required **Today's lesson** box, and an absence reason when absent.
- **Submit** works per student, or use **Submit all ready** for everyone filled in. A confirmation reminds the teacher it can't be changed.
- **One regular class per student per day.** After submitting, the row shows **Completed** with the lesson and is read-only. There is no edit or delete for teachers.
- **Log recovery class** is for missed or rescheduled make-up classes:
  - choose the student, date, Present / Absent and Today's lesson (required), plus an optional "makes up for" note;
  - these don't count against the one-per-day limit, and are stored with `is_recovery = true`;
  - up to 3 per student per day, and they show under the student with a gold **Recovery** tag.
- Tiles show classes conducted, present, absent and recovery classes. The calendar marks recovery days with a gold dot.
- Teachers can fill in today and the previous 31 days, never the future.

**How the database enforces it** (the browser is never trusted)
- A partial unique index allows only one regular entry per student per day. Recovery classes are excluded from it.
- Teachers may insert only. The rules no longer let teachers update or delete.
- A trigger (`daily_attendance_guard`):
  - refuses entries with no lesson and a 4th recovery class on the same day;
  - refuses any edit that isn't by an Executive;
  - stamps `created_at` and `recorded_by` itself, so they can't be faked;
  - records `edited_by` and `edited_at` when an Executive corrects an entry.
- Only Executives can change or delete entries.

**Totals: classes conducted = regular classes present + recovery classes present**
- **My Progress** has a new "Classes conducted" tile (`teacher_stats` now returns `recovery` and `conducted`).
- The **Monthly Report** fills "Total classes" with regular classes marked plus recovery classes held, and "Present" with regular present plus recovery present.
- The teacher summary PDF has Recovery and Classes conducted columns.
- Points: every present mark earns points, recovery classes included.

**Management Portal → Reports → Attendance Log** (Executives)
- Every entry of a month: date, **Regular / Recovery** tag, student, teacher, status, Today's lesson, notes, and when it was submitted or edited.
- Filters: month, teacher, attendance, class type and search.
- Totals: classes conducted, regular present or absent, and recovery classes.
- **Totals by teacher**, which opens to show each student.
- CSV export and live refresh.
- **Edit** changes the date, type, status, lesson or note, and **Delete** removes an entry. The teacher then sees "Corrected by the QIT office".
- Entries made before version 79 have no lesson and are marked as such.

### Version 80: clearer Teacher Dashboard and Import Data screens
**My Students cards**
- Each student has a coloured initials badge and a matching left edge. Neighbouring cards take turns in teal, gold and slate, so cards next to each other always look different.
- A card with a report sent back for changes turns red.
- Each card has labelled rows with icons:
  - **Classes**: the class time as a chip;
  - **WhatsApp**: the numbers;
  - **Report**: the month's report status in its own colour (not sent, submitted, reviewed, needs changes).
- The buttons sit in their own footer strip.
- Filter chips (**All · Report due · Report sent · Needs changes**, each with a count) and a search box. Search also covers the class time.

**Top tiles**
- Every tile has its own icon and colour: Students teal, Classes per week slate, Reports gold, Needs changes red when there are any.

**Executive tools** (when an Executive opens a teacher's dashboard)
- A gold header marked "Only Executives see this", with a "Has signed in / Has not signed in yet" badge.
- **Teacher details** (teal box) and **Bonus / deduction points** (gold box) are clearly separated.
- Every field is labelled, and past adjustments are listed under **History**.

**Management Portal → Import Data**
- Live count tiles for teachers, students, salary payments and saved reports, with a **Refresh** button.
- Each source is a numbered box in its own colour, with a line saying when to use it.

- Bangla labels no longer use letter spacing, which broke joined letters.

### Version 81: Teacher Reports grouped by category
**Management Portal → Reports → Teacher Reports** (and Teachers & Monthly Reports)
- Reports are grouped by the teacher's **category**, each in its own coloured section:
  - Residential (teal);
  - Non-Residential Male (blue);
  - Non-Residential Female (gold);
  - Other / category not set (grey).
- Category buttons with counts filter to one category. Month, year, teacher, search and status filters work as before.
- Each teacher is one compact row with:
  - initials, name and ID;
  - a **department** chip;
  - how many of their students have a report ("4 of 6 student reports");
  - counts of new, to-fix and reviewed reports.
- Tap a teacher's row to open that month's report cards. **Open all / Close all** opens or closes every row, and searching or picking a teacher opens the matching rows automatically.
- **Student Progress Reports** beside each teacher opens a pop-up with **every report that teacher has sent, for every month**:
  - students listed on the left, with a search box;
  - the selected student's reports newest first, with a small attendance bar chart;
  - Mark reviewed, Needs changes, Reopen, Use in progress report and Delete all work inside the pop-up.
- The category and department come from the Teachers List / Salary Directory. To move a teacher to the right section, set their category there.

### Version 82: teachers edit students, flexible schedules, September baseline
**Run `supabase/teacher-dashboard.sql` again** (safe to re-run).

**Teachers edit their students** (My Students → pencil button on each card)
- They can change the name, WhatsApp numbers (up to 4), course, class time note, and the schedule: **Fixed** (weekly days and times, edited right in the dialog) or **Flexible**.
- Everything is saved to the student's record in `portal_students`, the same record the Management Portal uses, so admins see it straight away.
- The database function `teacher_update_student` only accepts those fields. A teacher can never change the fee, the teacher share or the assigned teacher, and can only edit their own students.

**Flexible schedule** ("Flexible" in English, "সুবিধাজনক" in Bangla)
- A flexible student has no fixed days. Switching to flexible removes their weekly class times, whether it's done from the Teacher Dashboard, the Schedule page or the Management Portal.
- The switch is available in the Edit dialog, on the Schedule page, and in the Management Portal's Edit Student (Schedule field). The Students roster shows a "Flexible" badge.
- **Attendance:** flexible students get their own "Flexible students" box.
  - **Log a class** opens a panel for the date, today's lesson (required) and an optional note, and lists that month's logged classes.
  - Each class is saved as Present. A second class on the same day is saved as an extra class.
- **Monthly totals:** a flexible student's total = the classes logged that month (present = total, absent = 0). The monthly report fills this in and says so. There is no fixed target, so there are no missed-class penalties and no "classes marked %" against a schedule.

**Progress baseline: September 2026**
- Points, levels, streaks, the six-month history and monthly-report counts start from **September 2026**. Older (test) attendance and reports are left out.
  - The date is stored as `gamification_settings.config.baselineMonth` (`2026-09-01`), read by `progress_baseline()`.
  - The website uses the same date: `PROGRESS_BASELINE` in `src/lib/teacherData.js`.
- **Reports due:** the dashboard's due report is last month, but never before September. So right now the September report is due.
- **Month choices:** teachers can only pick months from September 2026 onwards in the Monthly Report. Executives can still open older months.
- **Admin screens:** Teacher Reports, the tracker, Student Progress Reports and the progress-report auto-fill start from September.

### Version 83: one place to edit

Run the updated `supabase/teacher-dashboard.sql` in the Supabase SQL Editor first (section 7j).

- **Names stay in sync everywhere:** renaming a student or teacher (by the office or a teacher) updates monthly reports, support requests and teacher accounts automatically. Existing copies were backfilled once.
- **Teachers can add students:** "Add student" in My Students creates the student in the central list (QIT-S### id). The office sees it in Students with a "New · set fee" badge, and it appears in Attendance, Schedule and Monthly Report right away (max 15 per teacher per day).
- **Deleted Teacher IDs are forgotten:** the login page checks the remembered Teacher ID; if it was deleted or turned off, it is cleared and a notice is shown.
- **Teacher Dashboard refreshes itself:** when the tab is reopened or focused, and every minute, so office changes show without reloading.
- Saved progress-report documents keep the names they were issued with (they are records).

### Version 84: no money in teachers' student panels

- **My Students and Add/Edit student** show only name, WhatsApp numbers, course, class time and schedule — no fee, payment or salary text.
- The database already ignores any fee or share sent from the Teacher Dashboard; a teacher-added student starts with fee 0 and the office sets it later in the Executive panel ("New · set fee" badge).
- No SQL change in this version.

### Version 85: Dashboard Editor + full names

Run the updated `supabase/teacher-dashboard.sql` in the Supabase SQL Editor first (section 7k).

- **Management Portal → Teachers → Dashboard Editor** (Executives only; also linked from “Executive tools” on any teacher's dashboard).
  - **Required fields:** switch each entry Required / Optional for daily attendance, recovery classes, flexible classes, the monthly report, add/edit student and support requests. Required entries show a red * and can't be sent empty. The database checks the same rules for attendance and monthly reports. Fields with a lock (e.g. Present/Absent, student name) are always required.
  - **Texts & labels:** every text on the Teacher Dashboard, in English and বাংলা, grouped by page with search. Leave a box empty to keep the original. Words in {curly brackets} (e.g. {name}) are filled in automatically; the editor warns if one is removed.
  - Teachers get the changes within about a minute (or when they reopen the dashboard).
- **Greeting shows the teacher's full name:** “Assalamu alaikum, Abdullah Rahman”, not only the first name.
- Teacher's remarks and the support subject can now be optional (when the Executives choose so).

### Version 86: new Co-Founder photo + Md. Ebrahim's students

- **Co-Founder photo:** `public/images/board/md-ibrahim-sami.jpg` replaced with the new portrait (`?v=4` so browsers load the new file; a one-time update switches the saved board entry to it).
- **`supabase/add-students-md-ebrahim.sql`:** adds 9 students (names + WhatsApp) to teacher Md. Ebrahim. Run it once in the Supabase SQL Editor; safe to run again.

### Version 87: board — new member, slightly smaller cards

- **New board member:** HM ASHIKUR RAHMAN, Head of Logistics & Welfare (+880 1624-186720, abdullahalashik.12@gmail.com), photo `public/images/board/hm-ashikur-rahman.jpg`. Added to the third row; a one-time update adds him to the saved board too.
- **Third row shows four members side by side** on large screens (two per row on tablets, one on phones).
- **Board cards a little smaller:** photos, padding, role pill and contact buttons slightly reduced.

### Version 88: board cards all the same size

- Every board member card (Founder, Co-Founder, CEO and the team) now has the same width, photo size, text size and height, a little smaller than before. Rows stay centred: 2 · 1 · 4 on large screens; cards wrap on smaller screens.

### Version 89: premium, compact board cards

- New minimal card design: soft tinted card, thin accent line on top, wide head-and-shoulders photo, small-caps role, name, a short divider and compact WhatsApp / Gmail links.
- Colours: Founder & Co-Founder share the same warm ivory-gold card; the CEO has a distinct deep-teal card; the other four alternate gold / teal as before.
- Takes about 40% less space: two rows in post order (Founder · Co-Founder · CEO, then Accounts · Marketing · HR · Logistics & Welfare). All cards the same medium size; they wrap on smaller screens. Works in dark mode too.

### Version 90: back to the v88 board layout, refined

- Board section returns to the v88 design (2 · 1 · 4 rows, same-size cards), replacing the v89 design.
- Colours: Founder and Co-Founder both gold; CEO teal; the four team cards alternate gold · teal · gold · teal (each colour with one fixed accent).
- Photos are wider and bigger (full card width, square); less space between the rows.
- Post renamed to "Head of Logistics" (the saved board updates automatically).

### Version 91: team row colours

- The four team cards now use their own two colours, alternating emerald · plum · emerald · plum (different from the gold founders and the teal CEO card). Works in dark mode too.
- The rows sit closer together (8 px apart).

### Version 92: clearly coloured board cards

- Each board card now has a clearly visible tint and a coloured border in its own colour: gold (Founder, Co-Founder), teal (CEO), emerald and plum alternating in the team row. Thicker top line; in dark mode the role labels are filled in the card colour. Photos unchanged.

### Version 93: blue instead of plum

- Head of Marketing and Head of Logistics cards are now deep blue (was plum/purple). Team row: emerald · blue · emerald · blue.

### Version 94: CEO colour, bold post titles, no gap in the progress report

- **CEO card:** terracotta (light), so it stands apart from the gold founders and the emerald/blue team.
- **Post titles:** solid coloured labels with white text (deeper shade of each card's colour), slightly larger.
- **Progress report PDF:** the Quranic Learning Evaluation now sits on page 1 under the attendance summary whenever it fits, so page 1 has no empty space. If a long letter leaves no room, it moves back to page 2 automatically. Page 2 gets a “Tips for the coming month” box (3 tips, EN/BN, editable in Portal Contents; can be switched off under Layout) and its sections are spaced evenly.

### Version 95: matching leader labels

- Founder, Co-Founder (and CEO) post-title labels are the same full width and height, with the text centred horizontally and vertically.

### Version 96: progress report page 1 always filled

- Page 1 now tries, in order: the skills evaluation; the evaluation with slightly tighter spacing; the “Tips for the coming month” box (evaluation on page 2). Any space still left is shared evenly between the sections, so page 1 never ends with a big empty block — in English and বাংলা, with short or long letters.

### Version 97: Notice Maker + evenly framed board photos

- **Management Portal → Teachers → Notice Maker** (Executives): type the topic in a few words (বাংলা or English). It guesses the kind of notice (meeting, holiday, schedule change, reminder, training, exam, event, salary, general), who it is for (all / residential / online teachers, staff, guardians) and any time or day in the topic (“রাত ৯টায়”, “tomorrow 11 am”). A formal notice is written in বাংলা (first) and English with notice number, date, subject, body, extra points and signature. Both are editable; Copy, WhatsApp and Print / PDF (letterhead). Recent notices are kept in this browser. No AI service: fixed formal templates — for a fully translated English subject, type it in the optional second box.
- **Board photos:** Founder, Co-Founder, CEO, Head of Accounts, Head of Marketing and HR Manager replaced with new square portraits framed the same way (head and shoulders, not cropped tight). `?v=5`; the saved board updates automatically. Head of Logistics unchanged.

## 9. Performance notes
- Photos are WebP in two sizes (`name.webp` and `name-sm.webp`, 640 px);
  phones download the small one. When adding your own photo to
  `public/images/`, a single JPG/WebP also works (no small version needed).
- Inner pages, the trial form, the admin panel, the Management Portal and its
  charts each load only when first needed; inner pages are prefetched while the
  browser is idle. React and the router sit in their own long-cached file.
- `netlify.toml` tells browsers to cache built files for a year and photos for a week.
- Admin edits update the screen immediately; saving finishes in the background
  and an error message appears if it fails.

## 10. Share previews (WhatsApp, Facebook, X)
The preview picture is `public/og/qit-share-banner-v2.jpg` (1200 × 630), set in
`index.html`. To change it, add a new picture with a **new file name**, update the
two URLs in `index.html` (`og:image` and `twitter:image`) and redeploy. Then ask
Facebook to re-read the page at https://developers.facebook.com/tools/debug/
(click *Scrape Again*). WhatsApp keeps old previews for a while; share
`https://quraninternational.academy/?v=2` to see the new one straight away.

## 11. Security notes

- In LocalStorage mode, the password check runs in the browser. Anyone with
  technical skill can bypass it, but they can only change content in *their own*
  browser, never the one visitors see. Use Supabase mode for a public site.
- In Supabase mode, all protection is enforced by the database policies above.
  The `anon` key is designed to be public.
- You can hide the header's "Admin" link in *Site content → Settings*;
  the panel remains available at `/admin`.

### Version 98: Notice Maker says “মিটিং”

- Bangla notices now use **মিটিং** instead of সভা everywhere: the notice type, the subject and the body (“…একটি গুরুত্বপূর্ণ মিটিং অনুষ্ঠিত হবে। উক্ত মিটিংয়ে…”). If you type সভা / সভায় in the topic, it is written as মিটিং / মিটিংয়ে. No SQL needed.

### Version 99: new Head of Logistics photo

- HM Ashikur Rahman's board photo replaced with the new portrait, framed the same way as the other members. Saved site content switches to the new photo automatically. No SQL needed.

### Version 100: smarter Notice Maker

- The topic is now only a guide. The subject is written fresh in both languages (e.g. “টিচার ড্যাশবোর্ড বিষয়ক গুরুত্বপূর্ণ মিটিং” / “Important Meeting on the Teacher Dashboard”) and the body never repeats the topic word for word. The English notice has no Bangla text from the topic.
- Times written as “৯ টায়”, “রাতে নয়টায়”, “9 pm” and dates like “৫ অক্টোবর” are understood and no longer leave stray letters (such as “য়”) behind.
- Known QIT topics (Teacher Dashboard, monthly/progress reports, attendance, schedule, Eid, Ramadan, salary, admission, Hifz, Tajweed, class quality and more) are recognised in Bangla and English. “অবশ্যই / must” makes attendance compulsory in the text.
- Two optional boxes let you write your own subject in বাংলা or English; the automatic subject shows in grey inside them.
- Sign-off is now “শুভেচ্ছান্তে” / “With regards” instead of “আদেশক্রমে” / “By order”.

### Version 101: “QIT” in Bangla notices

- The Notice Maker writes **QIT** instead of কিউআইটি in Bangla notices (“QIT-এর সকল শিক্ষক”, “QIT অফিস”). English notices already use QIT.

### Version 102: Security system

**Run `supabase/teacher-dashboard.sql` once (Supabase → SQL Editor → paste all → Run) before or right after uploading this version.**

- **Executives:** only the Gmails on the Executive list can open the admin panel, and only through **Continue with Google**. The admin password no longer opens it. The starting list is qitoffice.info@gmail.com, gmmuhit1632@gmail.com and jubayer.hossain.fm@gmail.com. Gmail treats dots as the same address, so jubayerhossainfm@gmail.com is the same account.
- **Junior Admins:** only the Gmails an Executive added, through Google. An admin sign-in with any other Gmail is refused. It no longer falls through to the teacher "name + WhatsApp" page.
- **Teachers:**
  - First time: Google only. The Gmail gets locked to the Teacher ID.
  - After that: the same Gmail through Google, then Teacher ID + password.
  - Another Gmail with a correct ID and password is blocked and logged.
  - The old sign-in with only a Teacher ID and password (no Google) is closed.
- **One device per teacher:** opening the dashboard on a new device signs the old device out, and the old device shows a message. Executives and Junior Admins can use several devices.
- **Wrong passwords:** 5 wrong tries from one Google account (or 10 on one Teacher ID) within 15 minutes pause sign-in for 15 minutes.
- **Name or WhatsApp matches** on a first sign-in are no longer linked automatically. They wait for an Executive (Teacher Dashboards), or the teacher links at once with their Teacher ID + password.
- **Management Portal → Settings & data → Security:**
  - Add, edit or remove Executives, including yourself. The last Executive can't be removed.
  - Add, edit or remove Junior Admins.
  - For every teacher: set, edit or remove the locked Gmail, see the signed-in device, and sign them out.
  - Security log of sign-ins, blocked attempts and changes.

### Version 103: Executive password as the second step

**Run `supabase/teacher-dashboard.sql` again (Supabase → SQL Editor → paste all → Run).**

- Executives sign in with **Continue with Google** using an approved Executive Gmail, then enter the **Executive password** (admin5050). The password is stored only as a bcrypt hash.
- Any other Gmail is still blocked, even with the password. The password alone, without an approved Gmail, doesn't work either.
- Executives can use several devices. Each device asks for the password once.
- 5 wrong passwords within 15 minutes pause sign-in for 15 minutes. Wrong tries are written to the Security log.
- Management Portal → Security → **Executive password**: change it. The current password is needed. Running the SQL file again never resets it.

### Version 104: Teacher IDs by category, and copying or cutting students

**Run `supabase/teacher-dashboard.sql` again (Supabase → SQL Editor → paste all → Run).**

- **New Teacher IDs follow the category:**
  - Residential: QIT-R001, QIT-R002 …
  - Non-Residential Male: QIT-M001 …
  - Non-Residential Female: QIT-F001 …
  - Each new ID gets a random 6-digit starting password. The office sees it, and so does the teacher (on their dashboard) until someone changes it.
- **New teachers wait for approval:**
  1. A new Gmail sign-up gives their name and WhatsApp number and waits.
  2. In Management Portal → Teacher Dashboards → **Approve + give ID**, choose the category. The teacher gets the next ID of that category and a password, with a ready message to copy or send on WhatsApp.
- **Copy or cut students:** during approval, and with the **Students** button on every teacher row, pick students from other teachers.
  - **Cut** moves them, and their weekly class times move too. Past attendance and reports stay with the old teacher.
  - **Copy** makes a copy with a new Student ID. The original stays with its teacher.
- **Existing teachers keep their old IDs (QIT-007) until you change them:**
  - **New ID** on a teacher's row, or **Give all new IDs** for everyone. A teacher with no category is skipped.
  - Everything moves with the teacher: students, salary and payments, reports, attendance, schedules, requests, points and the Gmail lock.
  - The password stays the same. The teacher signs in with the new ID next time.
- **Enroll Teacher:** assigns the category IDs and shows each new ID and password.

### Version 105: Replacing the same student when copying or cutting

**Run `supabase/teacher-dashboard.sql` again.**

- When you copy or cut students to a teacher, the portal checks that teacher's own students:
  - **Same name** (and no different phone number): ticked to be **replaced** by the incoming student.
  - **Same number, different name**: shown as "same number, sibling?" and **not** ticked. 2–3 brothers and sisters can share one number, so tick it only if it's the same child.
- A replaced record's class times, attendance and reports move to the incoming student, and then the old record is removed. If both have attendance on the same day, or a report for the same month, the incoming student's entry is kept.
- Phone numbers are compared by their last 10 digits, and each number in a record ("017…, 018…") counts.

### Version 106: Password-only sign-in after the first time, automatic category IDs, category tabs

**Run `supabase/teacher-dashboard.sql` again. This run changes every old Teacher ID (see below).**

- **Signing out** no longer asks for Google again on the same device:
  - **Teacher:** the next screen shows their Teacher ID already filled in. Only the password is needed.
  - **Executive:** only the Executive password is needed.
  - The Gmail lock still applies. Only the locked Gmail's device can open the account, and a new phone needs that same Gmail first. "Use another Gmail" signs out completely.
  - Junior Admins have no password, so they are still fully signed out and use Google again.
- **Old IDs are converted automatically when the SQL runs.**
  - Every teacher with an old ID (QIT-007) and a category gets their category's ID, in the order of their old numbers: Residential QIT-R001…, Non-Residential Male QIT-M001…, Non-Residential Female QIT-F001….
  - Students, salary, reports, attendance, schedules, Gmail lock and password move with them.
  - Teachers with no category keep their old ID. They appear under a "No category" tab. Set the category in the Salary Directory, then use **New ID**.
- **Teacher Dashboards:** category tabs (Residential / Non-Residential Male / Non-Residential Female), like the Salary Directory.

### Version 107: launch fixes

**Run `supabase/teacher-dashboard.sql` again (Supabase → SQL Editor → paste all → Run), then upload the files.**

**Saving and attendance**
- Admin edits send only the fields that changed, so they no longer overwrite a teacher's newer edit with an older copy. "Saved" is shown only after the database confirms the change.
- A teacher's weekly class times (Schedule) are written into the student's Class Time, so the office sees them.
- **Absent:** the "Today's lesson" box is hidden and no lesson is needed. The reason for the absence is required instead. The database enforces the same rule.

**Teacher IDs**
- **Two IDs for one teacher:** Teacher Dashboards → **Merge** moves the duplicate's Gmail lock, students, payments, attendance and reports into the real record. The teacher keeps the real ID and its password and stays signed in.
- **Approving a sign-up:** choose "Already in the Teachers List" to give the person their existing ID instead of a new one.
- Changing a teacher's ID or category no longer signs them out.

**Phone numbers**
- Teacher WhatsApp numbers are unique, compared by the last 10 digits. The database refuses a duplicate, and Enroll Teacher and Edit Teacher warn as you type. Names may repeat.

**Student status**
- Students are Active, Hold or Inactive (set in the portal's student editor). Delete still removes a student for good.
- My Students, Attendance and Reports show Active students only.
- A new **Student History** page in the Teacher Dashboard lists Hold and Inactive students, with "All-time students taught" and "Current active students".

**Dashboard calculations**
- Money saved as text is now added as numbers.
- Only Active students count towards tuition and per-student salaries.
- "Paid" compares against the month the salary is for (last month).
- New **Monthly salary by panel**: Residential, and Non-Residential (male + female together).

**Buy Course form**
- Buy Course now asks for the visitor's details first, then opens WhatsApp with the course, plan, price and those details.
- Admin → Site content → **Buy Course & trial form** sets which fields are mandatory.

**Public site design**
- Flat paper look: no floating shadow plates, no hover hops, no fade-in on every section, sentence-case section labels, a ruled gold frame on the hero pictures.

**Speed**
- Security rules are evaluated once per request instead of once per row. Reading 1,000 students dropped from about 1.2 s to about 15 ms in testing.
- A live change reloads only the list that changed, and unchanged lists don't redraw the screen.

### Version 108: previous public design restored

- The public website looks as it did in v106 again: floating 3D cards, the soft colour wash, the hero statistic boxes and the scroll-in effects. The v107 flat-paper restyle is removed.
- Everything else from v107 stays, including the Buy Course details form. No SQL change since v107.

### Version 109: name match needs no approval; ID and password shown first

**Run `supabase/teacher-dashboard.sql` again.**

- **Matched teachers need no approval.** A first Google sign-in whose name (or WhatsApp number) matches one teacher in the Teachers List who has no Gmail yet is linked at once, and the dashboard opens. If the name matches several teachers, it still waits for the office to choose.
- **New or unmatched names need approval.** When an Executive approves or assigns them, the teacher's waiting screen changes by itself to "You are approved" and shows their Teacher ID and password.
- **If the teacher was away**, the same Teacher ID and password screen is the first thing they see when they come back, before the dashboard opens.
- After that first time, signing in on that device asks only for the password.

### Version 110: teachers set a student's status themselves

**Run `supabase/teacher-dashboard.sql` again.**

- Every student starts as **Active**.
- **My Students → Edit → Status** lets the teacher choose Active, Hold or Inactive. Hold and Inactive move the student to Student History (no attendance, reports or salary count).
- **Student History → Make active** brings the student back to My Students.
- The office can still change the status from the admin portal.

### Version 111: class times save from Edit student; modern time picker

- **Fix:** in Edit student, pressing Add for a weekly class time closed the form and the time was not saved (a form inside a form). Add, change and remove now save at once and the form stays open; Enter in a class-time field saves that class time.

- Class times (teacher dashboard) and the Notice Maker time now use a tap-to-choose picker: large hour and minute buttons, an AM/PM switch, and +/- for exact minutes. It replaces the browser's scrolling time box. No SQL change.

### Version 112: office edits weekly class times; database check

**Run `supabase/teacher-dashboard.sql` again.**

- **Management Portal → Students → Edit** now has **Weekly class times**: add, change and remove the real class days and times the teacher sees (student card, Schedule, Attendance). Executives and Junior Admins. Each change is saved at once.
- Before, the office could only type a "Class Time" note, which the teacher's card ignored whenever weekly times existed.
- Giving a student to another teacher from the Edit pop-up now moves the weekly class times too (they used to stay with the old teacher).
- **Database check:** the portal shows a red notice when this SQL file has not been run for the live version.

### Version 113: "Save changes" saves the class days you picked

**Run `supabase/teacher-dashboard.sql` again.**

- **Fix:** in Edit student, choosing class days and a time and then pressing **Save changes** (without the small **+ Add** button) threw the selection away. Save changes now saves those class times as well, on the teacher dashboard and in the Management Portal. If a class time cannot be saved, the form stays open and says why.
- A student with weekly class times always shows them as Class Time; an older typed note can no longer replace them.

### Version 114: Add / Edit class time in one box; smooth panel changes

**Run `supabase/teacher-dashboard.sql` again.**

- **Add class time / Edit class time.** A student without a schedule shows "Add class time". Once they have one it becomes "Edit class time" with the saved days already selected: change the days, the time or the length and press Save changes. "Delete schedule" removes the whole schedule at once. "Add a different time" is for days that have another time. Same box in the teacher dashboard (Edit student, the Schedule button on the card, the Schedule page) and in Management Portal -> Students -> Edit.
- The whole timetable is saved in one database call (all or nothing), so a half-saved schedule is not possible.
- **Smooth panels.** Management Portal tabs and Teacher Dashboard pages ease in; the menu stays in place and highlights at once; the other panels are fetched in the background so opening one does not show a loading screen.

### Version 115: Submit request, then WhatsApp; WhatsApp number in assignment messages

No SQL change since v114.

- **Buy Course and Book Trial forms:** the button is now **Submit request**. It saves the request to Admin -> Inquiries, then shows a "send it on WhatsApp now" message with a large WhatsApp button (the details are already written). WhatsApp is no longer opened by itself.
- **Admin -> Site content -> Buy Course & trial form:** besides the mandatory/optional ticks, the heading, message and button text shown after Submit can be replaced with your own.
- **Student assignment message:** new **WhatsApp number** field, filled in automatically from a website booking and included in the message and the card.
- **Admin -> Site content -> Assignment message:** tick which assignment fields are mandatory. Student name and WhatsApp number are mandatory by default.

### Version 116: "Make progress report" on every teacher report card

No SQL change since v114.

- The **Make progress report** button was only shown inside the Management Portal. It is now also on the Teachers & Monthly Reports page (/admin/review): it opens the Progress Report engine with that teacher's report filled in.

### Version 117: one teacher order everywhere

No SQL change since v114.

- Every teacher list and drop-down in the admin area is ordered Residential, then Non-Residential Male, then Non-Residential Female, and by Teacher ID number inside each category.

### Version 118: attendance fills the progress report; smoother, floating design

**Run `supabase/teacher-dashboard.sql` again.**

- **Teacher Dashboard -> Monthly Report:** choosing a student fills Total classes, Present and the absence reason from the daily attendance. The boxes stay editable; if a saved report differs from the attendance, one button applies the attendance numbers.
- **Management Portal -> Progress Reports:** choosing a student (or month) fills Attended / Total from the teacher's daily attendance when the teacher's own report for that month is not already in the form. Executives and Junior Admins.

### Version 119: glossy animated sign-in screens

No SQL change since v118.

- **Teacher password screen** and **Admin sign-in** (Google step and Executive password step) are now a frosted-glass card on a dark teal stage with slow teal and gold glows. The password is typed into glowing boxes; a wrong password shakes them red, the right one folds them into a green tick and the card turns green before the dashboard opens.
- Typing, pasting, password managers and screen readers work as before; the animation is switched off for people who ask their device for reduced motion.

### Version 120: student payment by month

No SQL change since v118.

- **Management Portal -> Students** (Junior Admins and Executives): a **Payment month** selector at the top of the list shows each student's payment for that month.
- **Edit Student:** "Default Monthly Payment" is used automatically every month. Under **Payment for a month**, pick a month and year and change the amount for that month only; "Use the default" removes the change. Only the student's payment changes; the teacher's share and salaries still use the default.
- The Dashboard's tuition total uses this month's amounts.

### Version 121: Executive PIN

**Run `supabase/teacher-dashboard.sql` again.**

- **Management Portal -> Security -> Executive password / PIN:** choose Password or **PIN (digits only, 6 to 8)** and change it. The card shows which one is in use now.
- **Admin sign-in with a PIN:** one glowing box per digit; the PIN is checked as soon as the last digit is typed (no button). A wrong PIN shakes red and clears; the right one folds into a green tick and the panel opens. Same look as v119.
- Only the PIN's length is stored beside the hash, and only an approved Executive Gmail signed in with Google can read it.

### Version 122: calmer panel changes, more animation, office sign-in, sidebar fix

No SQL change since v121.

- **Sidebar:** "Messages & leads" (Inquiries first, with its new-count) now sits above "Website", and the footer is one compact row, so Inquiries is never hidden behind Sign out.
- **No more shake when changing panels:** the page keeps its scrollbar space, panels keep a minimum height, and the change is one soft fade. Menu buttons no longer move on hover.
- **Animation:** in the Management Portal and every teacher dashboard the header settles in, cards arrive one after another, numbers rise into place and the open section's icon pops gently.
- **Admin sign-in background:** a charcoal-and-gold "office" stage with ledger rules, a gold top line and a quiet rising chart; the teacher screen keeps its teal look.

### Version 123: status on every student line

No SQL change since v121.

- Management Portal -> Students: every student line now shows its status chip (Active in green, Hold in amber, Inactive in grey) beside the name, in every tab.

### Version 124: delete animation, dock-style menus, press sounds

No SQL change since v121.

- **Delete buttons everywhere** (admin and teacher panels): "the bin eats the label". The bin tips, the label is pulled in, the button closes to a circle with a ring, then opens again. The button's action is unchanged.
- **Dock-style menus:** on the public header (Courses, Why Us, Testimonials…) the item under the pointer grows and its neighbours grow a little, with a gold dot under the section in view. In the admin side menu, the Management Portal menu and the teacher menu the icons magnify the same way.
- **Soft press sounds** in the Executive, Junior Admin and teacher panels (not on the public website), made in the browser. A "Sounds on / off" switch is in the admin side menu and the teacher header; the choice is remembered on the device.

### Version 125: crisper sounds, one instrument per panel; brighter dock menus

No SQL change since v121.

- **Sounds:** every press now starts with a tiny bright tick and has a quiet overtone, so it is sharper and cleaner. Each panel has its own instrument: Executive = crystal (glassy, high), Junior Admin = marimba (round, wooden), Teacher = pluck (warm string). Menu presses are a quick two-note rise, delete is a two-note fall.
- **Dock menus:** the hovered item pops up higher on a glowing gold pill (public header); in the side and panel menus the icon fills with colour and glows and the button gets a coloured outline; pressing squeezes it; the open section's icon pops with a glow ring.

### Version 126: menu buttons pop as a whole; every menu item has its own note

No SQL change since v121.

- **Menus (Management Portal, admin side menu, teacher menu):** the icon no longer grows over the label. The whole button lifts slightly with a coloured outline, sinks for a moment when pressed, and the section you open settles in with one soft pop.
- **Sounds:** every item of a menu now has its own note (a pentatonic scale, so they all sound good together). The left side menu plays one clear note with a soft octave under it; the Management Portal and teacher menus play a quick two-note rise starting on the item's note. Each panel keeps its own instrument.

### Version 127: icon pop restored, no overlap

No SQL change since v121.

- The menu icons pop up again as in v125 (the whole-button lift of v126 is removed). The icon now grows from its left edge and the label moves aside by the same amount, so the icon never covers the text. The per-item menu notes of v126 stay.

### Version 128: no Google step flash; animated password panel

No SQL change since v121.

- **Admin sign-in on a device already connected with Google:** the "Continue with Google" step no longer flashes for a second. Three gold dots show while the device is checked, then the password / PIN panel arrives with a motion: the text rises in, the boxes drop in one by one, and a gold sweep crosses them.
- The Google step still shows the first time on a device, and after "Use another Gmail".

### Version 129: Teacher List for Junior Admins

**Run `supabase/teacher-dashboard.sql` again.**

- **Management Portal -> Teacher List** (Junior Admins and Executives): every teacher by category (Residential, Non-Residential Male, Non-Residential Female), with department, WhatsApp, Gmail and number of active students. Search looks in all categories.
- **Edit** changes a teacher's name, WhatsApp number and department. Nothing about money is shown or editable here; the database itself ignores any salary, bank, category or Gmail change sent through this panel.
- A change is saved to the one teacher record, so it shows everywhere (Teacher Dashboard, reports, Salary Directory) as before.

### Version 130: full teacher edit for Junior Admins (no salary); sign-in motion everywhere

**Run `supabase/teacher-dashboard.sql` again.**

- **Teacher List -> Edit (Junior Admin):** the same form as the Salary Directory: name, WhatsApp, Gmail, department, category, payment method and bank / account details. Only the Salary Model and its amount are left out; the database ignores them if a Junior Admin sends them. Changing the category gives the teacher a new ID exactly as it does for an Executive.
- **Teacher List -> Edit (Executive):** the complete form, with Salary Model, amount and Delete, the same as in the Salary Directory.
- **Sign-in motion:** the teacher password page now arrives with the same motion as the admin one (text rises in, boxes drop in, gold sweep). The "Continue with Google" steps of the Teacher Dashboard and of the Admin / Junior Admin sign-in also rise in.

### Version 131: salary disbursement by month; dashboard period; leaderboard on the dashboard

No SQL change since v130.

- **Why a disbursement seemed to vanish:** it was saved for the salary month (September) while the screen was showing October, so the history and the "Disbursed" figure looked empty. Nothing was lost.
- **Salary Directory and the teacher workspace open on last month** (September's salary is paid in October) and stay there after disbursing. The separate "Salary month" boxes are gone: the Period at the top is the month being paid.
- **Payment history** lists every disbursement of the teacher with its salary month beside it; it no longer changes with the period.
- **One disbursement per month:** once a month is paid, the amount box is replaced by "Disbursed" (also on the teacher's card in the directory) until that payment is cancelled in the history.
- **Dashboard:** Last month (default) / This month / Overall buttons plus month and year pickers. The tuition, report and salary-paid figures follow the choice.
- **Dashboard -> Teacher Leaderboard:** top 10 teachers by points for the chosen month (all-time points in Overall).

### Version 132: phone layout, bottom bar in the admin, colour themes, clearer menu, sharp app icon

No SQL change since v130.

- **Admin on a phone:** a bottom bar with Home, Students, Salary, Reports and More (Junior Admin: Students, Teachers, Reports, Attendance, More). More opens every section, grouped by colour.
- **Management Portal menu:** one tidy index, one coloured row per kind of work (Overview, People & salaries, Reports, Teacher tools, Settings & data), with a "Find a section" box (type, press Enter).
- **Colour themes (Executive only):** Theme button in the portal header and "Colour theme" in the side menu: QIT Teal, Royal Blue, Emerald, Plum, Maroon, Slate. Saved on the device; the public website and the Teacher Dashboard keep the QIT colours.
- **Tables:** dark headings with a gold line in every portal table; the Teacher List has icons in the headings and coloured chips for category, department, payment method and student count.
- **Phone numbers:** never split over two lines; in the admin and teacher pages each number opens WhatsApp and the handset beside it starts a call (017... numbers get the 88 country code for WhatsApp).
- **Public website on a phone:** Courses, Why Us, Testimonials and Contact sit under the header (More opens the rest); board members are two per row (Founder and Co-Founder side by side, CEO below, the team two by two); the footer shows Explore and Courses side by side ("Classes" is now "Courses"); the Book Free Trial box and the floating contact buttons are smaller.
- **App icon:** a web app manifest with sharp 192, 384, 512 and 1024 px icons. Remove the installed app and install it again to get the new icon.

### Version 133: Notes buttons; clearer dashboard

No SQL change since v130.

- **Notes:** the long explanations at the top of a panel (Teacher Dashboards, Security, Team & Roles, Notice Maker, Portal Contents, Dashboard Editor) are folded behind a yellow **Notes** button at the right of the panel title. Press it to read them, press again to hide.
- **Dashboard:** a large "Salary for <month>" band shows Total salary, Paid and **Left to pay** in big figures with a progress bar and how many teachers are paid or waiting. Each panel box shows Monthly salary, Paid and Left as separate figures. A new list shows the teachers still waiting for that month's salary and how much each is owed. Tile labels and numbers are larger.

### Version 134: three colours per theme; group names stand apart; themes reach the dashboard

No SQL change since v130.

- **Management Portal menu:** the group names (Overview, People & salaries, Reports, Teacher tools, Settings & data) are solid coloured tabs with white capitals; the sections inside are white outlined pills, so the two no longer look alike. Blue, purple and pink are gone.
- **Three colours per theme:** a main colour, an accent and a neutral grey. Themes: QIT Teal, Royal Blue, Emerald, Midnight, Maroon, Slate (Plum is replaced by Midnight).
- **Themes change more:** dashboard tiles, the salary band, panel boxes, charts, table headings, chips, Notes buttons and the menu all follow the chosen theme.

### Version 135: palette themes; menu boxes as before with highlighted group names

No SQL change since v130.

- **Menu:** the section boxes have their earlier shape and size again (tinted box, coloured left edge, white icon tile). Only the group name on the left is now a solid coloured tab.
- **Themes:** QIT Teal stays; the others are replaced by five palettes: Layers of the Ocean, Rosewood, Wine & Petrol, Deep Lagoon, Forest & Sand. Each has a main colour, an accent and a neutral, used in the side menu, portal menu, dashboard tiles, salary band, charts, tables, chips, Notes and the Salary Directory figures.

### Version 136: side menu footer made compact

No SQL change since v130.

- The bottom of the admin side menu (Website, Theme, Sounds, Sign out) is now one row of small buttons instead of four lines, so it no longer covers the last menu items. On short screens the menu rows are also slightly tighter.

### Version 137: menu groups on one line

No SQL change since v130.

- Every group of the Management Portal menu stays on one line: Teacher Support now sits beside Notice Maker, so the Teacher Tools row is the same height as the others.

### Version 138: bottom bar on every admin page (phones)

No SQL change since v130.

- On a phone, every Executive admin page now has the bottom bar: Portal, Reports, Inquiries (with the new count), Website and More (the full menu). Inside the Management Portal the bar shows the portal sections as before.

### Version 139: page no longer moves by itself; smaller public boxes; portal first after sign-in; one bottom bar

No SQL change since v130.

- **Phone, page moving up and down:** the rotating banner under the header changed height with each message and pushed the page. It now keeps one height.
- **Public website:** the Book Free Trial box and the Our Promise box are smaller on phone and PC (the promise points sit in two columns on wider screens). In the course boxes the icon sits left of the course name.
- **After signing in** the first page is the Management Portal dashboard (a link to a specific admin page is still honoured).
- **Phone bottom bar (Executive), on every admin page:** Portal, Assign, Inquiries, Teachers, More. Website dashboard, Courses, Pricing and the rest are under More. Inside the Management Portal a "Section" button on top opens the portal's sections. Junior Admins keep their portal bar.
- **Management Portal menu:** the boxes stretch to fill the row, so no empty space is left at the right. On tall screens the left side menu spreads out to use the empty block.
- **Phone side menu:** the close (X) button no longer sits over the institute name.
- **Theme** is only in the bottom row of the side menu now; the button in the portal header is removed.

### Version 140: smaller Trial Class section on phones; menu sections as icon tiles

No SQL change since v130.

- **Public website, phone:** the Trial Class section is much shorter: a wide photo strip instead of a square photo, smaller heading, text, button and steps.
- **Management Portal menu (PC):** every section is a white tile with its own icon in a coloured badge above the name and a coloured bottom edge, so sections are told apart by their icon. The open section is filled with the group colour. The tiles still fill the row.

### Version 141: short page headers; compact menu boxes with icons at the left; pops stay inside

No SQL change since v130.

- **Public pages (Contact, Courses, About...):** the title band at the top is much shorter on PC and phone, so the content starts sooner.
- **Management Portal menu (PC):** the section boxes are small again with the icon badge at the left of the name; the group tabs are smaller too. Boxes still fill the row.
- **Press and hover:** in the portal menu only the icon badge pops, inside its box. In the left side menu the icon and name pop slightly; the gold border and the oversized icon that covered neighbours are removed.

### Version 142: AI assistant (Gemini); clearer pops only on the item under the cursor

No SQL change since v130.

- **Pops:** hovering one menu box no longer makes its neighbours pop. The pop is stronger: the box lifts with a shadow and its icon badge grows; in the side menu the icon and name grow more.
- **Notice Maker -> Write with AI:** Gemini reads the topic (any wording, বাংলা or English), writes a precise subject and a fuller body for that topic in both languages, in the usual notice layout. The built-in notice stays as it was and is used when AI is not available.
- **AI assistant (admin):** the AI button in the bottom row of the side menu opens a chat that writes messages, replies, reminders and translations by instruction. It writes text only; it cannot see or change records.
- **Setup (once):** get an API key at https://aistudio.google.com/apikey and add it in Netlify -> Site configuration -> Environment variables as `GEMINI_API_KEY`, then deploy from the source files (the AI runs as a Netlify function in `netlify/functions/ai.mjs`; a drag-and-drop of the ready-to-publish folder does not include it). Optional `GEMINI_MODEL` forces one model. The key is never sent to the browser; only signed-in Executives and Junior Admins can use the AI.

### Version 143: Notice Maker writes with Gemini by itself; the assistant finds records

No SQL change since v130. Needs `GEMINI_API_KEY` in Netlify and a deploy from the source files (see v142).

- **Notice Maker:** the "Write with AI" button is gone. About a second and a half after you stop typing, Gemini writes the notice by itself (a chip shows "Gemini is writing…", then "Written by Gemini"). The built-in notice appears at once and stays when AI is not available. A notice you edited by hand or opened from Recent notices is not rewritten.
- **AI assistant finds records:** the assistant now reads the office records the signed-in person may see (students, teachers, progress reports, teachers' monthly reports; salary payments and fees for Executives only) and answers from them: find a student by name or number, list students on Hold, teachers without students, who has not reported, who is still to be paid. Teacher IDs in an answer open that teacher's dashboard. It still cannot change records.
- The other generators (Assignment message, progress report, salary certificate) fill a fixed form with exact names, times and amounts, so they are left as they are.

### Version 144: Gemini key sent in a header

No SQL change since v130.

- The AI function now sends the Gemini key in the `x-goog-api-key` header, which works for both the older `AIza...` keys and the newer `AQ....` keys.

### Version 145: Junior Admin PIN; sign-out keeps Google; teacher sign-in on the glass stage; notice from a full prompt

**Run `supabase/teacher-dashboard.sql` again** (run it first, then publish).

- **Junior Admin PIN:** after the first Google sign-in a Junior Admin chooses a 6-digit PIN (typed twice). "Sign out" then only locks the portal on that device: next time only the PIN is asked, not Google. Five wrong tries pause sign-in for 15 minutes. An Executive resets a forgotten PIN in Security -> Junior Admins -> Reset PIN. The database itself refuses a Junior Admin whose device has not entered the PIN.
- **Teachers:** sign-out already kept Google and asked only for the password; it now also does so when the connection is weak at the moment of signing out (that case used to sign Google out too). "Use another Gmail" still signs out completely.
- **Teacher Dashboard sign-in:** the Google step is on the animated glass stage (the teal teacher stage, not the darker office stage of the admin sign-in), and no longer flashes when the device is already connected. The password panel keeps its motion.
- **Notice Maker:** the "What is the notice about?" box is now a prompt. Write the topic, what the body must say, tone and points; Gemini writes the notice from that. The box is taller.
- **AI assistant:** text from the page behind no longer shows through the panel.

### Version 146: teachers on several devices

**Run `supabase/teacher-dashboard.sql` again.**

- A teacher can keep the dashboard open on several devices at a time (phone, laptop...), like the admins. Each device signs in with the same Gmail that is locked to the Teacher ID, then the password once; a different Gmail is still refused. Opening a new device no longer closes the others.
- Sign out on one device locks only that device. A new password, switching the sign-in off, a Gmail change or "Sign out" from Security locks every device of that teacher.
- Devices already open before this update stay open.

### Version 147: Junior Admin password set by an Executive

**Run `supabase/teacher-dashboard.sql` again.**

- **Security -> Junior Admins -> Junior Admin password:** an Executive sets (and later changes) one password for all Junior Admins: 6 to 64 characters, or 6 to 8 digits for a PIN. Junior Admins enter it after their first Google sign-in on a device and after every sign-out; they do not choose their own any more. Changing it locks every Junior Admin device until the new one is entered.
- Until an Executive sets it, each Junior Admin keeps using the personal PIN from v145.
- Teacher IDs and teacher passwords are unchanged.

### Version 148: Junior Admin password can be saved

**Run `supabase/teacher-dashboard.sql` again.**

- Setting the Junior Admin password failed with "DELETE requires a WHERE clause" (a Supabase safety rule). Fixed in the SQL.

### Version 149: the installed app opens where it was installed from

No SQL change since v148.

- Adding the site to the home screen (iPhone) or installing it as an app (Android, PC) from inside the admin panel now opens the Management Portal; from the Teacher Dashboard it opens the Teacher Dashboard; from the public website it opens the website. Before, every installed app opened the public home page.
- Remove the old home-screen icon and add it again from the page you want it to open.

### Version 150: Teacher List fits the screen

No SQL change since v148.

- Teacher List: every column, including Students and Action, is visible at once on a PC without sideways scrolling. The text, chips and spacing are a little smaller, a long name wraps under itself, and a long Gmail is shortened with "..." (hover to see it in full).

### Version 151: Teacher List with ID and Gmail under the name

No SQL change since v148.

- Teacher List: the Teacher ID sits under the name and the Gmail under the ID, shown in full. With the Gmail column gone, the text, chips, phone numbers and student counts are larger; the edit button is smaller. All columns stay on screen on a PC.

### Version 152: golden icons back in the side menu

No SQL change since v148.

- In the admin side menu the icon turns gold again when you point at or press an item (removed by mistake in v141). It still pops inside its own row without covering its neighbours.

### Version 153: new colour themes, lists as tappable boxes, faster search, no more frozen scrolling

No SQL change since v148.

- Themes: the 12 new palettes replace the old ones (QIT Teal stays the default).
- Admin pages no longer freeze: closing pop-ups in any order always gives scrolling back, and a safety check frees a stuck page by itself.
- The mouse pointer stays visible over every search and typing box.
- Search understands phone numbers in any format (17098856199 finds +1 (709) 885-6199; 8801711… finds 01711…). Searching is smoother while typing.
- Search bars stay at the top while scrolling (pin button bottom-right turns this on/off); a "go to top" button appears on long pages. On phones the admin top bar stays fixed.
- Student and Teacher lists: each row is a soft coloured box; tap anywhere on it to open the profile. Student list opens on "All".
- Executive student list: Teacher Share shows amount and % (Fixed-Salary teachers' share is spread over their active students instead of showing 0).
- Teacher Dashboard Attendance lists only students who have a class that day; a small note counts students with no class times set.
- Home-screen app: if it starts on the public page while you are signed in, it goes straight to the admin dashboard (or Teacher Dashboard).

### Version 154: Attendance section, Teachers & Reports, payment sources, phone bar for teachers

No SQL change since v148.

- Management Portal: the "Reports" group is now "Attendance". Progress Reports and Teacher Reports moved to **Teachers & Reports** in the left menu (tabs: Teacher Reports · Progress Reports · Teacher List). Junior Admins see it too. Old links still work.
- Teachers & Reports → Teacher List fits the page; Edit and Delete are small icon buttons that stay on screen.
- Attendance log: coloured summary boxes (follow the theme), teacher category tabs (Residential / Male / Female), a date picker to see one day, and entries grouped under date headings.
- Dashboard: new "Money transferred by" panel (Bank, Bkash, Nagad, Other). Overview boxes are coloured by the theme; the waiting-for-salary list and the leaderboard are lightly tinted.
- Salary Directory: each disbursement records how it was sent (defaults to the teacher's "Paid by").
- Teacher Support: a resolved request can be cleared. When the office marks a request Resolved, the teacher sees a green notice with the reply on their dashboard until they press OK.
- Tap a student's or teacher's name (attendance log, student list, dashboard, support, reports) to open their profile.
- Teacher Dashboard on phones: bottom bar with Attendance, Schedule, Reports, Support and ☰ Menu.

### Version 155: salary and revenue by days (Assignment Date, dated Hold/Inactive), notes, total dues

No SQL change since v148.

- Student: new optional **Assignment date** (Edit Student and Enroll Student). Every month counts as 30 days:
  - 1st–3rd: full month.
  - 4th–15th: the days left (30 − date) — e.g. 13 Sep = 17 days — paid with that month's salary (in the next month).
  - 16th–end: the days left are added to the next month's salary (16 Sep = 14 days, paid in November with October's full salary).
- Changing a student's status (Active ↔ Hold / Inactive) now asks for the date:
  - Hold/Inactive on the 1st–3rd: that month is not counted. From the 4th: that many days are counted (4th = 4 days, 5th = 5 days…).
  - Back to Active follows the Assignment-date rules.
  - The student's payment (revenue) follows the same days, in the month itself.
- Student list, Salary Directory, Teacher Workspace and the Dashboard use these prorated amounts and show a short note (e.g. "17 days (started 13 Sep)").
- Disbursing an amount different from the calculated salary needs a short note (bonus, deduction…). The paid amount is final for that month; the history shows "+500 vs calculated 5,000 · Eid bonus".
- Salary Directory shows each teacher's **Total due** (undisbursed months up to last month, up to a year back); the Workspace lists those months with their part-month notes.
- Students without an Assignment date or dated status change are counted as before (full months).

### Version 156: new teacher passwords, ID gaps closed, delete requests, recovery approval, class division, sibling IDs

**Run `supabase/teacher-dashboard.sql` again (SQL version 149).**

- Teacher passwords by category and ID number: Residential QIT-R001 = 1010 … 1999, Non-Residential Male QIT-M001 = 2020 … 2999, Non-Residential Female QIT-F001 = 3030 … 3999. (Female starts at 3030 so it never overlaps Male.)
  - Running the SQL switches every teacher to the new password. Each teacher's old password opens the dashboard **one last time**; then a big notice shows the new password.
  - The same happens when the office changes a password or a Teacher ID: the old ID / password work once, then the notice shows the new ones.
  - The Teacher ID and password are always shown at the top of the teacher's own dashboard. The office sees the password in use in Teacher Dashboards (no more "Office password").
- Teacher IDs have no gaps: after a merge, later IDs of that category move down by one (R025 → R024). Teacher Dashboards shows any existing gaps with a "Close the gaps" button. An ID that still holds a deleted teacher's history stays taken.
- Students with the same WhatsApp number get Student IDs one after another. It happens by itself when a brother/sister is added; Students → "Find duplicate numbers" lists them, and "Put them one after another" re-orders the existing ones (the same ID numbers are reused, only their order changes; class times, attendance and reports move with each student).
- Teacher Dashboard:
  - **Class division** (Bangla Medium / English Medium) is required for every student and shown on the student card; the monthly report asks for it too, with the date classes started (1st–3rd = full month, from the 4th = days left).
  - **Delete a student** sends a request to the office; the student leaves the teacher's lists at once and waits in their "Delete list". Executives confirm or keep it from the student's profile (Students → "Delete requests").
  - **Recovery classes** of the running month count at once; one for an earlier month shows "Needs office approval" until an Executive approves it in the Attendance log ("Approval required").
  - A status change made by the teacher asks for the date (used for the day-by-day salary).
- Teacher profile (Edit Teacher) has **Assign Students**: add students straight to that teacher with fee, share, Assignment date and division.
- Executives opening a teacher's dashboard get an Office panel: every student with full edit (payments too) and delete, Assign Students, and that teacher's attendance log with edit / delete.

### Version 157: works where supabase.co is blocked, office alerts, faster salary pages

No SQL change since v156 (SQL version 149).

- Networks that block the database address (*.supabase.co): every database call now falls back to this website's own address (`/sbapi`, forwarded by Netlify), and that browser keeps using it. The Teacher Dashboard and admin panel then work there.
  - `/check` (e.g. quraninternational.academy/check) shows what works on a network; a teacher can send a screenshot.
  - Google sign-in on such a network: the usual Google redirect returns through supabase.co, which is blocked. To give those teachers Google's own sign-in button instead, add `VITE_GOOGLE_CLIENT_ID` (the Google OAuth Client ID, not the secret) in Netlify → Environment variables, and add `https://quraninternational.academy` under "Authorized JavaScript origins" of that client in Google Cloud Console. Without it, they sign in once on another network (e.g. mobile data or VPN); after that the dashboard works on the blocked network.
  - Live updates (instant refresh) use a connection that cannot take this route; on a blocked network the pages refresh every minute instead.
- Office alerts: unread / waiting counts on Management Portal (teacher requests, recovery approvals, delete requests), Teachers & Reports (reports to review), Inquiries, and on the portal sections. "Alerts" in the side-menu footer turns on device notifications for anything new; they also come when the device is back online or the tab is opened again (the admin panel must be open in a tab or as the home-screen app).
- Salary Directory works out every teacher's figures once per change, so typing and searching stay smooth.

### Version 158: board cards fit their content

No SQL change since v156 (SQL version 149).

- Board members: add or remove members in Website → Board, teachers & reviews. Every detail except the name can be left empty (position, photo, WhatsApp, email, profile); an empty detail is hidden and the card gets shorter instead of keeping empty space. Without a photo a small initials badge is shown. Cards in a row no longer stretch to the tallest one.

### Version 159: new Bangla fonts (clear numbers)

No SQL change since v156 (SQL version 149).

- Bangla text everywhere (website, Teacher Dashboard, admin panel, printed reports and certificates) now uses **Noto Sans Bengali**: clear, full-size digits ০–৯ for prices, schedules and dashboards.
- Bangla headings and section / card titles use **Noto Serif Bengali** (bold) for a formal institute look.
- English text keeps Bahnschrift / Barlow. Hind Siliguri and Aikya are no longer used (their files stay in public/fonts but are not downloaded).

### Version 160: no sideways scrolling, clearer salary figures, names open profiles, Bangla text editor, earlier Bangla font back

No SQL change since v156 (SQL version 149).

- Admin panels (Executive and Junior): no sideways scroll bars. Enroll Student / Enroll Teacher rows are boxes with the fields in rows; wide tables wrap; on phones every table row becomes a box with each field labelled.
- Salary Directory: Tuition, Faculty cut, Disbursed and Total due each in their own coloured box. One "Total due" (last month plus any older unpaid months; the months are listed). A student assigned later than the chosen month is still listed in the teacher's profile, with "starts … — nothing for September".
- Executives: a teacher's name anywhere (student list, attendance, reports, report pages, teacher lists, dashboard) opens the full profile as in the Salary Directory. Student names open the student's details.
- Notice Maker moved to "Attendance & Notices".
- Active / Hold / Inactive labels are solid green / amber / red.
- New: Website → **Bangla text**. Every Bangla word of the public website can be edited — website content (courses, teachers, reviews, board, FAQ, home page, also items added later) and menus / buttons / messages. "Original" brings back the built-in translation.
- Side-menu footer: two rows of three larger buttons.
- AI assistant answers faster (quick Gemini Flash models first; smaller data sent).
- Teacher Dashboards list: coloured rows like the Teacher List.
- Bangla font as before (Hind Siliguri, now the lighter weight, and Aikya for bold); the digits ০–৯ keep the clear Noto Sans Bengali.

## Version 161
- Entry forms: the remove (×) button sits at the bottom right of each box.
- Bangla font back to the original (Hind Siliguri Regular + Aikya; Aikya in the admin); the numbers ০–৯ keep Noto Sans Bengali.
- Teacher reports: pressing a teacher's name or box opens the reports; pressing the name again opens the teacher's profile.
- Pressing a student's name opens "Student details" with payment terms (monthly payment for all staff; teacher share and the rest for Executives only).
- Student list: smaller rounded-rectangle Active / Hold / Inactive labels beside the name; a Bangla / English Medium box under the ID (red "Medium not set" when missing).
- Bangla / English Medium is required when enrolling, assigning or editing a student.
- No SQL change (still 149).

## Version 162
- iPhone / iPad "Add to Home Screen" from the admin panel now opens the admin (QIT Admin → Management Portal), not the public website: on iOS, moving from the website into the admin or Teacher Dashboard loads the page fresh once so the phone reads the right app details.
- Opening /admin directly (bookmark or home-screen app) lands on the Management Portal dashboard; the menu's Dashboard link still opens the website dashboard.
- No SQL change.

## Version 163
- iPhone home-screen fix, done on the server: the admin panel and the Teacher Dashboard are now sent as their own pages (admin.html / teacher.html, written by vite.config.js at build) with their own app details, so "Add to Home Screen" saves "QIT Admin" → /admin/portal (and "QIT Teacher" → /teacher). public/_redirects sends /admin/* and /teacher/* to them; netlify.toml keeps the app details fresh.
- Phones: the "More" (3 lines) button shows a red dot while reports, teacher requests, approvals, delete requests or inquiries are waiting; Portal and Teachers show their counts.
- No SQL change.

## Version 164 (SQL 150 — run supabase/teacher-dashboard.sql)
- Payment panels (Salary Directory, a teacher's salary page, Students, Dashboard): the month picked is the **Payment month** by default — October shows September's tuition, teacher share and due (January's salary is paid in February). A switch next to the month (**Payment month / Class month**) lets an admin see October's own figures by picking October instead; remembered on that device.
- Teacher sign-in: earlier Teacher IDs and passwords (the first password, the one before, and old IDs — also after several changes) open the dashboard until the teacher closes the "new ID / password" notice, which shows right after signing in. New table teacher_old_logins keeps them; Security log shows "Signed in with an earlier ID / password".

## Version 165
- Faster, cleaner section switching in the Management Portal: only the first rows of long lists animate in, the Students list shows its first rows at once, and menu buttons change colour instantly (no half-drawn white "Salary Directory" button).
- "Send on WhatsApp" after approving/linking a teacher, changing an ID or changing a password opens the chat with that teacher (their WhatsApp from the Teachers List) with the message ready. Changing a password now shows the same send-ready card.
- Department labels are rounded rectangles like the Per-Student label; "Method/Acc: undefined" no longer shows.
- No SQL change (still 150).

## Version 166
- One calendar for every date box (website, admin, Management Portal, Teacher Dashboard): components/ui/DatePickerHost.jsx, mounted once in App.jsx. Month + year header (press it for a year list), < > arrows, S M T W T F S, round days, picked day filled, today ringed, min/max respected, Today / Clear, Bangla names and numbers on Bangla pages, month boxes get a 12-month grid. Colour-shaded background that follows the colour theme. On phones it replaces the phone's own picker; on computers typing in the box still works.
- No SQL change (still 150).

## Version 167
- Phones: the Students list shows in pages (30 on phones, 100 on computers, "Show more") — drawing every student at once ran out of memory on iPhone ("This webpage was reloaded"). On phones a section no longer slides in as one huge animated picture, and month pickers / switches wrap instead of making the page wider than the screen (Android Dashboard).
- Disbursed payment history note reads "Sept. Salary 5,000 + 1,050 (Due of Joining 10 Days)".
- No SQL change (still 150).

## Version 168 (SQL 151 — run supabase/teacher-dashboard.sql)
- Same WhatsApp number + same name = the same student. Enroll, Assign students, Edit student and the teacher's Add student stop it ("Brothers and sisters need different names") unless "Same student, 2 different classes" is ticked; that record gets sameStudentOf and the Students list shows "Same student, 2 classes · QIT-S…". The database checks it too (staff_add_students, teacher_add_student; same_student_of()).
- Husband and wife: Edit Teacher → "Salary paid together with" (payWith on the wife). The husband's card and page add her salary and due; one Disburse records both (shared group), Cancel removes both. Her page shows her own figures and "Paid together with … — disburse from his page".

## Version 169
- Teacher Dashboard: the report list is read again whenever the dashboard refreshes (every minute and when the phone/tab comes back), so the office's "Needs changes" shows without reopening the page. A red list on the home page shows every sent-back report of any month with the office's note and a "Correct now" button.
- No SQL change (still 151).

## Version 170
- Enroll Student and Assign Students: a "Same number?" box inside each entry. As soon as the WhatsApp number matches another student it lists them and asks "Relative (brother / sister)" or "Same student, different class" before saving (a relative needs a different name; the same student is linked with sameStudentOf; relatives are marked relative: true).
- No SQL change (still 151).

## Version 171
- "Same number?" in Enroll / Assign: small tick boxes (Relative · Same student, different class) that fit the entry's empty space — the entry box doesn't grow.
- Wider search boxes: "Find a section…" in the portal menu and the Student roster search.
- No SQL change (still 151).

## Version 172
- Enter saves / confirms everywhere (components/ui/EnterToSave.jsx): in a form it is sent; in a pop-up or the pay-out bar the main button at the bottom is pressed (Save, Disburse…), and the confirm box takes Enter too. Not in long text boxes (Ctrl/⌘+Enter there), search boxes or open lists.
- Student list: Class time shows just the time from the teacher's weekly schedule and "N days a week" (hand-typed class times stay as written).
- Progress Reports (admin): the student's Bangla / English Medium is shown under the student, and in the student list.
- Date boxes: calendar sign on the right everywhere (admin boxes too); a picked date gets a coloured rounded background and a × to remove / replace it.
- No SQL change (still 151).

## Version 173
- Salary Directory card: the note written when disbursing (bonus, deduction, "Due of Joining 10 Days"…) shows under the Disbursed box.
- No SQL change (still 151).

## Version 174
- Mouse pointer: arrow over plain text, labels and empty space; hand over buttons, tabs, links, lists, date boxes and tick boxes; I-beam only in boxes where you type.
- Student roster: month picker moved up into the title row; the search bar is full width under it (like Teacher List).
- No SQL change (still 151).

## Version 175
- Management Portal menu: bigger section names (and group titles) in the same boxes; icons and box sizes unchanged.
- No SQL change (still 151).

## Version 176
- "Reports" button on a teacher's Salary Directory page and on their Teacher List profile: opens that teacher's monthly reports (every student, every month) in Teachers & Reports (/admin/review?tab=reports&teacher=ID).
- Portal menu: section names 10% smaller than v175; the group names (OVERVIEW, ATTENDANCE & NOTICES…) sit in the middle of their box, top to bottom.
- No SQL change (still 151).

## Version 177
- Moving a student to another teacher (Edit Student → Assigned Teacher + Assignment date): the old teacher automatically keeps the days up to the move date for that month (1st–3rd nothing, from the 4th that many days — 8 Oct = 8 days), paid with that month's salary (October's, paid in November), with a note "8 days (moved to …)". The new teacher counts from the Assignment date as before. Stored as teacherLog on the student; correcting the Assignment date later moves the old teacher's last day too.
- No SQL change (still 151).

## Version 178 (SQL 152 — run supabase/teacher-dashboard.sql)
- Salary Directory → new tab "Management Team Salary": add office team members (name, role, WhatsApp, email, monthly salary, joining date, paid by / bank / account, address, NID, status, notes). Each card shows the month's salary, disbursed and total due; the profile has Disburse (with a note when the amount differs), dues and payment history with Cancel. Joining / leaving mid-month follows the same day rules as teachers. Stored in the new Executive-only table portal_team.
- Teacher "Reports" button (Salary Directory page and Teacher List profile) now opens the teacher's reports in a pop-up right there — no page change; Mark reviewed / Needs changes / Delete work inside it.

## Version 179 (SQL 153 — run supabase/teacher-dashboard.sql)
- Teacher notifications: what the office does for a teacher becomes a notification — report reviewed / sent back, salary disbursed, new student, student moved away, student on hold / inactive / active, request answered, recovery class approved or not, points, Teacher ID / password changed, and office notices. Shown in the dashboard (bell with an unread count, list in Bangla or English; tapping one opens its page) and sent to the teacher's phone.
- Phone notifications (Web Push): the teacher taps "Turn on phone notifications" (bell, or the card on My Students). Android: works in Chrome straight away. iPhone (iOS 16.4+): add the dashboard to the Home Screen first, open it from there, then turn on. Each phone gets the language its dashboard is set to.
- Office: "Notify teachers" (Teacher Dashboards) sends a message to all, a panel, or chosen teachers; Notice Maker has "Send to teachers' phones" (subject = title, the notice = message).
- Sending: netlify/functions/push.mjs (sends right after an office change) and push-cron.mjs (every minute, anything still waiting). Needs Netlify environment variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SECRET, and once in the SQL editor: select public.set_push_secret('<the same PUSH_SECRET>'); Changes made in the SQL editor send nothing.
- Database: teacher_alerts, push_subscriptions, push_config (+ triggers). Needs a GitHub deploy (functions).
- Management Team Salary: part payments ("Pay part now" — the rest stays due until paid); the Dashboard counts the team: Total Monthly Salary, Paid / Left, Net retention, the waiting list, money by method, and a "Management Team" box in Salary by panel.
- Colour-shaded category tabs (Residential, Non-Residential, Management Team…) and dashboard boxes; Attendance log search box fixed (it was very tall).

## Version 180 (SQL 154 — run supabase/teacher-dashboard.sql)
- No notification delay: the database itself calls the website's push function the moment a notification is added (Supabase pg_net, switched on by the SQL); the 1-minute job stays as a backup. The office page also asks within 0.4 s.
- Office notifications on the phone / computer even when Chrome is closed or the admin page is not open: turn on "Alerts" (bottom of the admin menu) once on each device. Executives: website inquiries / trial requests, teacher requests, new teacher sign-ups, recovery classes to approve, delete requests, monthly reports. Junior Admins: monthly reports. Teachers' phones never get office notifications.
- Database: teacher_alerts.audience (exec / staff), push_subscriptions.audience + email, push_config.site_url; set_push_secret(secret, site address).
- Colours follow the admin theme: dashboard second row and money-by-method boxes solid like the first row; category and status tabs (Residential teal, Non-Res. Male gold, Non-Res. Female slate, All / Active / Hold / Inactive / duplicates / delete requests); Points boxes, Levels, Rewards and Leaderboard; Portal Contents groups.
- Sign out (admin menu) glows gold while pressed; Management Team posts shown as a gold crown badge, team cards with a gold edge.

## Version 181
- Admin menu bottom panel (Website, Theme, AI, Sounds, Alerts, Sign out): every item glows gold under the cursor and when pressed.
- Dashboard boxes back to the v179 style (light, theme-coloured), 10–15% deeper; tabs, Points, Portal Contents keep the v180 colours.
- No SQL change (still 154).

## Version 182
- Admin left menu: links only grow taller when the screen has room, and the bottom panel is slimmer — "Board, teachers & reviews" is never hidden behind it.
- Management Portal menu buttons: soft gradient of their group colour (group names unchanged).
- Salary Directory: Residential / Non-Residential tabs get an overview like the Management Team (teachers & students, tuition, salaries, disbursed, total due for the month).
- No SQL change (still 154).

## Version 183
- Enroll Student: no false "Relative needs a different name" while saving (the new student was being compared with itself); same in Assign Students.
- Teacher List: tapping anywhere on a teacher's row opens the same Salary Directory workspace as the name; the pencil still opens Edit.
- Salary Directory: the overview above the first teacher is like the Management Team's — Teachers, Salaries, Disbursed and Due for the month.
- Admin sign-in on phones: a PIN opens the number pad (also on iPhone); a password with letters opens the full keyboard.
- Edit Student: Save closes at once and the change shows straight away, with a floating "Saved ✓ name" message; if something stops the save (class times, medium, same name and number) a floating message says why.
- No SQL change (still 154).

## Version 184
- Salary Directory: Residential, Non-Residential (Male) and Non-Residential (Female) show the same overview as the Management Team, above the first teacher — Teachers, Salaries, Disbursed (for the month) and Total due.
- No SQL change (still 154).

## Version 185
- Edit Student: the student's status history (Active / Hold / Inactive with dates) is shown and can be corrected or removed — these dates decide which months count. A line under "Payment for a month" shows what that month counts (payment and teacher share) and why, e.g. "active from 12 Oct" when a status change was dated after the classes started.
- Student roster: a month that counts nothing now says why ("active from …").
- No SQL change (still 154).

## Version 186 (SQL 156 — run supabase/teacher-dashboard.sql)
- Teacher Support: write the reply, press "Send to teacher", then choose In progress or Solved.
- Calendar everywhere (Book a trial, admin, Teacher Dashboard): a clean white card — month ▾, ‹ ›, S M T W T F S, round days.
- Time box (Book a trial, class times in the admin and the Teacher Dashboard, Notice Maker): type the time or press the clock for rolling hour / minute wheels; AM / PM must be chosen.
- Portal menu buttons: stronger colour gradient.
- Extra responsibilities (Salary Directory → teacher): add a responsibility and its monthly payment (from / until a month); it is added to the salary, dues and disbursement.
- Teacher Dashboard → Salary: each month shows that month's real salary (as the office works it out, with extras), starting with September 2026; the top box shows last month's salary (paid this month). The portal saves these figures when an Executive has it open (table salary_months).
- The office can remove a disbursement from a teacher's dashboard (admin mode → Salary → Remove); a cancel that removes nothing now says so.
- Edit Student: a Hold / Inactive student without a date gets a "Hold from" date — the days before it are paid to the teacher with that month (11 Aug = 11 days) and stay in Total due until paid.
- Sent-back reports: once the same student's report (same name, same month) is sent again, the old one no longer shows; deleting a student (e.g. a double entry) removes its sent-back reports.

## Version 187
- Easier to read: the admin panel and the Teacher Dashboard use a larger standard text size; the smallest labels have a readable minimum; the portal menu keeps every section name whole.
- Extra responsibilities: bigger, clearer text and boxes.
- Calendar: always 6 week rows, so it no longer jumps up or down when you change the month.
- A student moved away (or unassigned) counts for the old teacher only for days the student was really active — a Hold / Inactive date before the move ends it (e.g. Faiha: 11 days of August, nothing for September). Such months appear in the old teacher's dues.
- Disburse: earlier unpaid months are added to the amount and to "Due" / "Due Balance Remaining"; on Disburse each earlier month gets its own record (noted "Due of Aug. paid with Sep. salary") so it is settled.
- No SQL change (still 156).

## Version 188 (SQL 157 — run supabase/teacher-dashboard.sql)
- **Academic Counselor** (new role). Executives add counselors in Management Portal → Overview → **Academic Counseling**: a Gmail, a name, the side (male counselor: male + residential teachers' students; female counselor: female teachers' students) and a first password. Counselors sign in at /admin/login → "Academic Counselor" → Google → password; the first time they must choose their own password. Their dashboard (/counselor): overview, students, teachers, the teachers' monthly reports, shared counseling notes (talks with students / guardians, exam results, problems, feedback, teacher contacts), "My work" and "Office cases". "Send to the office" alerts the Executives, who answer in Academic Counseling. Counselors never see fees, shares, salaries or bank details (the database sends them none).
- Salary Directory roster: a small Active / Hold / Inactive sign beside every name (Hold / Inactive with the date). Hold / Inactive students who count nothing for the month are in a separate, expandable and sortable "Hold - Inactive Students" list.
- Edit Student: "Student pays QIT every month" (green) and "Teacher gets every month" (gold), with "QIT keeps …" under them; the one-month box changes only what the student pays.
- Search: typing in the Salary Directory or Students searches every category / status; the portal's top search box also lists matching teachers and students. Names match without spaces, hyphens or dots ("nurfatima" finds "Nur-Fatima").
- Sign-in on networks that block supabase.co (some mobile data, Egypt): a clear message instead of "This site can't be reached"; with VITE_GOOGLE_CLIENT_ID set in Netlify, Google's own button is used there.
- Office notifications: Alerts opens a panel (turn on, send a test, devices list, iPhone Home Screen steps, Samsung settings); phones are invited to turn alerts on; a device with permission re-registers every time the admin opens.
- Enrolling saves in one quick call and the form is free at once; student edits save in one call. Every admin sees other admins' saves within a few seconds, also where the live connection is blocked.

## Version 189 (SQL 158 — run supabase/teacher-dashboard.sql)
- Office notifications can now be checked from the admin: Alerts → the panel shows a checklist (website notification service and missing Netlify keys, database updated, push secret saved, instant sending with pg_net, your registered devices).
- "Send a test notification" sends straight to your own devices and says exactly what happened (delivered, keys not matching, secret not matching, registration expired, phone service error).

## Version 190
- Admin sign-in: the role picker is one rounded rectangle with the roles stacked — Executive, Junior Admin, Academic Counselor. No SQL change (still 158).

## Version 191
- Edit Student: the "Student pays" and "Teacher gets" boxes line up (same label height, inputs side by side). No SQL change (still 158).

## Version 192
- Phones: every admin, Junior Admin, Teacher Dashboard and Academic Counselor screen checked at phone width — nothing is cut off or pushes the page sideways.
  - Pop-ups (Edit Student, workspace, forms) open as a full-width sheet from the bottom with Save / Cancel always visible; weekly class times stack.
  - Category / status tabs and filter chips slide sideways in one row; figures show two per row; Salary Directory teacher cards and the workspace fit the screen.
  - Table rows become tidy cards (name on its own line, fields two per row); monthly report cards, filters and the portal section menu fit the screen.
  - Teacher Dashboard: the Emergency button is a small round button; the Teacher ID / password box stays on one line.
- The QIT logo (admin top bar, portal, Teacher Dashboard) has a soft shine and a golden edge. No SQL change (still 158).
