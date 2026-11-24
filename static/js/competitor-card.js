import { button, node } from './ui.js';

const OSM_ID = /^(node|way|relation):([1-9][0-9]{0,19})$/;
const text = value => typeof value === 'string' ? value.trim() : '';

export function describeCompetitor(point, source) {
  if (point.source === 'manual') return { title: 'Конкурент', note: 'Добавлен вручную' };
  if (source === 'demo' || point.source === 'demo') return { title: 'Конкурент', note: 'Демонстрационные данные' };
  if (point.source !== 'osm' && source !== 'osm' && source !== 'cache') return { title: 'Конкурент' };

  const match = typeof point.id === 'string' ? OSM_ID.exec(point.id) : null;
  const valid = match && match[0] === point.id;
  const address = text(point.address);
  return {
    title: text(point.name) || (valid ? `Без названия (OSM ${match[1]} ${match[2]})` : 'Конкурент OpenStreetMap'),
    address,
    note: address || 'Адрес не указан в OSM',
    id: valid ? point.id : null,
    href: valid ? `https://www.openstreetmap.org/${match[1]}/${match[2]}` : null,
  };
}

export function competitorFacts(details) {
  const facts = node('span', 'competitor-facts');
  if (details.note) facts.append(node('span', 'competitor-note', details.note));
  if (details.id) facts.append(node('span', 'competitor-id', `OSM ID: ${details.id}`));
  return facts;
}

export function competitorSourceLink(details, className) {
  if (!details.href) return null;
  const link = node('a', className, 'Открыть в OSM');
  link.href = details.href;
  link.tabIndex = 0;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

export function createCompetitorPopup(map) {
  const container = map.getContainer();
  const mobile = matchMedia('(max-width:600px)');
  let popup = null, opener = null;

  function close(restoreFocus = false) {
    const marker = opener;
    if (popup) map.closePopup(popup);
    if (restoreFocus) {
      const element = marker?.getElement();
      const target = element?.isConnected && map.getBounds().contains(marker.getLatLng()) ? element : container;
      target.focus({ preventScroll: true });
    }
  }

  function placeMobileCard() {
    if (!popup?.isOpen() || !mobile.matches) return;
    const bounds = container.getBoundingClientRect();
    const headerEnd = document.getElementById('site-header').getBoundingClientRect().bottom;
    const sheet = document.getElementById('recommendations');
    const viewport = window.visualViewport;
    const viewportEnd = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight);
    const sheetTop = sheet.dataset.sheetActive === 'true' ? sheet.getBoundingClientRect().top : viewportEnd;
    const top = Math.max(bounds.top, headerEnd, viewport?.offsetTop ?? 0) + 12;
    const bottom = Math.min(bounds.bottom, viewportEnd, sheetTop) - 12;
    const element = popup.getElement();
    element.style.setProperty('--competitor-top', `${top - bounds.top}px`);
    element.style.setProperty('--competitor-height', `${Math.max(96, bottom - top)}px`);
    if (element.parentElement !== container) container.append(element);
  }

  function open(marker, details, colocated) {
    close();
    opener = marker;
    const card = node('section', 'competitor-card');
    card.setAttribute('aria-labelledby', 'competitor-card-title');
    const heading = node('div', 'competitor-card-heading');
    const title = node('h3', '', colocated.length ? 'Конкуренты в этой точке' : details.title);
    title.id = 'competitor-card-title';
    const dismiss = button('×', 'competitor-card-close', () => close(true));
    dismiss.setAttribute('aria-label', 'Закрыть карточку');
    heading.append(title, dismiss);
    card.append(heading);
    for (const record of [details, ...colocated]) {
      const entry = node('div', 'competitor-card-entry');
      if (colocated.length) entry.append(node('h4', '', record.title));
      entry.append(competitorFacts(record));
      const link = competitorSourceLink(record, 'competitor-card-link');
      if (link) entry.append(link);
      card.append(entry);
    }
    const next = L.popup({
      className: 'competitor-popup',
      closeButton: false,
      closeOnEscapeKey: false,
      autoPan: !mobile.matches,
      autoPanPadding: [12, 12],
      offset: [0, -10],
    }).setLatLng(marker.getLatLng()).setContent(card);
    popup = next;
    marker.getElement()?.setAttribute('aria-expanded', 'true');
    next.once('remove', () => {
      marker.getElement()?.setAttribute('aria-expanded', 'false');
      popup = null;
      opener = null;
    });
    next.openOn(map);
    placeMobileCard();
    dismiss.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !popup?.isOpen() || event.target.closest?.('dialog[open]')) return;
    const focused = container.contains(document.activeElement);
    if (focused) event.preventDefault();
    close(focused);
  });
  mobile.addEventListener('change', () => close());
  window.addEventListener('scroll', placeMobileCard, { passive: true });
  window.addEventListener('resize', placeMobileCard);
  document.addEventListener('gm:sheet-settled', placeMobileCard);
  return { open, close };
}
