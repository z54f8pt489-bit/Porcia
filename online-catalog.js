/* Optional private lookup service. Configuration stays on this device and outside diary backups. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports={createClient:factory};
 else root.TeloOnlineCatalog=factory(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(env){
 'use strict';const KEY='telo-online-catalog-v1';
 function validate(config){
  let url;try{url=new URL(String(config?.endpoint||'').trim());}catch{throw Error('Введи HTTPS-адрес сервера Cloudflare Workers');}
  if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password||url.port||url.search||url.hash||!['','/'].includes(url.pathname))throw Error('Нужен адрес вида https://имя.поддомен.workers.dev без пути и параметров');
  const token=String(config?.token||'').trim();if(!/^[A-Za-z0-9_-]{24,200}$/.test(token))throw Error('Ключ должен содержать 24–200 латинских букв, цифр, дефисов или подчёркиваний');
  return {endpoint:url.origin,token};
 }
 function config(){try{return validate(JSON.parse(env.localStorage.getItem(KEY)||'null'));}catch{return null;}}
 async function request(c,path){
  const controller=new env.AbortController(),timer=env.setTimeout(()=>controller.abort(),14000);
  try{
   const r=await env.fetch(c.endpoint+path,{headers:{Authorization:'Bearer '+c.token,Accept:'application/json'},credentials:'omit',signal:controller.signal});
   let data;try{data=await r.json();}catch{throw Error('Сервер вернул непонятный ответ');}
   if(!r.ok)throw Error(r.status===401?'Проверь ключ подключения':r.status===429?'Справочник просит паузу. Повтори поиск через '+(r.headers.get('Retry-After')||'10')+' с':String(data.error||'Дополнительный справочник недоступен').slice(0,240));
   return data;
  }catch(e){if(e.name==='AbortError')throw Error('Сервер поиска не ответил вовремя');throw e;}
  finally{env.clearTimeout(timer);}
 }
 async function configure(values){
  const c=validate(values),data=await request(c,'/health');
  if(data.status!=='ok'||data.source!=='Barcode-list.ru')throw Error('Этот адрес не подтвердил подключение справочника');
  env.localStorage.setItem(KEY,JSON.stringify(c));return true;
 }
 async function lookup(raw){
  const c=config();if(!c)return null;
  const parsed=env.TeloBarcode.parse(String(raw||''));if(!parsed)throw Error('Некорректный штрихкод');
  const data=await request(c,'/lookup?barcode='+encodeURIComponent(parsed.code));
  if(data.status==='not_found')return null;
  const p=data.product;
  if(data.status!=='found'||!p||!env.TeloBarcode.sameProduct(String(p.code||''),parsed.code)||typeof p.name!=='string'||!p.name.trim())throw Error('Справочник вернул другую или неполную карточку');
  let sourceUrl;try{sourceUrl=new URL(p.sourceUrl);if(sourceUrl.origin!=='https://barcode-list.ru')throw Error();}catch{throw Error('Не подтверждён источник названия');}
  // This source has no nutrition data. Never accept invented macros from the name lookup.
  return {code:parsed.code,name:p.name.slice(0,200),brand:'',kcal:null,protein:null,fat:null,carbs:null,incomplete:true,nameOnly:true,source:'Barcode-list.ru — название по штрихкоду',sourceUrl:sourceUrl.href};
 }
 const esc=v=>String(v||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 function openSettings(){
  const c=config();env.showDialog('Российский онлайн-справочник',`<form id="online-catalog-form"><p class="note">Поиск названий в Barcode-list.ru после отсутствия товара в основной базе. Этот источник не содержит КБЖУ. Для подключения нужен отдельно размещённый сервер.</p><label class="field"><span>Адрес сервера Cloudflare Workers</span><input type="url" name="endpoint" required value="${esc(c?.endpoint)}" placeholder="https://имя.поддомен.workers.dev" autocapitalize="off" autocomplete="off"></label><label class="field"><span>Ключ подключения к своему серверу</span><input type="password" name="token" required value="${esc(c?.token)}" minlength="24" maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false"></label><p class="micro">Настройки сохраняются только на этом устройстве. Дневник и фото в этот сервис не передаются.</p><p class="error" role="alert"></p><div class="form-actions"><button type="button" class="secondary" data-action="catalog-disconnect">Отключить</button><button type="submit" class="primary">Проверить и подключить</button></div></form>`);
 }
 return {validate,configure,lookup,openSettings,isConfigured:()=>!!config(),disconnect:()=>env.localStorage.removeItem(KEY)};
});
