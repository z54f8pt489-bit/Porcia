/* Deploy separately as a Cloudflare Worker. No diary data or provider credentials are accepted. */
const ORIGIN='https://z54f8pt489-bit.github.io';
const SOURCE='https://barcode-list.ru';
function valid(code){
 if(!/^(?:\d{8}|\d{12,14})$/.test(code)||/^0+$/.test(code))return false;
 let sum=0;for(let i=code.length-2,w=3;i>=0;i--,w=4-w)sum+=Number(code[i])*w;
 return (10-sum%10)%10===Number(code.at(-1));
}
const text=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(parseInt(n,16),0x10ffff))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff))).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g,s=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '}[s])).replace(/\s+/g,' ').trim();
export function parseBarcodeList(html,code){
 // Only the results table; never execute source scripts or use a fuzzy barcode match.
 const table=/<table\b[^>]*class=["'][^"']*\brandomBarcodes\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/i.exec(html);
 if(table)for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>text(m[1]));
  const i=cells.findIndex(c=>c.replace(/\s/g,'')===code);
  if(i>=0&&cells[i+1]&&cells[i+1].length>=2)return cells[i+1].slice(0,200);
 }
 if(!table&&!/Результаты поиска|ничего не найден|не найдено|нет результатов/i.test(text(html)))throw Error('Формат ответа справочника изменился');
 return null;
}
export function createWorker({fetchImpl=globalThis.fetch,now=()=>Date.now(),edgeCache=globalThis.caches?.default}={}){
 let nextRequestAt=0;const memory=new Map(),inflight=new Map();
 return {async fetch(request,env={}){
  const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN||ORIGIN;
  const cors={'Access-Control-Allow-Origin':allowed,'Vary':'Origin','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization','Access-Control-Expose-Headers':'Retry-After','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
  const reply=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...cors,...extra}});
  if(origin&&origin!==allowed)return reply({error:'Этот источник запроса не разрешён'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='GET')return reply({error:'Разрешён только поиск'},405);
  const token=String(env.ACCESS_TOKEN||'');
  if(!/^[A-Za-z0-9_-]{24,200}$/.test(token))return reply({error:'На сервере нужно задать ACCESS_TOKEN длиной не менее 24 символов'},503);
  if(request.headers.get('Authorization')!=='Bearer '+token)return reply({error:'Неверный ключ подключения'},401);
  const url=new URL(request.url);
  if(url.pathname==='/health')return reply({status:'ok',source:'Barcode-list.ru',nutrition:false});
  if(url.pathname!=='/lookup')return reply({error:'Неизвестный адрес'},404);
  const code=url.searchParams.get('barcode')||'';
  if(!valid(code))return reply({error:'Некорректный штрихкод'},400);
  const cacheKey=new Request(url.origin+'/cached-products/'+code);
  const cached=memory.get(code);
  if(cached&&cached.until>now())return reply(cached.data);
  if(edgeCache){try{const hit=await edgeCache.match(cacheKey);if(hit)return reply(await hit.json());}catch{}}
  if(inflight.has(code)){try{return reply(await inflight.get(code));}catch{return reply({error:'Российский справочник временно недоступен'},502);}}
  // The source asks for a 10-second crawl interval. Cache repeated products for one day.
  if(now()<nextRequestAt)return reply({error:'Справочник просит интервал между новыми поисками. Повтори через несколько секунд.'},429,{'Retry-After':String(Math.max(1,Math.ceil((nextRequestAt-now())/1000)))});
  nextRequestAt=now()+10000;
  const lookup=(async()=>{
   const sourceUrl=SOURCE+'/barcode/RU/%D0%9F%D0%BE%D0%B8%D1%81%D0%BA.htm?barcode='+encodeURIComponent(code);
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
   try{
    const r=await fetchImpl(sourceUrl,{signal:controller.signal,redirect:'error',headers:{'Accept':'text/html','User-Agent':'TeloNutrition/2.0.11 (personal product lookup)'}});
    if(!r.ok)throw Error('Справочник ответил HTTP '+r.status);
    if(Number(r.headers.get('Content-Length')||0)>1500000)throw Error('Ответ слишком большой');
    const html=await r.text();if(html.length>1500000)throw Error('Ответ слишком большой');
    const name=parseBarcodeList(html,code);
    const data=name?{status:'found',product:{code,name,brand:'',kcal:null,protein:null,fat:null,carbs:null,incomplete:true,source:'Barcode-list.ru — название по штрихкоду',sourceUrl,nameOnly:true}}:{status:'not_found'};
    memory.set(code,{data,until:now()+86400000});
    if(memory.size>150)memory.delete(memory.keys().next().value);
    if(edgeCache){try{await edgeCache.put(cacheKey,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=86400'}}));}catch{}}
    return data;
   }finally{clearTimeout(timer);}
  })();inflight.set(code,lookup);
  try{return reply(await lookup);}catch{return reply({error:'Не удалось получить ответ российского справочника. Попробуй позже.'},502);}finally{inflight.delete(code);}
 }};
}
export default createWorker();
