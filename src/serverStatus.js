// LIVE / OFFLINE indicator for the server that serves this app.
//
// The page itself can load from the offline cache even when the server is
// stopped, so the app checks the server directly, on two channels that no
// service worker can intercept (not even an old version still installed in
// the browser — service workers only handle GET requests, never WebSockets):
//   • Ping: every 2 s a HEAD request to `__health`, never cached. Any HTTP
//     answer = LIVE; a network error or no answer within 1.5 s = OFFLINE.
//   • Watch: an always-open WebSocket to `__ws` (dev server). When the server
//     stops, the OS drops it at once: we show OFFLINE right away, then confirm
//     with a ping. (On Windows a request to a stopped server hangs until its
//     timeout, so without the watch OFFLINE would lag by ~1.5 s.)
// The light blinks once per finished check — each blink is a real result,
// never a timer running on its own.

const INTERVAL_MS = 2000;
const TIMEOUT_MS = 1500;

export function startServerStatus(el) {
  const dot = el.querySelector('.ss-dot');
  const label = el.querySelector('.ss-label');
  let state = 'checking';
  let inFlight = null;
  let timer = null;
  let socket = null;
  let watchOpened = false; // the server has accepted the watch at least once
  let watchUnsupported = false; // e.g. a static host: ping only
  let lastWatchFailure = 0;

  function render(ms, at, reason) {
    el.dataset.state = state;
    const text = state === 'live' ? 'LIVE' : state === 'offline' ? 'OFFLINE' : 'CHECKING';
    if (label.textContent !== text) label.textContent = text;
    const time = at.toLocaleTimeString('en-GB');
    el.title =
      state === 'live'
        ? `Server is running · answered in ${ms} ms · checked ${time}`
        : `Server is not responding${reason ? ` (${reason})` : ''} · checked ${time}`;
    el.setAttribute('aria-label', state === 'live' ? 'Server live' : 'Server offline');
  }

  function blink() {
    dot.classList.remove('blink');
    void dot.offsetWidth; // restart the animation
    dot.classList.add('blink');
  }

  function report(via) {
    window.dispatchEvent(new CustomEvent('serverstatus', { detail: { state, at: Date.now(), via } }));
  }

  function schedule() {
    clearTimeout(timer);
    if (document.visibilityState === 'visible') timer = setTimeout(check, INTERVAL_MS);
  }

  // One check. Calls made while one is running share its result.
  function check() {
    if (inFlight) return inFlight;
    clearTimeout(timer);
    const started = performance.now();
    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), TIMEOUT_MS);
    inFlight = fetch(new URL(`__health?t=${Date.now()}`, location.href), { method: 'HEAD', cache: 'no-store', signal: controller.signal })
      .then(() => ({ live: true }))
      .catch((err) => ({ live: false, reason: err.name === 'AbortError' ? 'no answer' : 'unreachable' }))
      .then(({ live, reason }) => {
        clearTimeout(abort);
        state = live ? 'live' : 'offline';
        render(Math.round(performance.now() - started), new Date(), reason);
        blink();
        report('ping');
        if (live) {
          // The watch failed but the server answers: this server has no
          // watch endpoint (static host). Otherwise (re)connect it.
          if (!watchOpened && lastWatchFailure && Date.now() - lastWatchFailure < 3000) watchUnsupported = true;
          if (!socket && !watchUnsupported) watch();
        }
        inFlight = null;
        schedule();
        return state;
      });
    return inFlight;
  }

  function watch() {
    if (typeof WebSocket === 'undefined') return;
    const url = new URL('__ws', location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    let opened = false;
    try {
      socket = new WebSocket(url);
    } catch {
      socket = null;
      watchUnsupported = true;
      return;
    }
    socket.onopen = () => {
      opened = true;
      watchOpened = true;
    };
    socket.onclose = () => {
      socket = null;
      lastWatchFailure = Date.now();
      if (opened && state === 'live') {
        // The server dropped a connection that was open: it stopped.
        state = 'offline';
        render(0, new Date(), 'connection lost');
        blink();
        report('watch');
      }
      check(); // confirm (flips back to LIVE at once if the server answers)
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
    else clearTimeout(timer);
  });
  window.addEventListener('online', check);
  window.addEventListener('offline', check);

  render(0, new Date());
  check();
  return { check, getState: () => state };
}
