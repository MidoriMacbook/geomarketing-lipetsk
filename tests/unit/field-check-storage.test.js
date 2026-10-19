import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_CHECK_KEY, SAVED_LOCK, FIELD_LOCK, readFieldChecks, setFieldCheck, deleteFieldChecks, resetFieldChecks } from '../../static/js/field-check-storage.js';

const date = '2026-10-19T10:00:00.000Z';
const record = (id='a') => ({place_id:id, checks:Array(7).fill(false), updated_at:date});
const raw = records => JSON.stringify({schema_version:1, records});
const code = expected => error => error.code === expected;
function fixture() {
  const values=new Map([['unrelated','keep']]), queues=new Map(), calls=[];
  let members=['a','b','__proto__','constructor'];
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const locks={request(name,callback){calls.push(name);const run=(queues.get(name)||Promise.resolve()).then(callback);queues.set(name,run.catch(()=>{}));return run;}};
  return {values,storage,locks,calls,readSaved:()=>members.map(id=>({id})), now:()=>date, members:next=>{members=next;}};
}
test('isolated envelope and prototype-safe IDs roundtrip without modifying other keys', async()=>{
  const f=fixture(); assert.equal(FIELD_CHECK_KEY,'geomarketing.field-checks.v1');assert.deepEqual(readFieldChecks(f),[]);
  await setFieldCheck('__proto__',0,true,f);await setFieldCheck('constructor',6,true,f);
  assert.deepEqual(readFieldChecks(f).map(r=>r.place_id),['__proto__','constructor']);assert.equal(f.values.get('unrelated'),'keep');
  assert.deepEqual(f.calls.slice(0,2),[SAVED_LOCK,FIELD_LOCK]);
});
test('concurrent tabs latest-read preserves same-place and different-place checks',async()=>{
  const f=fixture();await Promise.all([setFieldCheck('a',0,true,f),setFieldCheck('a',1,true,f),setFieldCheck('b',3,true,f)]);
  assert.deepEqual(readFieldChecks(f).map(r=>r.checks),[[true,true,false,false,false,false,false],[false,false,false,true,false,false,false]]);
});
test('invalid inputs never mutate storage',async()=>{
  for(const args of [['a',-1,true],['a',7,true],['a',0,'true'],['a',0,1],['x'.repeat(161),0,true],['',0,true],['a',0.5,true]]){
    const f=fixture();await assert.rejects(setFieldCheck(...args,f),code('invalid'));assert.equal(f.values.has(FIELD_CHECK_KEY),false);
  }
});
test('strict schema boundaries and malformed values preserve complete raw',async()=>{
  const variants=['null','[]','{broken',raw(Array.from({length:49},(_,i)=>record(String(i)))),raw([record('a'),record('a')]),raw([record('x'.repeat(161))]),raw([{...record(),checks:[true]}]),raw([{...record(),checks:[true,false,false,false,false,false,null]}]),raw([{...record(),checks:Array(7).fill(1)}]),raw([{...record(),updated_at:'2026-02-30T10:00:00Z'}]),raw([{...record(),updated_at:'2026-10-19T24:00:00Z'}]),raw([{...record(),updated_at:'2026-10-19T10:61:00Z'}]),'x'.repeat(65537)];
  for(const value of variants){const f=fixture();f.values.set(FIELD_CHECK_KEY,value);assert.throws(()=>readFieldChecks(f),error=>error.code==='invalid'&&error.raw===value);await assert.rejects(setFieldCheck('a',0,true,f),code('invalid'));assert.equal(f.values.get(FIELD_CHECK_KEY),value);assert.equal(f.values.get('unrelated'),'keep');}
});
test('48 records and exactly 65536 UTF16 characters accepted; 65537 rejected',()=>{
  const f=fixture();f.values.set(FIELD_CHECK_KEY,raw(Array.from({length:48},(_,i)=>record(String(i)))));assert.equal(readFieldChecks(f).length,48);
  const minimal=raw([]);f.values.set(FIELD_CHECK_KEY,minimal+' '.repeat(65536-minimal.length));assert.deepEqual(readFieldChecks(f),[]);
  f.values.set(FIELD_CHECK_KEY,f.values.get(FIELD_CHECK_KEY)+' ');assert.throws(()=>readFieldChecks(f),code('invalid'));
});
test('future schema remains readable only by newer app and cannot be reset',async()=>{
  const f=fixture(),value='{"schema_version":2,"records":[]}';f.values.set(FIELD_CHECK_KEY,value);
  assert.throws(()=>readFieldChecks(f),code('unsupported'));await assert.rejects(setFieldCheck('a',0,true,f),code('unsupported'));await assert.rejects(resetFieldChecks(value,f),code('unsupported'));assert.equal(f.values.get(FIELD_CHECK_KEY),value);
  const oversized=value+' '.repeat(65536);f.values.set(FIELD_CHECK_KEY,oversized);await assert.rejects(resetFieldChecks(oversized,f),code('unsupported'));assert.equal(f.values.get(FIELD_CHECK_KEY),oversized);
});
test('read-only without locks, blocked access, lock rejection, quota and remove errors',async()=>{
  const f=fixture();await setFieldCheck('a',0,true,f);const original=f.values.get(FIELD_CHECK_KEY);
  assert.equal(readFieldChecks({...f,locks:null}).length,1);await assert.rejects(setFieldCheck('a',1,true,{...f,locks:null}),code('no_locks'));
  await assert.rejects(setFieldCheck('a',1,true,{...f,locks:{request(){throw Error('denied');}}}),code('unavailable'));
  await assert.rejects(setFieldCheck('a',1,true,{...f,locks:{request(){throw new DOMException('denied','SecurityError');}}}),code('unavailable'));
  await assert.rejects(setFieldCheck('a',1,true,{...f,storage:{...f.storage,setItem(){throw Error('quota');}}}),code('unavailable'));
  assert.throws(()=>readFieldChecks({...f,storage:{getItem(){throw Error('blocked');}}}),code('unavailable'));
  f.members([]);await assert.rejects(deleteFieldChecks('a',{...f,storage:{...f.storage,removeItem(){throw Error('denied');}}}),code('unavailable'));assert.equal(f.values.get(FIELD_CHECK_KEY),original);
});
test('queued writer revalidates membership only after acquiring saved lock',async()=>{
  const f=fixture();let release,entered;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  const deletion=f.locks.request(SAVED_LOCK,async()=>{entered();await gate;f.members(['b']);});await started;
  const pending=setFieldCheck('a',0,true,f);release();await deletion;await assert.rejects(pending,code('missing'));assert.deepEqual(readFieldChecks(f),[]);
});
test('record limit blocks new entries but allows existing edits; failed cleanup preserves all raw',async()=>{
  const f=fixture(),records=Array.from({length:48},(_,i)=>record(String(i)));f.members(records.map(r=>r.place_id).concat('new'));f.values.set(FIELD_CHECK_KEY,raw(records));
  await setFieldCheck('0',0,true,f);const prior=f.values.get(FIELD_CHECK_KEY);await assert.rejects(setFieldCheck('new',0,true,f),code('limit'));assert.equal(f.values.get(FIELD_CHECK_KEY),prior);
  f.members([]);await assert.rejects(deleteFieldChecks('0',{...f,storage:{...f.storage,setItem(){throw Error('quota');}}}),code('unavailable'));assert.equal(f.values.get(FIELD_CHECK_KEY),prior);
});
test('membership is read within saved lock and missing/corrupt/unreadable saved rejects late writes',async()=>{
  const f=fixture();await setFieldCheck('a',0,true,f);const original=f.values.get(FIELD_CHECK_KEY);
  f.members([]);await assert.rejects(setFieldCheck('a',1,true,f),code('missing'));assert.equal(f.values.get(FIELD_CHECK_KEY),original);
  for(const readSaved of [()=>{throw Error('invalid');},()=>{throw Error('blocked');},()=>null]){await assert.rejects(setFieldCheck('a',1,true,{...f,readSaved}),code('membership'));assert.equal(f.values.get(FIELD_CHECK_KEY),original);}
  f.members(['a']);await assert.rejects(deleteFieldChecks('a',f),code('membership'));f.members([]);await deleteFieldChecks('a',f);assert.equal(f.values.has(FIELD_CHECK_KEY),false);
});
test('saved deletion serializes cleanup before queued late write',async()=>{
  const f=fixture();await setFieldCheck('a',0,true,f);
  const deletion=f.locks.request(SAVED_LOCK,async()=>{f.members(['b']);await deleteFieldChecks('a',{...f,savedLockHeld:true});});
  const late=setFieldCheck('a',1,true,f);await deletion;await assert.rejects(late,code('missing'));assert.deepEqual(readFieldChecks(f),[]);
});
test('recovery only clears exact still-corrupt raw; changed and valid values survive',async()=>{
  const f=fixture();f.values.set(FIELD_CHECK_KEY,'{broken');await resetFieldChecks('{broken',f);assert.equal(f.values.has(FIELD_CHECK_KEY),false);
  for(const latest of ['{different',raw([record()])]){f.values.set(FIELD_CHECK_KEY,latest);await assert.rejects(resetFieldChecks('{broken',f),code('conflict'));assert.equal(f.values.get(FIELD_CHECK_KEY),latest);}
  await assert.rejects(resetFieldChecks(f.values.get(FIELD_CHECK_KEY),f),code('conflict'));
});
test('import does not touch throwing browser global getters; lazy access reports unavailable',async()=>{
  const local=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),nav=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  try{Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked');}});Object.defineProperty(globalThis,'navigator',{configurable:true,get(){throw Error('blocked');}});const mod=await import('../../static/js/field-check-storage.js?throwing-getters');assert.throws(()=>mod.readFieldChecks(),code('unavailable'));await assert.rejects(mod.setFieldCheck('a',0,true),code('unavailable'));}
  finally{if(local)Object.defineProperty(globalThis,'localStorage',local);else delete globalThis.localStorage;if(nav)Object.defineProperty(globalThis,'navigator',nav);else delete globalThis.navigator;}
});
