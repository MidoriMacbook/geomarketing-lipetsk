import { $, closeDialog, coords, initDialogMotion, node, openDialog } from './ui.js';
import { competitorFacts, competitorSourceLink, describeCompetitor } from './competitor-card.js';
import { projectPoint } from './map-analysis.js';
import { CORRECTION_LIMIT, createCorrectionDraft } from './corrections-state.js';

export function initCorrections({ fetchResult, onResult, onMap, isAvailable, onEnter }) {
  const panel = $('corrections-panel');
  const toggle = $('corrections-toggle');
  const dialog = $('correction-remove-dialog');
  let data = null;
  let draft = createCorrectionDraft();
  let mode = null;
  let removal = null;
  let timer, request;
  let revision = 0;
  let phase = 'idle';
  let message = '';

  function render({ redraw = false } = {}) {
    const context = data?.correction_context;
    const canRemoveOsm = Boolean(context?.base_competitors.some(point => point.id && !draft.value.removed.includes(point.id)));
    const busy = phase === 'loading';
    const available = Boolean(data && isAvailable() && data.source !== 'demo');
    toggle.disabled = !available;
    toggle.setAttribute('aria-expanded', String(Boolean(mode)));
    toggle.title = data?.source === 'demo' ? 'Поправки доступны для расчётов по данным OpenStreetMap' : '';
    panel.hidden = !mode && !message && !draft.count && !draft.pending;
    $('corrections-controls').hidden = !mode;
    $('correction-add').disabled = !available || !context;
    $('correction-remove').disabled = !available || (!canRemoveOsm && !draft.value.added.length);
    $('correction-add').setAttribute('aria-pressed', String(mode === 'add'));
    $('correction-remove').setAttribute('aria-pressed', String(mode === 'remove'));
    $('correction-undo').disabled = !available || !draft.canUndo;
    $('correction-reset').disabled = !available || !draft.count;
    $('correction-retry').hidden = phase !== 'error';
    $('correction-retry').disabled = !available;
    $('correction-loading').dataset.active = String(busy);
    $('correction-help').textContent = !context ? 'Загружаем исходных конкурентов.'
      : mode === 'remove' ? 'Нажмите на метку конкурента, которого хотите убрать.'
      : 'Нажмите на свободное место внутри контура области.';
    $('correction-id-note').hidden = !mode || !context || canRemoveOsm
      || !context.base_competitors.some(point => !point.id);
    $('correction-count').textContent = `Добавлено вручную: ${draft.value.added.length} · убрано: ${draft.value.removed.length}`;
    $('correction-status').textContent = message;
    $('correction-status').dataset.error = String(phase === 'error');
    if (redraw) onMap({ mode, draft: draft.value, pending: draft.pending });
  }

  function cancel() {
    clearTimeout(timer);
    timer = null;
    ++revision;
    request?.abort();
    request = null;
  }

  async function calculate() {
    if (!isAvailable()) return;
    cancel();
    const currentRevision = revision;
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 100000);
    phase = 'loading';
    message = data.correction_context ? 'Пересчитываем с поправками…' : 'Загружаем список конкурентов…';
    render();
    try {
      const response = await fetchResult(draft.value, controller.signal);
      if (currentRevision !== revision) return;
      if (response.status !== 'success' || !response.analysis_id || !response.correction_context?.applied) {
        throw new Error('Ответ не содержит применённых поправок');
      }
      const wasEditing = Boolean(data.correction_context);
      data = response;
      draft.apply(response.correction_context.applied);
      phase = 'idle';
      message = wasEditing ? 'Расчёт обновлён.' : '';
      if (mode === 'remove' && !draft.value.added.length
        && !response.correction_context.base_competitors.some(p => p.id && !draft.value.removed.includes(p.id))) {
        mode = 'add';
      }
      onResult(response);
      render({ redraw: true });
    } catch (error) {
      if (currentRevision !== revision) return;
      phase = 'error';
      const notice = draft.pending
        ? 'Поправки не применены. На карте черновик, в карточках прежние оценки.'
        : 'Показан предыдущий расчёт.';
      message = `${error.user ? error.message + ' ' : ''}${notice}`;
      render();
    } finally {
      clearTimeout(timeout);
      if (request === controller) request = null;
    }
  }

  function afterEdit() {
    cancel();
    phase = 'idle';
    message = draft.pending ? 'Ожидаем пересчёт…' : '';
    render({ redraw: true });
    if (draft.pending) timer = setTimeout(calculate, 500);
  }

  function setMode(value) {
    if (!isAvailable()) return;
    const entering = value && !mode;
    mode = value;
    if (!mode && phase === 'idle' && !draft.pending) message = '';
    if (entering) onEnter();
    render({ redraw: true });
    if (entering && matchMedia('(max-width: 600px)').matches) {
      const header = $('site-header').getBoundingClientRect().bottom;
      const top = panel.getBoundingClientRect().top;
      if (top > header + 80) {
        window.scrollBy({ top: top - header - 12, behavior: 'instant' });
        panel.focus({ preventScroll: true });
      }
    }
    if (mode && !data.correction_context && phase !== 'loading') calculate();
  }

  function roomForCorrection() {
    if (draft.count < CORRECTION_LIMIT) return true;
    message = 'Можно внести не больше 50 поправок.';
    render();
    return false;
  }

  initDialogMotion(dialog);
  toggle.addEventListener('click', () => setMode(mode ? null : 'add'));
  $('correction-add').addEventListener('click', () => setMode('add'));
  $('correction-remove').addEventListener('click', () => setMode('remove'));
  $('correction-done').addEventListener('click', () => {
    setMode(null);
    toggle.focus({ preventScroll: true });
  });
  $('correction-undo').addEventListener('click', () => { if (draft.undo()) afterEdit(); });
  $('correction-reset').addEventListener('click', () => { if (draft.reset()) afterEdit(); });
  $('correction-retry').addEventListener('click', calculate);
  $('correction-remove-cancel').addEventListener('click', () => closeDialog(dialog));
  $('correction-remove-confirm').addEventListener('click', () => {
    const point = removal;
    const id = $('correction-remove-choices').querySelector('input:checked')?.value || point?.id;
    if (removal) removal.opener = null;
    closeDialog(dialog);
    if (point && (point.manual ? draft.removeAdded(id) : draft.remove(id))) {
      $('correction-remove').focus({ preventScroll: true });
      afterEdit();
    }
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    const opener = removal?.opener;
    removal = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });

  return {
    setAnalysis(next, { saved = false, keepMode = false } = {}) {
      cancel();
      data = next;
      const applied = next?.correction_context?.applied;
      if (keepMode && applied) {
        draft.apply(applied);
      } else {
        draft = createCorrectionDraft(applied, saved ? applied : { added: [], removed: [] });
      }
      if (!keepMode) mode = null;
      phase = 'idle';
      message = '';
      render({ redraw: true });
    },
    render,
    markSaved(value) { if (value) draft.markSaved(value); },
    get hasUnsaved() { return draft.unsaved; },
    get applied() { return data?.correction_context ? draft.applied : undefined; },
    get value() { return data?.correction_context ? draft.value : undefined; },
    get editing() { return Boolean(mode); },
    suspend() { cancel(); phase = 'idle'; message = draft.pending ? 'Поправки ожидают пересчёта.' : ''; },
    mapTap(point) {
      if (!mode) return false;
      if (mode !== 'add' || !data?.correction_context || !isAvailable()) return true;
      if (Math.hypot(...projectPoint(point, data.center)) > data.half_m) {
        message = 'Добавьте конкурента внутри области расчёта.';
        render();
      } else if (roomForCorrection()) {
        const id = crypto.randomUUID();
        if (draft.add({ id, lat: point.lat, lng: point.lng })) afterEdit();
      }
      return true;
    },
    removePoint(point, colocated, opener) {
      if (mode !== 'remove' || !point.id || !isAvailable() || dialog.open) return;
      const manual = point.source === 'manual';
      if (!manual && !roomForCorrection()) return;
      removal = { id: point.id, manual, opener };
      const choice = colocated.length > 1;
      const sourceLink = $('correction-remove-source');
      const showSource = details => {
        const link = competitorSourceLink(details, 'correction-competitor-link');
        sourceLink.replaceChildren(...(link ? [link] : []));
        sourceLink.hidden = !link;
      };
      $('correction-remove-choice-label').hidden = !choice;
      $('correction-remove-summary').hidden = choice;
      const describe = details => {
        const description = node('span', 'correction-competitor-description');
        description.append(node('strong', '', details.title), competitorFacts(details));
        return description;
      };
      const details = describeCompetitor(point, data.source);
      showSource(details);
      $('correction-remove-choices').replaceChildren(...(choice ? colocated.map((candidate, index) => {
        const candidateDetails = describeCompetitor(candidate, data.source);
        const option = node('label', 'correction-competitor-option');
        const input = node('input');
        input.type = 'radio';
        input.name = 'correction-remove-choice';
        input.value = candidate.id;
        input.checked = index === 0;
        input.addEventListener('change', () => showSource(candidateDetails));
        option.append(input, describe(candidateDetails));
        return option;
      }) : []));
      $('correction-remove-summary').replaceChildren(...(choice ? [] : [describe(details)]));
      $('correction-remove-point').textContent = coords(point);
      openDialog(dialog);
      $('correction-remove-cancel').focus();
    },
  };
}
