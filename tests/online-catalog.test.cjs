const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const B=require('../barcode-utils.js'),{createClient}=require('../online-catalog.js');
const token='test_private_key_01234567890123456789';
const fixture=i=>fs.readFileSync(path.join(__dirname,'fixtures/barcode-list-code'+i+'.html'),'utf8');
test('Разбор реальных ответов российского справочника требует точного штрихкода',async()=>{
 const {parseBarcodeList}=await import('../server/barcode-worker.mjs');
 assert.match(parseBarcodeList(fixture(1),'4607033689408'),/ГАВАЙСКАЯ СМЕСЬ С ТУНЦОМ/i);
 assert.match(parseBarcodeList(fixture(2),'4602358009481'),/ТВОРОГ.*300/i);
 assert.equal(parseBarcodeList(fixture(2),'4602358009498'),null);
 assert.throws(()=>parseBarcodeList('<h1>Captcha</h1>','4607033689408'),/Формат ответа/);
});
test('Сервер защищён ключом, не принимает произвольные адреса и не выдумывает КБЖУ',async()=>{
 const {createWorker}=await import('../server/barcode-worker.mjs');let calls=0,clock=10000;
 const worker=createWorker({now:()=>clock,fetchImpl:async url=>{calls++;assert.ok(url.startsWith('https://barcode-list.ru/'));return new Response(url.includes('4607033689408')?fixture(1):fixture(2));}});
 const request=(suffix,headers={})=>new Request('https://test.workers.dev'+suffix,{headers:{Origin:'https://z54f8pt489-bit.github.io',Authorization:'Bearer '+token,...headers}});
 const env={ACCESS_TOKEN:token};
 assert.equal((await worker.fetch(request('/lookup?barcode=4607033689408',{Authorization:'wrong'}),env)).status,401);
 assert.equal((await worker.fetch(request('/lookup?barcode=4607033689408',{Origin:'https://attacker.test'}),env)).status,403);
 assert.equal((await worker.fetch(request('/lookup?barcode=https://attacker.test'),env)).status,400);assert.equal(calls,0);
 const r=await worker.fetch(request('/lookup?barcode=4607033689408'),env),data=await r.json();
 assert.equal(data.status,'found');assert.equal(data.product.code,'4607033689408');assert.equal(data.product.kcal,null);assert.equal(data.product.protein,null);assert.equal(data.product.nameOnly,true);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://z54f8pt489-bit.github.io');
 await worker.fetch(request('/lookup?barcode=4607033689408'),env);assert.equal(calls,1,'repeat must be cached');
 const rate=await worker.fetch(request('/lookup?barcode=4602358009481'),env);assert.equal(rate.status,429);assert.equal(rate.headers.get('Retry-After'),'10');
 clock+=10001;assert.equal((await worker.fetch(request('/lookup?barcode=4602358009481'),env)).status,200);assert.equal(calls,2);
 const failed=createWorker({fetchImpl:async()=>new Response('Denied',{status:403})});
 assert.equal((await failed.fetch(request('/lookup?barcode=4607033689408'),env)).status,502);
});
test('Подключение сохраняется только после проверки сервера; ключ не передаётся в URL',async()=>{
 const storage=new Map(),requests=[];
 const env={TeloBarcode:B,URL,AbortController,setTimeout,clearTimeout,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async(url,options)=>{
  requests.push({url,options});assert.ok(!url.includes(token));assert.equal(options.headers.Authorization,'Bearer '+token);
  if(url.endsWith('/health'))return new Response(JSON.stringify({status:'ok',source:'Barcode-list.ru'}));
  return new Response(JSON.stringify({status:'found',product:{code:'4607033689408',name:'Гавайская смесь с тунцом',sourceUrl:'https://barcode-list.ru/barcode/RU/test',kcal:999,protein:999}}));
 }};
 const client=createClient(env);assert.equal(client.isConfigured(),false);assert.equal(await client.lookup('4607033689408'),null);
 assert.throws(()=>client.validate({endpoint:'https://attacker.test',token}),/Нужен адрес/);
 await client.configure({endpoint:'https://telo.user.workers.dev',token});assert.equal(client.isConfigured(),true);
 const p=await client.lookup('010460703368940821SERIAL');assert.equal(p.code,'4607033689408');assert.equal(p.kcal,null);assert.equal(p.protein,null,'name-only service must not inject nutrition');
 client.disconnect();assert.equal(client.isConfigured(),false);
 const bad=createClient({...env,fetch:async()=>new Response(JSON.stringify({error:'Invalid token'}),{status:401})});
 await assert.rejects(bad.configure({endpoint:'https://telo.user.workers.dev',token}),/Проверь ключ/);assert.equal(bad.isConfigured(),false);
});
