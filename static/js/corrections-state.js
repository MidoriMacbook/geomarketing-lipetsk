export const CORRECTION_LIMIT = 50;

const empty = () => ({ added: [], removed: [] });
const key = value => JSON.stringify({
  added: value.added.map(({ id, lat, lng }) => [id, lat, lng]).sort((a, b) => a[0].localeCompare(b[0])),
  removed: [...value.removed].sort(),
});

export function createCorrectionDraft(applied = empty(), saved = applied) {
  let value = applied;
  const history = [];
  function change(next) {
    if (next.added.length + next.removed.length > CORRECTION_LIMIT || key(value) === key(next)) return false;
    history.push(value);
    value = next;
    return true;
  }
  return {
    get value() { return value; },
    get applied() { return applied; },
    get canUndo() { return history.length > 0; },
    get pending() { return key(value) !== key(applied); },
    get unsaved() { return key(value) !== key(saved); },
    get count() { return value.added.length + value.removed.length; },
    add(point) { return change({ added: [...value.added, point], removed: value.removed }); },
    removeAdded(id) {
      return change({ added: value.added.filter(point => point.id !== id), removed: value.removed });
    },
    remove(id) {
      return !value.removed.includes(id) && change({ added: value.added, removed: [...value.removed, id] });
    },
    reset() { return change(empty()); },
    undo() {
      if (!history.length) return false;
      value = history.pop();
      return true;
    },
    apply(next) { applied = next; },
    markSaved(next) { saved = next; },
  };
}
