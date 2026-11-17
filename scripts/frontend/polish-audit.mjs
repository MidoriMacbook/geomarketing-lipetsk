import {readFile,writeFile,mkdir} from 'node:fs/promises';
const source=process.argv[2]||'tests/artifacts/polish-lighthouse';
const target='docs/verification/polish/06';await mkdir(target,{recursive:true});
const rows=[];
for(let run=1;run<=5;run++){
 const report=JSON.parse(await readFile(`${source}/run-${run}.json`,'utf8'));
 if(report.runtimeError)throw Error(`Run ${run}: ${report.runtimeError.message}`);
 const value=id=>report.audits[id]?.numericValue;
 rows.push({run,date:report.fetchTime,url:report.finalDisplayedUrl,lighthouse:report.lighthouseVersion,
  lcp_ms:value('largest-contentful-paint'),cls:value('cumulative-layout-shift'),tbt_ms:value('total-blocking-time'),
  performance:report.categories.performance.score*100,accessibility:report.categories.accessibility.score*100,
  bytes:value('total-byte-weight'),settings:report.configSettings.throttling,
  viewport:report.configSettings.screenEmulation,shifts:report.audits['layout-shifts']?.details,
  failedAccessibility:Object.values(report.audits).filter(a=>a.score===0&&report.categories.accessibility.auditRefs.some(r=>r.id===a.id)).map(a=>({id:a.id,title:a.title,details:a.details}))});
}
await writeFile(`${target}/lighthouse.json`,JSON.stringify(rows,null,2)+'\n');
const table=['# Lighthouse mobile — Render redesign','',`URL: ${rows[0].url}`,'','Пять последовательных запусков, отдельный чистый профиль Chrome, стандартная мобильная сеть Lighthouse, CPU ×4. Это измерения запущенного сервиса, не холодного старта.','',
 '| Прогон | LCP, с | CLS | TBT, мс | Performance | Accessibility | Передано, КиБ |','|---|---:|---:|---:|---:|---:|---:|',
 ...rows.map(r=>`| ${r.run} | ${(r.lcp_ms/1000).toFixed(3)} | ${r.cls.toFixed(6)} | ${r.tbt_ms.toFixed(0)} | ${r.performance} | ${r.accessibility} | ${(r.bytes/1024).toFixed(1)} |`),'',
 'Вес включает ресурсы, переданные во время измерения, в том числе внешние тайлы. Он зависит от загрузившихся тайлов и сетевых ошибок; это не размер исходников.',
 '', 'Перед серией первый запуск завершился HTTP 503 и ошибкой ERRORED_DOCUMENT_REQUEST. Такой ответ не содержит интерфейс приложения и не учитывается как успешный Lighthouse-прогон. После запуска /robots.txt ответил за 0,275 с (404: маршрута robots.txt нет, но запрос достигает приложения).',
 '', 'Подсказка «Сервис просыпается…» появляется в существующей строке статуса, если первое подключение после получения HTML длится более трёх секунд. До ответа HTML или при странице 503 самого Render клиентский код приложения не исполняется.', ''];
await writeFile(`${target}/lighthouse.md`,table.join('\n'));
console.log(rows.map(({run,lcp_ms,cls,tbt_ms,performance,accessibility,bytes})=>({run,lcp_ms,cls,tbt_ms,performance,accessibility,bytes})));
