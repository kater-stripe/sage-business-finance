window.parent?.postMessage({type: 'dory-preview-ready'}, '*');

// Indicates this was the result of Dory's popup authentication mechanism prompting instant closure of the page
// so the page can then be properly viewed in the iframe.
if (new URLSearchParams(window.location.search).get('u') === '1') {
  window.close();
}

const startSelector = () => {
  if (document.getElementById('dory-selector-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'dory-selector-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;';
  document.body.appendChild(overlay);

  const highlight = document.createElement('div');
  highlight.id = 'dory-selector-highlight';
  highlight.style.cssText =
    'position:fixed;pointer-events:none;z-index:2147483646;border:2px dashed rgb(47, 107, 222);background:rgba(91, 154, 255, 0.08)der-radius:4px;transition:all 60ms ease;display:none;';
  document.body.appendChild(highlight);

  let currentTarget: Element | null = null;

  const onMove = (e: MouseEvent) => {
    overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = 'auto';

    if (!el || el === overlay || el === highlight) {
      highlight.style.display = 'none';
      currentTarget = null;
      return;
    }

    currentTarget = el;
    const rect = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.top = `${rect.top}px`;
    highlight.style.left = `${rect.left}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
  };

  const cleanup = () => {
    overlay.removeEventListener('mousemove', onMove);
    overlay.removeEventListener('click', onClick);
    overlay.remove();
    highlight.remove();
  };

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (currentTarget) {
      window.parent?.postMessage(
        {type: 'dory-selector-result', html: currentTarget.outerHTML},
        '*'
      );
    }

    cleanup();
  };

  overlay.addEventListener('mousemove', onMove);
  overlay.addEventListener('click', onClick);

  const stopHandler = (msg: MessageEvent) => {
    if (msg.data?.type === 'dory-selector-stop') {
      cleanup();
      window.removeEventListener('message', stopHandler);
    }
  };
  window.addEventListener('message', stopHandler);
};

window.addEventListener('message', (event: MessageEvent) => {
  switch (event.data?.type) {
    case 'dory-forward':
      window.history.forward();
      break;
    case 'dory-backward':
      window.history.back();
      break;
    case 'dory-selector-start':
      startSelector();
      break;
    case 'dory-selector-stop': {
      const overlay = document.getElementById('dory-selector-overlay');
      const highlight = document.getElementById('dory-selector-highlight');
      overlay?.remove();
      highlight?.remove();
      break;
    }
  }
});

const LEVELS = ['log', 'error', 'warn', 'info', 'debug', 'trace'] as const;

type Level = (typeof LEVELS)[number];

const serialize = (arg: unknown) => {
  if (typeof arg === 'string') {
    return arg;
  }

  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
};

const queue: Array<{level: string; timestamp: string; message: string}> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const flush = async () => {
  if (queue.length === 0) {
    return;
  }

  const entries = queue.splice(0);

  await fetch('/api/client-logs', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({entries}),
  }).catch(() => {});
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 100);
};

LEVELS.forEach((level: Level) => {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    original(...args);

    queue.push({level, timestamp: new Date().toISOString(), message: args.map(serialize).join(' ')});

    scheduleFlush();
  };
});