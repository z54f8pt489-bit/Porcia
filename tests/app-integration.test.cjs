const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
test('Реальный код приложения открывает дневной и недельный совет и сохраняет изменения через прежний мост',async()=>{
 const nodes=new Map(),listeners={};let persisted=null;
 const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',classList:{add(){},remove(){}},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(key);};
 const ctx={console,Intl,URL,Date,Set,Map,Math,JSON,Error,Promise,Number,Uint8ClampedArray,Uint8Array,Array,Object,String,RegExp,
  document:{hidden:false,body:{style:{}},querySelector:node,querySelectorAll:()=>[],getElementById:()=>null,addEventListener:(e,f)=>(listeners[e]||=[]).push(f)},
  location:{hash:''},navigator:{onLine:true},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,addEventListener(){},scrollTo(){},requestAnimationFrame(){},
  porciaCall:async(action,p)=>{if(action==='write'){persisted=JSON.parse(JSON.stringify(p.state));return {revision:p.state.revision};}if(action==='read')return {state:persisted};throw Error(action);}
 };ctx.window=ctx;vm.createContext(ctx);
 for(const file of ['food-coach.js','food-coach-recipes.js','food-coach-ui.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 // Browser bridge is unchanged; use a stub for its I/O boundary, not its render code.
 const model=scripts.find(s=>s.includes('function initial()'));
 const app=scripts.find(s=>s.includes('function diaryView()')).replace(/\ninit\(\);\s*$/,'');
 vm.runInContext(model,ctx);vm.runInContext(app,ctx);
 vm.runInContext(`state=N.initial();state.goals={kcal:1800,protein:160,fat:80};db=true;render();`,ctx);
 assert.match(node('#screen').innerHTML,/Для подсказки нужна запись/);
 await vm.runInContext(`(async()=>{
  const next=clone(state),date=N.dateKey();
  const make=(name,kcal,meal)=>({id:N.uid(),name,kcal,protein:40,fat:20,carbs:40,meal,date,grams:null,estimated:true,photo:null,note:''});
  next.entries=[make('Курица с овощами',600,'Обед'),make('Гречка',500,'Ужин'),make('Творог с яблоком',450,'Завтрак'),make('Круассан',200,'Перекус')];
  await commit(next);foodCoachStart();
 })()`,ctx);
 assert.match(node('#screen').innerHTML,/Красавчик, так держать/);assert.match(node('#screen').innerHTML,/fc-entry-hint/);
 assert.match(node('#screen').innerHTML,/Состав и рецепт/);
 const beforeOpen=JSON.stringify(persisted);
 const button={dataset:{recipe:'cottage-apple'}};
 listeners.click.at(-1)({target:{closest:s=>s==='[data-action="food-coach-recipe"]'?button:null}});
 assert.equal(node('#editor').open,true);assert.equal(node('#dialog-title').textContent,'Творог с яблоком и корицей');
 assert.match(node('#dialog-body').innerHTML,/Ингредиенты на одну порцию/);assert.match(node('#dialog-body').innerHTML,/Как приготовить/);assert.match(node('#dialog-body').innerHTML,/200 г/);
 assert.equal(JSON.stringify(persisted),beforeOpen,'opening a suggestion must not log food or save state');
 vm.runInContext('closeDialog()',ctx);assert.equal(node('#editor').open,false);
 assert.equal(persisted.entries.length,4);assert.equal(persisted.goals.kcal,1800);assert.equal(persisted.goals.protein,160);assert.equal(persisted.goals.fat,80);
 ctx.location.hash='#stats';vm.runInContext('render()',ctx);assert.match(node('#screen').innerHTML,/Питание за неделю/);
 vm.runInContext('foodCoachWeekOffset=0;render()',ctx);assert.match(node('#screen').innerHTML,/Пропуски не считаются нулём/);
 // The report must escape entry names rather than execute markup.
 ctx.location.hash='';vm.runInContext(`state.entries[0].name='Овощи <img src=x onerror=alert(1)>';render()`,ctx);
 assert.ok(!node('#screen').innerHTML.includes('<img src=x'));assert.match(node('#screen').innerHTML,/&lt;img/);
 vm.runInContext('state=N.validate(persistedState);render()',Object.assign(ctx,{persistedState:persisted}));assert.match(node('#screen').innerHTML,/Красавчик, так держать/);
});
