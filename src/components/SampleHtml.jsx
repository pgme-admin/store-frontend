import { createElement, useMemo } from 'react';

/**
 * Shows a page of a free sample. The server has already sanitised it; this
 * walks the result and rebuilds it from a list of known tags, so nothing is
 * ever set as raw HTML in the page.
 */
const TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'div', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'em', 'strong', 'b', 'i', 'u', 's', 'sub', 'sup', 'small', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'figure', 'figcaption', 'img',
]);
const VOID = new Set(['br', 'hr', 'img']);
const PICTURE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
// The book's own headings sit under the page's title
const HEADING = { h1: 'h2', h2: 'h3', h3: 'h4', h4: 'h5', h5: 'h6', h6: 'h6' };
const TABLE_PARENTS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr']);

const span = (value) => {
  const n = parseInt(value, 10);
  return n > 1 && n <= 50 ? n : undefined;
};

function build(node, key) {
  if (node.nodeType === 3) {
    // Blank text between table rows is not allowed inside a table
    if (TABLE_PARENTS.has(node.parentNode?.localName) && !node.nodeValue.trim()) return null;
    return node.nodeValue;
  }
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  const children = VOID.has(tag) ? [] : Array.from(node.childNodes, build);
  if (!TAGS.has(tag)) return createElement('span', { key }, ...children);
  if (tag === 'img') {
    const src = node.getAttribute('src') || '';
    return PICTURE.test(src) ? <img key={key} src={src} alt={node.getAttribute('alt') || ''} /> : null;
  }
  const props = { key };
  if (tag === 'td' || tag === 'th') {
    props.colSpan = span(node.getAttribute('colspan'));
    props.rowSpan = span(node.getAttribute('rowspan'));
  }
  if (tag === 'ol') {
    const start = parseInt(node.getAttribute('start'), 10);
    if (Number.isFinite(start)) props.start = start;
  }
  const element = createElement(HEADING[tag] || tag, props, ...(children.length ? children : []));
  return tag === 'table' ? <div key={key} className="sample-table" tabIndex={0} role="region" aria-label="Table">{element}</div> : element;
}

export default function SampleHtml({ html }) {
  const content = useMemo(() => {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    return Array.from(doc.body.childNodes, build);
  }, [html]);
  return <div className="sample-reading">{content}</div>;
}
