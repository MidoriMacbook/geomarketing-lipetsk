import { $, button, node } from './ui.js';

const levels = { low: 'низкая', medium: 'средняя', high: 'высокая' };

export function dataReliabilityBlock(data) {
  const assessment = data?.data_reliability;
  const level = typeof assessment?.level === 'string' && Object.hasOwn(levels, assessment.level)
    ? assessment.level : null;
  const reason = typeof assessment?.reason === 'string' && assessment.reason.length <= 500
    ? assessment.reason.trim() : '';
  const block = node('div', 'data-reliability');
  block.dataset.level = level || 'unknown';
  const text = node('p');
  text.append(node('strong', '', `Надёжность данных: ${levels[level] || 'нет сведений'}.`));
  if (reason) text.append(` ${reason}`);
  if (level === 'low' && assessment.code === 'few_city_objects') {
    text.append(' Проверьте на месте или добавьте поправки');
  }
  block.append(text);

  if (data.source !== 'demo') {
    const toggle = $('corrections-toggle');
    const action = button('Мои поправки', 'data-reliability-action', () => {
      toggle.dispatchEvent(new Event('gm:open-corrections'));
    });
    action.dataset.openCorrections = '';
    action.setAttribute('aria-controls', 'corrections-panel');
    action.disabled = toggle.disabled;
    block.append(action);
  }
  return block;
}

export function updateReliabilityActions(available) {
  document.querySelectorAll('[data-open-corrections]').forEach(action => { action.disabled = !available; });
}
