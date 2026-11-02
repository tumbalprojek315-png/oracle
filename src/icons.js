// One stroke-icon set (24px grid, 1.8 stroke, round caps) for the whole app.
const S = 'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"';

const PATHS = {
  close: `<path d="M18 6 6 18M6 6l12 12" ${S}/>`,
  plus: `<path d="M12 5v14M5 12h14" ${S} stroke-width="2.2"/>`,
  check: `<path d="m5 12.5 4.5 4.5L19 7.5" ${S} stroke-width="2.2"/>`,
  edit: `<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" ${S}/>`,
  trash: `<path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2m3 0-.8 12a2 2 0 0 1-2 1.9H8.8a2 2 0 0 1-2-1.9L6 7" ${S}/>`,
  download: `<path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19.5h14" ${S}/>`,
  upload: `<path d="M12 15.5V4.5m0 0L16.5 9M12 4.5 7.5 9M5 19.5h14" ${S}/>`,
  share: `<circle cx="18" cy="5.5" r="2.5" ${S}/><circle cx="6" cy="12" r="2.5" ${S}/><circle cx="18" cy="18.5" r="2.5" ${S}/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" ${S}/>`,
  search: `<circle cx="11" cy="11" r="6.5" ${S}/><path d="m20 20-4.2-4.2" ${S}/>`,
  back: `<path d="M20 12H4m0 0 6-6m-6 6 6 6" ${S}/>`,
  backspace: `<path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6.5-7L9 5Z" ${S}/><path d="m12.5 9.5 5 5m0-5-5 5" ${S}/>`,
  settings: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" ${S}/><circle cx="12" cy="12" r="3" ${S}/>`,
  select: `<rect x="3.5" y="3.5" width="17" height="17" rx="5" ${S}/><path d="m8 12.2 2.8 2.8L16 9.5" ${S}/>`,
  home: `<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19v-8.5Z" ${S}/>`,
  list: `<path d="M9 6.5h11M9 12h11M9 17.5h11" ${S}/><circle cx="4.5" cy="6.5" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1.2" fill="currentColor"/>`,
  chart: `<path d="M12 3a9 9 0 1 0 9 9h-9V3Z" ${S}/><path d="M15.5 3.7A9 9 0 0 1 20.3 8.5H15.5V3.7Z" ${S}/>`,
  sync: `<path d="M20 11a8 8 0 0 0-14.6-4.5M4 13a8 8 0 0 0 14.6 4.5" ${S}/><path d="M5 3v4h4M19 21v-4h-4" ${S}/>`,
  calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="4" ${S}/><path d="M3.5 10h17M8 3v4M16 3v4" ${S}/>`,
  clock: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="M12 7.5V12l3 2" ${S}/>`,
  pin: `<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" ${S}/><circle cx="12" cy="10" r="2.3" ${S}/>`,
  note: `<path d="M5 4.5h14v15H5z" ${S} stroke-linejoin="round"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" ${S}/>`,
  card: `<rect x="2.5" y="5.5" width="19" height="13" rx="3.5" ${S}/><path d="M2.5 10h19M6.5 15h3" ${S}/>`,
  file: `<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3Z" ${S}/><path d="M13.5 3v5.5H19" ${S}/>`,
  table: `<rect x="3.5" y="4" width="17" height="16" rx="3.5" ${S}/><path d="M3.5 9.5h17M3.5 15h17M9.5 9.5V20" ${S}/>`,
  phone: `<rect x="6.5" y="2.5" width="11" height="19" rx="3" ${S}/><path d="M10.5 18.5h3" ${S}/>`,
  laptop: `<rect x="4.5" y="5" width="15" height="10.5" rx="2" ${S}/><path d="M2.5 19h19" ${S}/>`,
  arrowRight: `<path d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" ${S}/>`,
  chevronLeft: `<path d="m14.5 6-6 6 6 6" ${S}/>`,
  chevronRight: `<path d="m9.5 6 6 6-6 6" ${S}/>`,
  chevronDown: `<path d="m6 9.5 6 6 6-6" ${S}/>`,
  undo: `<path d="M9 14 4 9l5-5" ${S}/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" ${S}/>`,
  target: `<circle cx="12" cy="12" r="8.5" ${S}/><circle cx="12" cy="12" r="4.5" ${S}/><circle cx="12" cy="12" r="1" fill="currentColor"/>`,
  moon: `<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" ${S}/>`,
  empty: `<circle cx="12" cy="12" r="8.5" ${S} stroke-dasharray="2.5 3"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`,
  user: `<circle cx="12" cy="8.5" r="4" ${S}/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" ${S}/>`,
  text: `<path d="M4 7V5h11v2M9.5 5v14M7 19h5" ${S}/><path d="M14 13v-1.5h6V13M17 11.5V19M15.5 19h3" ${S}/>`,
  globe: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5S14.3 18.1 12 20.5C9.7 18.1 8.6 15.3 8.6 12S9.7 5.9 12 3.5Z" ${S}/>`,
  bell: `<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z" ${S}/><path d="M10 20.5a2.2 2.2 0 0 0 4 0" ${S}/>`,
  info: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="M12 11v5.5" ${S}/><circle cx="12" cy="7.8" r="1" fill="currentColor"/>`,
  mail: `<rect x="3.5" y="5.5" width="17" height="13" rx="3" ${S}/><path d="m4.5 7.5 7.5 5.5 7.5-5.5" ${S}/>`,
  sun: `<circle cx="12" cy="12" r="4" ${S}/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" ${S}/>`,
  // category glyphs
  food: `<path d="M7 3v8m-2.5-8v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17.5 21V3c-2.2 1-3.5 3.5-3.5 7v3.5h3.5" ${S}/>`,
  cart: `<path d="M3 4h2.5l2.3 11h10.4l2-8H6.6" ${S}/><circle cx="9.5" cy="19.5" r="1.4" ${S}/><circle cx="17" cy="19.5" r="1.4" ${S}/>`,
  cup: `<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8Z" ${S}/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M9 3.5v2M12 3.5v2" ${S}/>`,
  bus: `<rect x="4.5" y="3.5" width="15" height="14" rx="4" ${S}/><path d="M4.5 11h15M8 20.5v-3M16 20.5v-3" ${S}/><circle cx="8.5" cy="14.3" r=".9" fill="currentColor"/><circle cx="15.5" cy="14.3" r=".9" fill="currentColor"/>`,
  box: `<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" ${S}/><path d="m4 7.5 8 4.5 8-4.5M12 12v9" ${S}/>`,
  bag: `<path d="M5.5 8h13l-1 12.5h-11L5.5 8Z" ${S}/><path d="M9 10V7a3 3 0 0 1 6 0v3" ${S}/>`,
  heart: `<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10Z" ${S}/>`,
  spark: `<path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21M6 6l2.8 2.8M15.2 15.2 18 18M6 18l2.8-2.8M15.2 8.8 18 6" ${S}/>`,
  book: `<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v14H6.5a2 2 0 0 0-2 2v-14Z" ${S}/><path d="M4.5 19.5a2 2 0 0 0 2 2H19v-4" ${S}/>`,
  bolt: `<path d="M13 2.5 5 13.5h6.5L10.5 21.5l8.5-11h-6.5L13 2.5Z" ${S}/>`,
  repeat: `<path d="M17 3.5 20.5 7 17 10.5" ${S}/><path d="M3.5 12V10a3 3 0 0 1 3-3h14M7 20.5 3.5 17 7 13.5" ${S}/><path d="M20.5 12v2a3 3 0 0 1-3 3h-14" ${S}/>`,
  shield: `<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" ${S}/>`,
  tag: `<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0L3.5 12.2Z" ${S}/><circle cx="8" cy="8" r="1.4" fill="currentColor"/>`,
};

export function icon(name, size = 20) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', String(size));
  s.setAttribute('height', String(size));
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'ic');
  s.innerHTML = PATHS[name] || PATHS.tag;
  return s;
}
