const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../food-coach.js');
const goals={kcal:1800,protein:160,fat:80},today='2026-10-25';
const e=(name,kcal=200,meal='Обед',date=today,extra={})=>({id:name,name,kcal,protein:10,fat:10,carbs:20,date,meal,grams:null,...extra});
test('Хлеб не равен сладкой выпечке, печень не равна печенью, масло не равно сливам',()=>{
 assert.ok(!C.classify(e('Печень куриная')).tags.includes('pastry'));
 assert.ok(C.classify(e('Печенье овсяное')).tags.includes('pastry'));
 assert.ok(!C.classify(e('Печенье овсяное')).tags.includes('wholegrain'));
 assert.ok(!C.classify(e('Масло сливочное')).tags.includes('fruit'));
 assert.ok(C.classify(e('Сливы')).tags.includes('fruit'));
 assert.ok(!C.classify(e('Хлеб цельнозерновой')).tags.includes('pastry'));
 assert.ok(C.classify(e('Хлеб цельнозерновой')).tags.includes('wholegrain'));
});
test('Вкус фруктов и овощей не считается порцией в десерте, сок остаётся напитком',()=>{
 for(const name of ['Торт морковный','Йогурт клубничный','Банановый хлеб','Мороженое с яблоками','Яблочный сок без добавленного сахара'])assert.ok(!C.classify(e(name)).tags.includes('fruit')&&!C.classify(e(name)).tags.includes('vegetables'),name);
 assert.ok(C.classify(e('Яблочный сок без добавленного сахара')).tags.includes('sweetDrink'));
 assert.ok(!C.classify(e('Кола Zero без сахара')).tags.includes('sweetDrink'));
 assert.ok(C.classify(e('Омлет с помидорами')).tags.includes('vegetables'));
 assert.ok(!C.classify(e('Омлет без овощей')).tags.includes('vegetables'));
});
test('Один небольшой десерт не портит дневную оценку',()=>{
 const entries=[e('Курица с овощами',600,'Обед'),e('Гречка',500,'Ужин'),e('Творог с фруктами',450,'Завтрак'),e('Круассан',200,'Перекус')];
 const result=C.day(entries,goals,today,today);
 assert.ok(!result.focus.some(f=>f.code==='treats'));assert.equal(result.balanced,true);
 const repeated=C.day([e('Печенье',450,'Завтрак'),e('Булочка',400,'Перекус'),e('Курица',600,'Обед')],goals,today,today);
 assert.ok(repeated.focus.some(f=>f.code==='treats'));assert.equal(repeated.balanced,false);
});
test('Низкая калорийность, пустые и неизвестные записи не получают общую похвалу',()=>{
 const sparse=C.day([e('Огурцы',30,'Завтрак'),e('Яблоко',80,'Обед'),e('Гречка',100,'Ужин')],goals,today,today);
 assert.equal(sparse.balanced,false);
 assert.equal(C.day([],goals,today,today).tone,'neutral');
 const unknown=C.day([e('Мой обед'),e('Блюдо №2'),e('Рецепт бабушки')],goals,today,today);
 assert.equal(unknown.unknown,3);assert.equal(unknown.focus.length,0);assert.equal(unknown.balanced,false);
});
test('Пропуски недели не считаются нулём или плохим питанием',()=>{
 const w=C.week([e('Торт',600,'Перекус','2026-10-19')],goals,'2026-10-19',today);
 assert.equal(w.recordedDays,1);assert.equal(w.missingDays,6);assert.equal(w.adequate,false);assert.equal(w.focus.length,0);
 assert.ok(w.caveat.includes('Пропуски не считаются нулём'));
});
test('Недельный совет использует повторяющуюся привычку, а не единичный случай',()=>{
 const entries=Array.from({length:7},(_,i)=>[e('Курица с овощами',600,'Обед',C.shift('2026-10-19',i)),e(i<3?'Печенье':'Гречка',600,'Ужин',C.shift('2026-10-19',i)),e('Яблоко и творог',400,'Завтрак',C.shift('2026-10-19',i))]).flat();
 const original=JSON.stringify(goals),w=C.week(entries,goals,'2026-10-19',today);
 assert.equal(w.recordedDays,7);assert.ok(w.focus.some(f=>f.code==='treats'));assert.equal(JSON.stringify(goals),original);
 assert.ok(w.praise.some(p=>p.includes('Овощи')));
});
test('Календарные недели начинаются в понедельник, граница года работает',()=>{
 assert.equal(C.weekStart('2026-10-25'),'2026-10-19');assert.equal(C.weekStart('2026-10-26',-1),'2026-10-19');assert.equal(C.weekStart('2027-01-01'),'2026-12-28');
});
test('Существующие скрипты компилируются; новые ресурсы включены в кеш; удалённые UI не возвращены',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
 assert.ok(html.includes('${foodCoachDayView()}'));assert.ok(html.includes('${foodCoachEntryHint(e)}'));assert.ok(html.includes('${foodCoachWeekView()}'));
 assert.ok(html.includes('foodCoachStart();'));
 assert.ok(!html.includes("['history','История']"));assert.ok(!html.includes('Скопируй отчёт в наш чат'));
 const sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');
 for(const file of ['food-coach.js','food-coach-ui.js','food-coach-recipes.js','food-coach.css'])assert.ok(sw.includes(file+'?v=2.0.10'));
 assert.ok(html.includes('TELO_MOTIVATION_COOLDOWN_MS=2*60*60*1000'));
});
