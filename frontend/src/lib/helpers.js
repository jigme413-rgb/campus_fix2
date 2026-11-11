/** View helpers, available in every EJS template through app.locals. */

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const date = (d) => (d ? dateFormat.format(new Date(d)) : '');
const dateTime = (d) => (d ? dateTimeFormat.format(new Date(d)) : '');

/** "5 min ago", "3 h ago", "2 days ago", then a plain date after a week. */
function timeAgo(d) {
  if (!d) return '';
  const seconds = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86400) return plural(Math.floor(seconds / 86400), 'day') + ' ago';
  return date(d);
}

/** Hours (number) -> "3.5 h" or "2.1 days" */
function duration(hours) {
  if (hours === null || hours === undefined) return 'no data yet';
  if (hours < 1) return 'under an hour';
  return hours < 48 ? `${hours} h` : `${(hours / 24).toFixed(1)} days`;
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

const STATUSES = ['Pending', 'Assigned', 'In Progress', 'Completed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const ROLE_LABELS = { student: 'Student', staff: 'College staff', maintenance: 'Maintenance', admin: 'Administrator' };
const roleLabel = (r) => ROLE_LABELS[r] || r;

/** Builds "/path?a=1&b=2", dropping empty values. Overrides win over the base query. */
function qs(path, query = {}, overrides = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...overrides })) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  const s = params.toString();
  return s ? `${path}?${s}` : path;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : null;
}

const firstName = (name) => String(name || '').split(' ')[0];

/*
 * Icons come from Phosphor (@phosphor-icons/core, one family, "regular" weight).
 * The SVG files are read once at startup and inlined into the HTML, so pages make
 * no icon-font or sprite requests - important on slow campus connections.
 */
const fs = require('fs');
const path = require('path');

const PHOSPHOR_DIR = path.join(__dirname, '..', '..', 'node_modules', '@phosphor-icons', 'core', 'assets', 'regular');
const ICON_NAMES = {
  wrench: 'wrench', plus: 'plus', list: 'list-bullets', bell: 'bell', chart: 'chart-bar', users: 'users',
  tag: 'tag', pin: 'map-pin', clock: 'clock', user: 'user', check: 'check', alert: 'warning-circle',
  info: 'info', search: 'magnifying-glass', edit: 'pencil-simple', trash: 'trash', arrowLeft: 'arrow-left',
  arrowRight: 'arrow-right', logout: 'sign-out', contrast: 'circle-half', bolt: 'lightning', drop: 'drop',
  wifi: 'wifi-high', chair: 'chair', bed: 'bed', broom: 'broom', box: 'package', activity: 'pulse',
  hammer: 'hammer', buildings: 'buildings', clipboard: 'clipboard-text', checkCircle: 'check-circle',
};

const ICON_BODIES = Object.fromEntries(
  Object.entries(ICON_NAMES).map(([key, file]) => {
    const svg = fs.readFileSync(path.join(PHOSPHOR_DIR, `${file}.svg`), 'utf8');
    return [key, svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')];
  })
);

function icon(name, cls = '') {
  const body = ICON_BODIES[name] || ICON_BODIES.box;
  return `<svg class="icon ${cls}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;
}

const CATEGORY_ICONS = {
  Electrical: 'bolt', Plumbing: 'drop', 'Wi-Fi': 'wifi', Furniture: 'chair', Hostel: 'bed', Cleaning: 'broom',
};
const categoryIcon = (name) => CATEGORY_ICONS[name] || 'box';

module.exports = {
  date, dateTime, timeAgo, duration, slug, qs, plural, safeNext, firstName,
  icon, categoryIcon, roleLabel, STATUSES, PRIORITIES,
};
