import { FEATURE_ICONS } from '../components/shared/icons';
// Field definitions drive every admin form, so adding a field here adds it
// to the editor automatically.
import { FEATURE_ICON_NAMES } from '../components/shared/icons';

/* ---------- collections ---------- */
export const courseSchema = [
  { name: 'title', label: 'Course title', type: 'text', required: true, half: true },
  { name: 'subtitle', label: 'Small line under the title', type: 'text', half: true, placeholder: 'e.g. Ages 4+ · One-to-one' },
  { name: 'icon', label: 'Icon', type: 'select', options: FEATURE_ICON_NAMES, half: true },
  { name: 'classLength', label: 'Class length', type: 'text', half: true, placeholder: 'e.g. 45–50 minutes per class' },
  {
    name: 'bullets',
    label: 'Course points',
    type: 'list',
    help: 'One per line. "Live One-to-One Classes", "Flexible Schedule" and "Qualified Teachers" are added to every course automatically (edit them under Site content → Courses section).',
  },
  {
    name: 'plans',
    label: 'Plans and monthly prices',
    type: 'plans',
    help: 'Base prices in USD. Prices for specific countries (e.g. BDT for Bangladesh) are set in Pricing & currency. Leave "to" empty for a single price.',
  },
  { name: 'featured', label: 'Show on the home page', type: 'checkbox' },
  { name: 'published', label: 'Published', type: 'checkbox', help: 'Unpublished courses are hidden from the website.' },
];

export const emptyCourse = () => ({
  title: '',
  subtitle: '',
  icon: 'BookOpen',
  classLength: '45–50 minutes per class',
  bullets: [],
  plans: [{ label: '2–3 days a week', min: 40, max: '' }],
  featured: true,
  published: true,
});

export const instructorSchema = [
  { name: 'name', label: 'Full name', type: 'text', required: true, half: true },
  { name: 'title', label: 'Role', type: 'text', half: true, placeholder: 'e.g. Tajweed teacher' },
  { name: 'specialties', label: 'Specialties', type: 'text' },
  { name: 'bio', label: 'Short bio', type: 'textarea', rows: 3 },
  { name: 'experience', label: 'Experience', type: 'text', half: true, placeholder: 'e.g. 10 years teaching' },
  { name: 'languages', label: 'Languages', type: 'text', half: true },
  { name: 'photoUrl', label: 'Photo URL', type: 'text', help: 'Optional. A full https:// link or a file in /public, e.g. /images/teacher.jpg.' },
];
export const emptyInstructor = () => ({ name: '', title: '', specialties: '', bio: '', experience: '', languages: '', photoUrl: '' });

export const testimonialSchema = [
  { name: 'name', label: 'Name', type: 'text', required: true, half: true },
  { name: 'role', label: 'Where they are from', type: 'text', half: true, placeholder: 'e.g. Manchester, UK' },
  { name: 'quote', label: 'Review', type: 'textarea', required: true, rows: 4 },
  { name: 'rating', label: 'Rating', type: 'select', options: [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} stars` })), half: true },
  { name: 'course', label: 'Course', type: 'text', half: true },
  // Shown to visitors who choose বাংলা. Empty = English review text, with the
  // place and course translated automatically where possible.
  {
    name: 'quoteBn',
    label: 'Review in Bangla (বাংলা) — optional',
    type: 'textarea',
    rows: 4,
    lang: 'bn',
    placeholder: 'যেমন: আমার ছেলে এখন নিজেই কুরআন ক্লাসের জন্য অপেক্ষা করে…',
    help: 'Shown on the Bangla website. Leave empty and Bangla visitors see the English review.',
  },
  { name: 'roleBn', label: 'Where they are from, in Bangla — optional', type: 'text', half: true, lang: 'bn', placeholder: 'যেমন: টরন্টো, কানাডা', help: 'Empty = translated automatically for countries and big cities.' },
  { name: 'courseBn', label: 'Course, in Bangla — optional', type: 'text', half: true, lang: 'bn', placeholder: 'যেমন: নূরানী কায়দা', help: 'Empty = translated automatically for known course names.' },
];
export const emptyTestimonial = () => ({ name: '', role: '', quote: '', rating: 5, course: '', quoteBn: '', roleBn: '', courseBn: '' });

export const featureSchema = [
  { name: 'title', label: 'Title', type: 'text', required: true, half: true },
  { name: 'icon', label: 'Icon', type: 'select', options: FEATURE_ICON_NAMES, half: true },
  { name: 'description', label: 'Description', type: 'textarea', required: true, rows: 3 },
];
export const emptyFeature = () => ({ title: '', icon: 'Star', description: '' });

export const boardSchema = [
  { name: 'name', label: 'Full name', type: 'text', required: true, half: true },
  { name: 'role', label: 'Position', type: 'text', required: true, half: true, placeholder: 'e.g. Head of Marketing' },
  {
    name: 'tier',
    label: 'Row on the website',
    type: 'select',
    options: [
      { value: 1, label: 'Row 1: Founders (side by side)' },
      { value: 2, label: 'Row 2: CEO (on its own)' },
      { value: 3, label: 'Row 3: Team (three side by side)' },
    ],
    half: true,
  },
  { name: 'photoUrl', label: 'Photo', type: 'text', half: true, help: 'A file in /public (e.g. /images/board/ceo.webp) or a full https:// link. Square photos work best. Leave empty for the placeholder.' },
  { name: 'whatsapp', label: 'WhatsApp number', type: 'tel', half: true, placeholder: '+880 1XXX-XXXXXX', help: 'With country code. Leave empty to hide.' },
  { name: 'email', label: 'Email', type: 'email', half: true, help: 'Leave empty to hide.' },
  { name: 'bio', label: 'Short profile (optional)', type: 'textarea', rows: 3 },
];
export const emptyBoardMember = () => ({ name: '', role: '', tier: 3, photoUrl: '', whatsapp: '', email: '', bio: '' });

export const faqSchema = [
  { name: 'question', label: 'Question', type: 'text', required: true },
  { name: 'answer', label: 'Answer', type: 'textarea', required: true, rows: 4 },
];
export const emptyFaq = () => ({ question: '', answer: '' });

/* ---------- site sections ---------- */
const image = (name, label) => ({ name, label, type: 'text', help: 'A file in /public (e.g. /images/photo.jpg) or a full https:// link.' });

export const siteSections = [
  {
    key: 'hero',
    label: 'Hero',
    description: 'The first section on the home page, with the photo slideshow on the right.',
    schema: [
      { name: 'badge', label: 'Small badge above the headline', type: 'text' },
      { name: 'headline', label: 'Headline', type: 'textarea', rows: 2, required: true },
      { name: 'highlight', label: 'Highlighted words', type: 'text', help: 'Must appear exactly in the headline. Shown in teal with a gold underline.' },
      { name: 'subheadline', label: 'Subheadline', type: 'textarea', rows: 3 },
      { name: 'primaryCtaLabel', label: 'Main button text', type: 'text', half: true, help: 'Opens the free trial form.' },
      { name: 'secondaryCtaLabel', label: 'Second button text', type: 'text', half: true, help: 'Scrolls to the courses.' },
      { name: 'platforms', label: 'Platforms', type: 'list', help: 'One per line, shown as small chips.' },
      {
        name: 'slideSeconds',
        label: 'Seconds per photo',
        type: 'number',
        half: true,
        help: 'How long each photo stays before sliding to the next (1–10). Default 2.5.',
      },
      {
        name: 'slides',
        label: 'Slideshow photos',
        type: 'list',
        help: 'One image per line, in the order they should play: a file in /public (e.g. /images/hero-qit-1.webp) or a full https:// link. Landscape 3:2 photos fit best.',
      },
      { name: 'notifyTitle', label: 'Notification title (floats over the slideshow)', type: 'text', half: true, help: 'Leave empty to hide the notification.' },
      { name: 'notifyText', label: 'Notification text', type: 'text', half: true },
      { name: 'trustTitle', label: 'Badge title (under the slideshow)', type: 'text', half: true },
      { name: 'trustText', label: 'Badge text', type: 'text' },
    ],
  },
  {
    key: 'stats',
    label: 'Numbers',
    description: 'The three figures under the hero. Leave one empty to hide it.',
    schema: [
      { name: 'students', label: 'Students Taught', type: 'text', half: true },
      { name: 'countries', label: 'Countries', type: 'text', half: true },
      { name: 'rating', label: 'Parent Rating', type: 'text', half: true, placeholder: '4.9/5' },
    ],
  },
  {
    key: 'coursesSection',
    label: 'Courses section',
    description: 'Heading above the course cards, and points added to every course.',
    schema: [
      { name: 'eyebrow', label: 'Small label', type: 'text', half: true },
      { name: 'heading', label: 'Heading', type: 'text', half: true },
      { name: 'intro', label: 'Intro', type: 'textarea', rows: 2 },
      { name: 'standardBullets', label: 'Points on every course card', type: 'list', help: 'One per line.' },
      { name: 'classLengthNote', label: 'Class length note', type: 'textarea', rows: 2, help: 'Shown under the course cards.' },
    ],
  },
  {
    key: 'trial',
    label: 'Trial class',
    description: 'How the free trial works. Also shown inside the trial form.',
    schema: [
      { name: 'eyebrow', label: 'Small label', type: 'text', half: true },
      { name: 'heading', label: 'Heading', type: 'text', half: true },
      { name: 'summary', label: 'One-sentence summary', type: 'text', required: true, help: 'Shown highlighted on the page and at the top of the trial form.' },
      { name: 'body', label: 'More detail', type: 'textarea', rows: 3 },
      { name: 'steps', label: 'Steps', type: 'list', help: 'One per line.' },
      image('imageUrl', 'Photo'),
    ],
  },
  {
    key: 'whyUs',
    label: 'Why us',
    description: 'Heading, the benefit cards and the promise card.',
    schema: [
      { name: 'eyebrow', label: 'Small label', type: 'text', half: true },
      { name: 'heading', label: 'Main heading', type: 'text', half: true },
      { name: 'cards', label: 'Benefit cards', type: 'cards', icons: Object.keys(FEATURE_ICONS), help: 'Each card has an icon, a title and a short text.' },
      { name: 'promiseLabel', label: 'Promise card label', type: 'text', half: true },
      { name: 'promiseQuote', label: 'Promise quote', type: 'textarea', rows: 2 },
      { name: 'promiseSub', label: 'Line under the quote', type: 'text' },
      { name: 'promisePoints', label: 'Promise points', type: 'list', help: 'One per line.' },
      image('imageUrl', 'Promise card background photo'),
    ],
  },
  {
    key: 'videoSection',
    label: 'Videos',
    description: 'Vimeo videos in the top section of the home page, right above the photo slideshow card and the same size. They load only when a visitor presses play, so the page stays fast.',
    schema: [
      { name: 'enabled', label: 'Show the videos', type: 'checkbox' },
      {
        name: 'videos',
        label: 'Vimeo links',
        type: 'list',
        rows: 3,
        help: 'One link per line, e.g. https://vimeo.com/1230464444. More than one link: the videos are shown one under another. The title and poster come from Vimeo.',
      },
    ],
  },
  {
    key: 'facultyTicker',
    label: 'Faculty ticker',
    description: 'The rotating message strip at the top of the home page.',
    schema: [
      { name: 'enabled', label: 'Show the ticker', type: 'checkbox' },
      { name: 'seconds', label: 'Seconds per message', type: 'number', half: true },
      { name: 'messages', label: 'Messages', type: 'list', help: 'One per line. They cycle in this order.' },
    ],
  },
  {
    key: 'globalFaculty',
    label: 'Global instructors',
    description: 'The "Global Expert Instructors" badges shown in the Spotlight and Why us sections.',
    schema: [
      { name: 'title', label: 'Title', type: 'text', half: true },
      { name: 'text', label: 'Short line', type: 'text', half: true },
      { name: 'places', label: 'Badges', type: 'list', help: 'One per line, e.g. Al-Azhar University.' },
    ],
  },
  {
    key: 'featured',
    label: 'Spotlight',
    description: 'The large Spotlight photo between "Why us" and the testimonials.',
    schema: [
      { name: 'enabled', label: 'Show the Spotlight section', type: 'checkbox' },
      { name: 'imageUrl', label: 'Photo', type: 'text', help: 'A file in /public (e.g. /images/spotlight-qit-v2.webp) or a full https:// link. Landscape 3:2 fits best.' },
      { name: 'eyebrow', label: 'Small label', type: 'text', half: true },
      { name: 'ctaLabel', label: 'Button text', type: 'text', half: true, help: 'Opens the free trial form.' },
      { name: 'heading', label: 'Heading', type: 'text' },
      { name: 'text', label: 'Text', type: 'textarea', rows: 2 },
    ],
  },
  {
    key: 'testimonialsSection',
    label: 'Testimonials heading',
    description: 'Edit the reviews themselves under Teachers & reviews.',
    schema: [
      { name: 'eyebrow', label: 'Small label', type: 'text', half: true },
      { name: 'heading', label: 'Heading', type: 'text', half: true },
      { name: 'scrollSeconds', label: 'Scrolling speed (seconds per review)', type: 'number', half: true, help: 'How many seconds each review takes to scroll past (2–60). Higher = slower. Default 8.' },
    ],
  },
  {
    key: 'boardSection',
    label: 'Board heading',
    description: 'Heading of the QIT Board Members section. Edit the members under Teachers & reviews → Board.',
    schema: [
      { name: 'eyebrow', label: 'Small label', type: 'text', half: true },
      { name: 'heading', label: 'Heading', type: 'text', half: true },
      { name: 'intro', label: 'Intro', type: 'textarea', rows: 2 },
    ],
  },
  {
    key: 'faqSection',
    label: 'FAQ heading',
    description: 'Edit the questions under Teachers & reviews → FAQ.',
    schema: [
      { name: 'eyebrow', label: 'Small label', type: 'text', half: true },
      { name: 'heading', label: 'Heading', type: 'text', half: true },
      { name: 'intro', label: 'Intro', type: 'textarea', rows: 2 },
    ],
  },
  {
    key: 'cta',
    label: 'Book trial banner',
    description: 'The dark banner near the bottom of the page. The phone number is added after the text.',
    schema: [
      { name: 'eyebrow', label: 'Small label', type: 'text', half: true },
      { name: 'heading', label: 'Heading', type: 'text', half: true },
      { name: 'body', label: 'Text', type: 'textarea', rows: 2 },
      { name: 'points', label: 'Points', type: 'list', help: 'One per line. Three works best.' },
      image('imageUrl', 'Background photo'),
    ],
  },
  {
    key: 'contact',
    label: 'Contact details',
    description: 'Shown in the footer and on the contact page. The WhatsApp number receives every Buy Course and trial request.',
    schema: [
      { name: 'phone', label: 'Phone', type: 'tel', half: true },
      { name: 'phoneNote', label: 'Note under the phone', type: 'text', half: true, placeholder: 'Call & WhatsApp' },
      { name: 'whatsapp', label: 'WhatsApp number', type: 'tel', half: true, required: true, help: 'With country code, e.g. +8801928616108.' },
      { name: 'email', label: 'Email', type: 'email', half: true },
      { name: 'address', label: 'Office address', type: 'textarea', rows: 2 },
      { name: 'hours', label: 'Hours', type: 'text' },
    ],
  },
  {
    key: 'whatsappMessages',
    label: 'WhatsApp messages',
    description: 'The text that is filled in when a visitor taps a WhatsApp button.',
    schema: [
      {
        name: 'buy',
        label: 'Buy Course message',
        type: 'textarea',
        rows: 3,
        help: '{course}, {plan} and {price} are replaced with the course, the plan the visitor picked and its price.',
      },
      { name: 'general', label: 'General chat message', type: 'textarea', rows: 2, help: 'Used by the green chat button and "Chat on WhatsApp".' },
    ],
  },
  {
    key: 'brand',
    label: 'Brand',
    description: 'Your institute name and the lines used in the header and footer.',
    schema: [
      { name: 'name', label: 'Institute name', type: 'text', required: true, half: true },
      { name: 'shortName', label: 'Short name', type: 'text', half: true },
      { name: 'subtitle', label: 'Line under the name', type: 'text', half: true },
      { name: 'closingLine', label: 'Footer closing line', type: 'text', half: true },
      { name: 'tagline', label: 'Footer description', type: 'textarea', rows: 2 },
    ],
  },
  {
    key: 'about',
    label: 'About page',
    description: 'The story, mission and values on the About us page.',
    schema: [
      { name: 'heading', label: 'Page heading', type: 'text', required: true },
      { name: 'body', label: 'Story', type: 'textarea', rows: 7, help: 'Leave a blank line between paragraphs.' },
      { name: 'mission', label: 'Mission statement', type: 'textarea', rows: 2 },
      { name: 'values', label: 'Values', type: 'list', help: 'One per line.' },
    ],
  },
  {
    key: 'announcement',
    label: 'Announcement bar',
    description: 'A thin bar above the navigation for enrolment news or offers.',
    schema: [
      { name: 'enabled', label: 'Show the announcement bar', type: 'checkbox' },
      { name: 'text', label: 'Message', type: 'text' },
      { name: 'linkLabel', label: 'Link text', type: 'text', half: true },
      { name: 'linkHref', label: 'Link address', type: 'text', half: true, help: 'A page like /courses or a full https:// address.' },
    ],
  },
  {
    key: 'social',
    label: 'Social links',
    description: 'Leave a field empty to hide that icon.',
    schema: [
      { name: 'facebook', label: 'Facebook', type: 'url' },
      { name: 'instagram', label: 'Instagram', type: 'url' },
      { name: 'youtube', label: 'YouTube', type: 'url' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Site-wide options.',
    schema: [
      { name: 'baseCurrency', label: 'Currency of the base course prices', type: 'text', half: true, placeholder: 'USD', help: 'Country-specific prices are set in Pricing & currency.' },
    ],
  },
];
