/* Порция PWA — локальное хранение, без серверной передачи дневника. */
(function () {
  'use strict';
  const DB_NAME = 'porcia-pwa-v1', STORE = 'snapshots';
  let dbPromise;
  const req = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || Error('Ошибка IndexedDB'));
  });
  async function open() {
    if (!('indexedDB' in window)) throw Error('Этот браузер не поддерживает локальный дневник');
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || Error('Не удалось открыть хранилище'));
    });
    return dbPromise;
  }
  function storeTx(db,mode) { return db.transaction(STORE,mode).objectStore(STORE); }
  const val = raw => {
    if (!raw) return null;
    return Nutrition.validate(JSON.parse(raw));
  };
  async function read() {
    const db=await open(), a=storeTx(db,'readonly');
    const [one,two]=await Promise.all([req(a.get('a')), req(a.get('b'))]);
    const states=[],bad=[];
    for(const [slot,raw] of [['a',one],['b',two]]) if(raw){try {states.push({slot,state:val(raw)});}catch(e){bad.push(slot);}}
    states.sort((x,y)=>(y.state.revision||0)-(x.state.revision||0));
    if(!states.length&&bad.length)throw Error('Сохранённый дневник повреждён. Данные не удалены.');
    return {state:states[0]?.state||null,recovered:bad.length>0};
  }
  async function write(next,expected) {
    if(!next.revision) next.revision=1;
    Nutrition.validate(next);
    const db=await open();
    // Compare-and-swap, writes to alternate snapshot in one IndexedDB transaction.
    return new Promise((resolve,reject)=>{
      let resolved=false;
      const tx=db.transaction(STORE,'readwrite');const st=tx.objectStore(STORE);
      let target='a',oldRev=0;
      const results={};
      const one=st.get('a'); const two=st.get('b');
      const fail=e=>{if(!resolved){resolved=true;reject(e instanceof Error?e:Error(String(e)));}try{tx.abort();}catch{}};
      const onread=(name,r)=>{if(r.error){fail(r.error);return;}results[name]=r.result;
        if(!Object.prototype.hasOwnProperty.call(results,'a')||!Object.prototype.hasOwnProperty.call(results,'b'))return;
        let latestSlot=null;
        for(const slot of ['a','b'])if(results[slot]){
          try{const parsed=val(results[slot]);const rev=parsed.revision||0;if(latestSlot===null||rev>oldRev){oldRev=rev;latestSlot=slot;}}
          catch{ /* Preserve unreadable copy */ }
        }
        if(expected!==null&&expected!==undefined&&oldRev!==expected){fail(Error('CONFLICT'));return;}
        if((next.revision||0)<=oldRev){fail(Error('Версия записи должна увеличиваться'));return;}
        target=latestSlot==='a'?'b':'a';
        st.put(JSON.stringify(next),target);
      };
      one.onsuccess=()=>onread('a',one);two.onsuccess=()=>onread('b',two);
      one.onerror=()=>fail(one.error);two.onerror=()=>fail(two.error);
      tx.oncomplete=()=>{if(!resolved){resolved=true;resolve({revision:next.revision});}};
      tx.onerror=()=>{if(!resolved){resolved=true;reject(tx.error||Error('Не удалось сохранить'))}};
      tx.onabort=()=>{if(!resolved){resolved=true;reject(tx.error||Error('Сохранение прервано'))}};
    });
  }
  const fileSelect=(accept) => new Promise(resolve=>{
    const input=document.createElement('input');input.type='file';input.accept=accept;
    input.style.position='fixed';input.style.top='-100px';document.body.appendChild(input);
    const done=file=>{input.remove();resolve(file||null)};
    input.addEventListener('change',()=>done(input.files[0]),{once:true});
    input.addEventListener('cancel',()=>done(null),{once:true});
    input.click();
  });
  const compressPhoto=async file => {
    if(!file) return null;
    const url=URL.createObjectURL(file);
    try {
      const img=new Image();img.src=url;await img.decode();
      const side=900, scale=Math.min(1,side/Math.max(img.width,img.height));
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      return c.toDataURL('image/jpeg',0.72);
    }finally {URL.revokeObjectURL(url)}
  };
  const fetchJSON=async (url,{notFound=false}={})=>{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),14000);
    try{const r=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal});
      if(notFound && r.status===404)return {status:0};
      if(!r.ok){const error=Error('HTTP '+r.status);error.status=r.status;throw error;}return await r.json();}
    finally{clearTimeout(timer);}
  };
  const urlsFor=(path)=>['https://world.openfoodfacts.org','https://ru.openfoodfacts.org'].map(h=>h+path);
  const readNum=(data,key)=>{let x=data?.[key];if(x===null||x===undefined||String(x).trim()==='')return null;x=Number(x);return Number.isFinite(x)&&x>=0?x:null;};
  function product(p,allowIncomplete=false){
    if(!p || typeof p!=='object')return null;
    const n=p.nutriments||{};
    let kcal=readNum(n,'energy-kcal_100g');
    if(kcal===null){const kj=readNum(n,'energy-kj_100g')??readNum(n,'energy_100g');if(kj!==null)kcal=kj/4.184;}
    const protein=readNum(n,'proteins_100g'),fat=readNum(n,'fat_100g'),carbs=readNum(n,'carbohydrates_100g');
    const values=[kcal,protein,fat,carbs];if((!allowIncomplete&&values.some(x=>x===null)) || (kcal!==null&&kcal>1000) || [protein,fat,carbs].some(x=>x!==null&&x>100))return null;
    const code=String(p.code||'').slice(0,14), name=String(p.product_name_ru||p.product_name||p.generic_name_ru||p.generic_name||p.brands||('Товар '+code)).trim().slice(0,160);
    if(!name)return null;
    const rnd=v=>v===null?null:Math.round(v*10)/10;
    return {code,name,brand:String(p.brands||'').slice(0,100),kcal:rnd(kcal),protein:rnd(protein),fat:rnd(fat),carbs:rnd(carbs),incomplete:values.some(v=>v===null),russian:(p.countries_tags||[]).some(c=>/russia|россия/i.test(c))};
  }
  const barcodeCache=new Map();
  async function lookupBarcode(raw){
    const parsed=TeloBarcode.parse(String(raw||''));
    if(!parsed)throw Error('В этом коде не найден корректный номер товара. Покажи штрихкод или Data Matrix на упаковке.');
    const verified=window.TeloVerifiedProducts?.lookup(parsed.code);
    if(verified)return verified;
    const cached=barcodeCache.get(parsed.gtin14);
    if(cached&&cached.until>Date.now())return cached.food;
    let err=null;
    for(const code of TeloBarcode.lookupCodes(parsed.code)){
      const path='/api/v2/product/'+encodeURIComponent(code)+'.json?lc=ru&fields=code,product_name,product_name_ru,generic_name_ru,brands,nutriments,countries_tags';
      let answered=false;
      for(const u of urlsFor(path))try{
        const data=await fetchJSON(u,{notFound:true});
        if(data.status===0){answered=true;break;}
        if(!data.product)throw Error('Каталог вернул неполную карточку');
        if(data.product.code&&!TeloBarcode.sameProduct(String(data.product.code),parsed.code))throw Error('Каталог вернул другой номер товара');
        const food=product({...data.product,code:parsed.code},true);
        if(!food)throw Error('В карточке товара некорректные данные');
        barcodeCache.set(parsed.gtin14,{food,until:Date.now()+300000});
        return food;
      }catch(e){
        if(e.status===429)throw Error('Каталог временно ограничил частые запросы. Попробуй снова через минуту.');
        err=e;
      }
      if(!answered)throw Error('Не удалось связаться с каталогом продуктов. Попробуй позже'+(err?.message?' ('+err.message+')':'')+'.');
    }
    // A missing product is a normal lookup result, not an internet connection error.
    barcodeCache.set(parsed.gtin14,{food:null,until:Date.now()+60000});
    return null;
  }
  async function searchFoods(term){
    const q=String(term||'').trim().slice(0,100);if(q.length<2)throw Error('Введи хотя бы 2 буквы');
    const verified=window.TeloVerifiedProducts?.search(q)||[];
    const path='/cgi/search.pl?search_terms='+encodeURIComponent(q)+'&search_simple=1&action=process&json=1&page_size=40&fields=code,product_name,product_name_ru,brands,nutriments,countries_tags';
    let data=null,err;
    for(const u of urlsFor(path))try{data=await fetchJSON(u);break;}catch(e){err=e;}
    if(!data){if(verified.length)return verified;throw Error('Интернет-база недоступна: '+(err?.message||'нет ответа'));}
    const codes=new Set(verified.map(f=>TeloBarcode.parse(f.code)?.gtin14||f.code)), results=[...verified];
    for(const p of data.products||[]){const f=product(p,true);const identity=f&&(TeloBarcode.parse(f.code)?.gtin14||f.code);if(!f||codes.has(identity)||[f.kcal,f.protein,f.fat,f.carbs].every(v=>v===null))continue;codes.add(identity);results.push(f);}
    results.sort((a,b)=>Number(b.russian)-Number(a.russian));return results.slice(0,24);
  }
  async function exportFile(p){
    const text=String(p.content||'');if(text.length>60000000)throw Error('Файл слишком большой');
    const filename=String(p.name||'porcia-backup.json').replace(/[^a-zA-Z0-9._-]/g,'_');
    const blob=new Blob([text],{type:filename.endsWith('.json')?'application/json':'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
    return {saved:true};
  }
  window.porciaCall=async function(action,payload={}){
    switch(action){
      case 'read':return await read();
      case 'write':return await write(payload.state,payload.expected);
      case 'lookupBarcode':return await lookupBarcode(payload.code);
      case 'searchFoods':return await searchFoods(payload.term);
      case 'confirm':return confirm(String(payload.message||''));
      case 'export':return exportFile(payload);
      case 'import':{const file=await fileSelect('.json,application/json');if(!file)return null;if(file.size>60000000)throw Error('Файл слишком большой');return Nutrition.validate(JSON.parse(await file.text()));}
      case 'photo':return await compressPhoto(await fileSelect('image/*'));
      case 'copy':{const s=String(payload.text||'');if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(s);return true;}throw Error('Браузер не разрешил копирование');}
      default:throw Error('Неизвестное действие: '+action);
    }
  };
  if('serviceWorker' in navigator && window.isSecureContext)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
