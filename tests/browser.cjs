const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const qa=path.join(process.env.RUNNER_TEMP||path.dirname(root),'telo-food-coach-qa');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',locale:'ru-RU',timezoneId:'Europe/Moscow'});
  await context.addInitScript(()=>{localStorage.setItem('telo-motivation-last-shown-v1',String(Date.now()));});
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());let file=decodeURIComponent(url.pathname).replace(/^\//,'');if(!file)file='index.html';
   if(url.hostname!=='127.0.0.1')return route.abort();
   const target=path.resolve(root,file);if(!target.startsWith(root+'/'))return route.abort();
   if(fs.existsSync(target)&&fs.statSync(target).isFile())return route.fulfill({status:200,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(target)});
   return route.fulfill({status:404,body:'Not found'});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(15000);
  await page.goto('http://127.0.0.1/',{waitUntil:'networkidle'});
  await page.waitForSelector('[aria-label="Обратная связь по питанию за день"]');
  assert.equal(await page.locator('[aria-label="Обратная связь по питанию за день"] h2').innerText(),'Для подсказки нужна запись');
  await page.evaluate(async()=>{
   const next=Nutrition.initial();next.goals={kcal:1800,protein:160,fat:80};
   const today=Nutrition.dateKey(),start=TeloFoodCoach.weekStart(today,-1);
   const make=(name,kcal,meal,date)=>({id:Nutrition.uid(),name,kcal,protein:40,fat:20,carbs:50,grams:null,estimated:true,photo:null,note:'',meal,date});
   next.entries=[make('Курица с овощами',600,'Обед',today),make('Гречка',500,'Ужин',today),make('Творог с яблоком',450,'Завтрак',today),make('Круассан',200,'Перекус',today)];
   for(let i=0;i<5;i++){const date=Nutrition.shiftDate(start,i);next.entries.push(make('Печенье',600,'Завтрак',date),make('Булочка',400,'Перекус',date),make('Курица',600,'Обед',date));}
   for(const x of next.entries)next.days[x.date]={water:0,complete:false};
   await commit(next);
  });
  const daily=page.locator('[aria-label="Обратная связь по питанию за день"]');
  assert.equal(await daily.locator('h2').innerText(),'Красавчик, так держать!');
  assert.equal(await page.locator('.fc-entry-hint').count(),4);
  assert.ok(!(await daily.innerText()).includes('Сегодня выпечка и сладости заняли'));
  const countBefore=await page.locator('.fc-entry-hint').count();
  await daily.locator('[data-action="food-coach-recipe"]').first().click();
  await page.locator('#editor').waitFor({state:'visible'});
  assert.ok((await page.locator('#dialog-body').innerText()).includes('Ингредиенты на одну порцию'));
  assert.ok((await page.locator('#dialog-body').innerText()).includes('Как приготовить'));
  await page.locator('#close-dialog').click();
  assert.equal(await page.locator('.fc-entry-hint').count(),countBefore);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  fs.mkdirSync(qa,{recursive:true});
  await page.screenshot({path:path.join(qa,'daily-mobile.png'),fullPage:true});
  await page.locator('[data-tab="stats"]').click();
  const weekly=page.locator('[aria-label="Обратная связь по питанию за неделю"]');
  await weekly.waitFor();assert.ok((await weekly.innerText()).includes('Выпечка и сладости занимали'));
  assert.ok((await weekly.innerText()).includes('Пропуски не считаются нулём'));
  await page.screenshot({path:path.join(qa,'weekly-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Эта неделя',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Эта неделя',exact:true}).getAttribute('aria-pressed'),'true');
  await page.locator('[data-tab="diary"]').click();
  await page.getByRole('button',{name:'Добавить еду',exact:true}).click();
  await page.locator('#entry-form [name="name"]').fill('Помидоры');
  for(const k of ['kcal','protein','fat','carbs'])await page.locator('#entry-form [name="'+k+'"]').fill(k==='kcal'?'30':'1');
  await page.getByRole('button',{name:'Добавить в дневник',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.fc-entry-hint').length===5);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelectorAll('.fc-entry-hint').length===5);
  // Run the actual scanner and catalog UI; mock only the remote catalog boundary.
  const requests=[];let catalogMode='found';
  await page.route('https://*.openfoodfacts.org/**',route=>{
   requests.push(route.request().url());
   if(catalogMode==='offline')return route.abort();
   if(catalogMode==='missing')return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({status:0})});
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:1,product:{code:'4607033680610',product_name_ru:'Тестовый российский творог',nutriments:{'energy-kcal_100g':120,proteins_100g:16,fat_100g:5,carbohydrates_100g:3}}})});
  });
  const entryCount=await page.evaluate(()=>state.entries.length);
  await page.evaluate(()=>quickLookup(']d2\u001d0104607033680610215ABc123456789\u001d93ABCD'));
  await page.locator('#scan-confirm-form').waitFor();
  assert.equal(await page.locator('#scan-confirm-form [name="name"]').inputValue(),'Тестовый российский творог');
  assert.equal(await page.locator('#scan-confirm-form [name="protein"]').inputValue(),'16');
  assert.equal(await page.evaluate(()=>state.entries.length),entryCount,'preview must not log food');
  assert.ok(requests.every(u=>!u.includes('ABc')&&!u.includes('93ABCD')),'only the product number may be sent');
  await page.locator('#scan-confirm-form [name="grams"]').fill('150');
  await page.screenshot({path:path.join(qa,'barcode-product-mobile.png'),fullPage:true});
  await page.locator('#scan-confirm-form button[type="submit"]').click();
  await page.waitForFunction(n=>state.entries.length===n+1,entryCount);
  assert.equal(await page.evaluate(()=>state.entries.at(-1).kcal),180);
  assert.equal(await page.evaluate(()=>state.foods.find(f=>f.barcode==='4607033680610')?.protein),16);
  const requestsBeforeLocal=requests.length;catalogMode='offline';
  await page.evaluate(()=>quickLookup('https://id.gs1.org/01/04607033680610/21/ANOTHER-SERIAL'));
  await page.locator('#scan-confirm-form').waitFor();
  assert.equal(requests.length,requestsBeforeLocal,'saved EAN must match Data Matrix/QR without network');
  await page.locator('[data-action="cancel-scan"]').click();
  catalogMode='missing';
  await page.evaluate(()=>quickLookup('4601234567893'));
  assert.equal(await page.locator('#dialog-title').innerText(),'Код считан, товара пока нет');
  assert.ok(!(await page.locator('#dialog-body').innerText()).includes('Проверь соединение'));
  await page.screenshot({path:path.join(qa,'barcode-missing-mobile.png'),fullPage:true});
  await page.locator('#close-dialog').click();
  catalogMode='offline';
  await page.evaluate(()=>quickLookup('3017624010701'));
  assert.ok((await page.locator('#dialog-body').innerText()).includes('Не удалось связаться с каталогом'));
  await page.locator('#close-dialog').click();
  // Feed real barcode pixels into the real camera processing loop through a canvas MediaStream.
  // No camera hardware or external images are used, and the ZXing frame decoder is not mocked.
  const fixtures=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/product-barcodes.json'),'utf8'));
  for(const fixture of fixtures.filter(f=>f.format!=='EAN_13')){
   const decoded=await page.evaluate(async fixture=>{
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=700;
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,700);ctx.fillStyle='black';
    const scale=8,x0=Math.floor((1000-fixture.rows[0].length*scale)/2),y0=Math.floor((700-fixture.rows.length*scale)/2);
    const draw=()=>{for(let y=0;y<fixture.rows.length;y++)for(let x=0;x<fixture.rows[y].length;x++)if(fixture.rows[y][x]==='1')ctx.fillRect(x0+x*scale,y0+y*scale,scale,scale);};
    // Reproduce six empty frames before the code appears. Minified "NotFound" exceptions
    // used to turn off the 2D decoder after four frames.
    const proto=ZXing.MultiFormatReader.prototype,original=proto.decodeWithState;let frames=0;
    proto.decodeWithState=function(bitmap){if(++frames===7)draw();return original.call(this,bitmap);};
    const stream=canvas.captureStream(10);
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>stream}});
    window.BarcodeDetector=undefined;
    const promise=startCameraScanner();
    try{
     const code=await Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Camera decode timeout: '+fixture.name)),12000))]);
     return {code,frames,stopped:stream.getTracks().every(t=>t.readyState==='ended')};
    }finally{proto.decodeWithState=original;stream.getTracks().forEach(t=>t.stop());document.querySelector('#camera-cancel')?.click();}
   },fixture);
   assert.equal(decoded.code,fixture.code,fixture.name);assert.ok(decoded.frames>=7);assert.equal(decoded.stopped,true);
   assert.equal(await page.locator('#porcia-camera-overlay').count(),0);
  }
  // The two actual user-reported products must no longer depend on Open Food Facts coverage.
  const beforeVerified=requests.length,entriesBeforeVerified=await page.evaluate(()=>state.entries.length);
  for(const item of [
   {code:'4602358009481',name:'Коровка из Кореновки',kcal:'121',protein:'16',fat:'5',carbs:'3',host:'kizk.ru'},
   {code:'4607033689408',name:'Магуро',kcal:'120',protein:'8',fat:'5.6',carbs:'9.8',host:'maguro-tuna.ru'}
  ]){
   await page.evaluate(code=>quickLookup('01'+'0'+code+'21TEST-SERIAL\u001d93ABCD'),item.code);
   await page.locator('#scan-confirm-form').waitFor();
   assert.ok((await page.locator('#scan-confirm-form [name="name"]').inputValue()).includes(item.name));
   for(const key of ['kcal','protein','fat','carbs'])assert.equal(await page.locator('#scan-confirm-form [name="'+key+'"]').inputValue(),item[key]);
   assert.equal(new URL(await page.locator('.scan-product-source a').getAttribute('href')).hostname,item.host);
   await page.screenshot({path:path.join(qa,'verified-'+item.code+'-mobile.png'),fullPage:true});
   await page.locator('[data-action="cancel-scan"]').click();
  }
  assert.equal(requests.length,beforeVerified);assert.equal(await page.evaluate(()=>state.entries.length),entriesBeforeVerified);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: mobile food feedback; EAN and GS1/QR camera decoding; 404 vs offline; saved products; both reported real products work offline with manufacturer nutrition and source links; preview does not log food; no overflow.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
