// No browser globals are accessed at import. Every transaction uses saved -> field
// lock order so deletion cannot race a queued checklist write into an orphan.
export const FIELD_CHECK_KEY = 'geomarketing.field-checks.v1';
export const SAVED_LOCK = 'geomarketing.saved.v1.write';
export const FIELD_LOCK = `${FIELD_CHECK_KEY}.write`;
export const FIELD_CHECK_LIMIT = 48;
export const FIELD_CHECK_SIZE = 65536; // UTF-16 code units, as localStorage strings.
const failureCodes = new Set(['invalid','unsupported','unavailable','no_locks','membership','missing','limit','conflict']);

function failure(code, raw) {
  const error = new Error(code); error.code = code;
  if (raw !== undefined) error.raw = raw;
  return error;
}
const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 160;
function validDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, , zone] = match;
  const leap = +year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0);
  const days = [31, leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  return +month >= 1 && +month <= 12 && +day >= 1 && +day <= days[+month - 1] && +hour < 24 && +minute < 60 && +second < 60 && (zone === 'Z' || (+zone.slice(1,3) < 24 && +zone.slice(4) < 60));
}
function storageFor(options) {
  try {
    const storage = Object.hasOwn(options, 'storage') ? options.storage : globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function') throw Error();
    return storage;
  } catch { throw failure('unavailable'); }
}
function locksFor(options) {
  try {
    const locks = Object.hasOwn(options, 'locks') ? options.locks : globalThis.navigator?.locks;
    if (!locks || typeof locks.request !== 'function') throw failure('no_locks');
    return locks;
  } catch (error) { if (failureCodes.has(error.code)) throw error; throw failure('unavailable'); }
}
export function fieldChecksWritable(options = {}) {
  try { locksFor(options); storageFor(options); return true; } catch { return false; }
}
function getRaw(storage) {
  try { return storage.getItem(FIELD_CHECK_KEY); } catch { throw failure('unavailable'); }
}
function decode(raw) {
  if (raw === null) return [];
  if (typeof raw !== 'string' || raw.length > FIELD_CHECK_SIZE) throw failure('invalid', raw);
  let envelope;
  try { envelope = JSON.parse(raw); } catch { throw failure('invalid', raw); }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw failure('invalid', raw);
  if (Number.isInteger(envelope.schema_version) && envelope.schema_version > 1) throw failure('unsupported', raw);
  const records = envelope.records;
  if (envelope.schema_version !== 1 || !Array.isArray(records) || records.length > FIELD_CHECK_LIMIT) throw failure('invalid', raw);
  const ids = new Set();
  for (const record of records) {
    if (!record || typeof record !== 'object' || !validId(record.place_id) || ids.has(record.place_id) || !Array.isArray(record.checks) || record.checks.length !== 7 || Array.from(record.checks).some(value => typeof value !== 'boolean') || !validDate(record.updated_at)) throw failure('invalid', raw);
    ids.add(record.place_id);
  }
  return records.map(record => ({ place_id: record.place_id, checks: [...record.checks], updated_at: record.updated_at }));
}
export function readFieldChecks(options = {}) { return decode(getRaw(storageFor(options))); }

function membership(options, id, expected) {
  let saved;
  try { saved = options.readSaved?.(); } catch { throw failure('membership'); }
  // The caller injects its existing strict saved.v1 reader. No weaker parallel
  // interpretation or migration of the saved schema is introduced here.
  if (!Array.isArray(saved) || saved.some(item => !item || typeof item.id !== 'string')) throw failure('membership');
  if (saved.some(item => item.id === id) !== expected) throw failure(expected ? 'missing' : 'membership');
}
async function transaction(options, callback) {
  const storage = storageFor(options), locks = locksFor(options);
  try {
    const underSaved = () => locks.request(FIELD_LOCK, () => callback(storage));
    return await (options.savedLockHeld ? underSaved() : locks.request(SAVED_LOCK, underSaved));
  } catch (error) { if (failureCodes.has(error.code)) throw error; throw failure('unavailable'); }
}
function write(storage, records) {
  const raw = JSON.stringify({schema_version:1, records});
  if (raw.length > FIELD_CHECK_SIZE) throw failure('invalid');
  try { storage.setItem(FIELD_CHECK_KEY, raw); } catch { throw failure('unavailable'); }
}
export async function setFieldCheck(placeId, index, checked, options = {}) {
  if (!validId(placeId) || !Number.isInteger(index) || index < 0 || index >= 7 || typeof checked !== 'boolean') throw failure('invalid');
  return transaction(options, storage => {
    membership(options, placeId, true);
    const records = decode(getRaw(storage));
    let record = records.find(item => item.place_id === placeId);
    if (!record) {
      if (records.length >= FIELD_CHECK_LIMIT) throw failure('limit');
      record = {place_id:placeId, checks:Array(7).fill(false), updated_at:''}; records.push(record);
    }
    const updatedAt = options.now ? options.now() : new Date().toISOString();
    if (!validDate(updatedAt)) throw failure('invalid');
    record.checks[index] = checked; record.updated_at = updatedAt;
    write(storage, records); return records;
  });
}
export async function deleteFieldChecks(placeId, options = {}) {
  if (!validId(placeId)) throw failure('invalid');
  return transaction(options, storage => {
    membership(options, placeId, false);
    const records = decode(getRaw(storage)), next = records.filter(item => item.place_id !== placeId);
    if (next.length === records.length) return records;
    if (next.length) write(storage, next);
    else { try { storage.removeItem(FIELD_CHECK_KEY); } catch { throw failure('unavailable'); } }
    return next;
  });
}
export async function resetFieldChecks(expectedRaw, options = {}) {
  return transaction(options, storage => {
    const raw = getRaw(storage);
    if (raw !== expectedRaw || raw === null) throw failure('conflict');
    // Even an oversized future envelope belongs to a newer application. Inspect
    // its version only during explicit recovery; normal reads stay size bounded.
    try {
      const envelope = JSON.parse(raw);
      if (envelope && typeof envelope.schema_version === 'number' && envelope.schema_version > 1) throw failure('unsupported', raw);
    } catch (error) { if (error.code === 'unsupported') throw error; }
    try { decode(raw); } catch (error) {
      if (error.code !== 'invalid') throw error;
      try { storage.removeItem(FIELD_CHECK_KEY); } catch { throw failure('unavailable'); }
      return;
    }
    throw failure('conflict');
  });
}
