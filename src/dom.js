export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && k !== 'list') {
      try {
        el[k] = v;
      } catch {
        el.setAttribute(k, v);
      }
    } else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    el.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function svg(tag, attrs = {}, children = []) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    el.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    el.appendChild(child);
  }
  return el;
}
