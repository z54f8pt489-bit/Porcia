const {test}=require('node:test');const assert=require('node:assert/strict');const R=require('../food-coach-recipes.js');
test('Каждый рецепт содержит состав на одну порцию, шаги и конечный расчёт КБЖУ',()=>{
 const ids=new Set();for(const r of R.catalogue){assert.ok(!ids.has(r.id));ids.add(r.id);assert.ok(r.ingredients.length>=2);assert.ok(r.steps.length>=3);assert.ok(r.minutes>0);
  for(const i of r.ingredients){assert.ok(i.grams>0);assert.ok(i.amount.length>0);for(const k of ['kcal','protein','fat','carbs'])assert.ok(Number.isFinite(i[k])&&i[k]>=0);}
  const t=R.totals(r);assert.ok(t.kcal>0);for(const v of Object.values(t))assert.ok(Number.isFinite(v)&&v>=0);
 }assert.equal(R.get('missing-recipe'),null);
});
test('Расчёт перекуса включает всё указанное; омлет содержит два яйца без молока',()=>{
 const snack=R.totals(R.get('cottage-apple'));assert.equal(snack.kcal,320);assert.ok(Math.abs(snack.protein-34.45)<.001);
 const omelet=R.get('omelet-vegetables');assert.ok(omelet.ingredients[0].amount.startsWith('2 шт.'));assert.ok(!omelet.ingredients.some(i=>/молоко/i.test(i.name)));
 assert.ok(!R.catalogue.some(r=>r.ingredients.some(i=>/баранин/i.test(i.name))));
});
test('Рекомендация соответствует замечанию и не дублируется в одном отчёте',()=>{
 const treats=R.recommend({date:'2026-10-25',foods:[{}],focus:[{code:'treats'}]});assert.equal(treats.length,1);assert.ok(['cottage-apple','baked-apple'].includes(treats[0].recipe.id));assert.match(treats[0].reason,/Вместо одного сладкого перекуса/);
 const drink=R.recommend({from:'2026-10-19',recordedDays:7,focus:[{code:'drinks'}]});assert.equal(drink[0].recipe.id,'lemon-tea');assert.equal(drink[0].recipe.kind,'Напиток');
 const many=R.recommend({foods:[{}],focus:[{code:'fast'},{code:'bread'},{code:'plants'}]});assert.ok(many.length<=2);assert.equal(new Set(many.map(x=>x.recipe.id)).size,many.length);
 assert.deepEqual(R.recommend({foods:[],focus:[]}),[]);assert.deepEqual(R.recommend({recordedDays:0,focus:[]}),[]);
});
