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
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: mobile daily/weekly feedback, no overflow, add entry, persisted after reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
