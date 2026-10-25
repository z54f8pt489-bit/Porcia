/* Optional recipe details for report suggestions; opening a card never logs food. */
(function(root){
'use strict';
// Reference values per 100 g. Displayed totals are estimates, not label data.
const foods={
 cottage:{kcal:121,protein:17,fat:5,carbs:2},apple:{kcal:52,protein:.3,fat:.2,carbs:14},walnut:{kcal:654,protein:15.2,fat:65.2,carbs:13.7},
 egg:{kcal:143,protein:12.6,fat:9.5,carbs:.7},tomato:{kcal:18,protein:.9,fat:.2,carbs:3.9},pepper:{kcal:26,protein:1,fat:.3,carbs:6},
 oil:{kcal:900,protein:0,fat:100,carbs:0},chicken:{kcal:120,protein:22.5,fat:2.6,carbs:0},buckwheat:{kcal:343,protein:13.3,fat:3.4,carbs:71.5},
 carrot:{kcal:41,protein:.9,fat:.2,carbs:9.6},onion:{kcal:40,protein:1.1,fat:.1,carbs:9.3},lentils:{kcal:350,protein:25,fat:1.1,carbs:60},
 lemon:{kcal:29,protein:1.1,fat:.3,carbs:9.3},water:{kcal:0,protein:0,fat:0,carbs:0}
};
const ingredient=(name,grams,food,amount)=>({name,grams,...foods[food],amount:amount||grams+' г'});
const catalogue=[
 {id:'cottage-apple',title:'Творог с яблоком и корицей',minutes:5,kind:'Перекус',
  ingredients:[ingredient('Творог 5%',200,'cottage'),ingredient('Яблоко без сердцевины',150,'apple')],
  pantry:['Корица — щепотка, по желанию'],
  steps:['Нарежь яблоко небольшими кубиками или натри на крупной тёрке.','Разомни творог вилкой. Смешай с яблоком или выложи слоями.','При желании добавь щепотку корицы. Сахар и мёд в этом варианте не нужны.'],
  note:'Вариант вместо одного привычного сладкого перекуса. Его калорийность не обязательно ниже: сравнивай целые порции.'},
 {id:'baked-apple',title:'Печёное яблоко с творогом и орехами',minutes:25,kind:'Перекус',
  ingredients:[ingredient('Яблоко без сердцевины',180,'apple'),ingredient('Творог 5%',100,'cottage'),ingredient('Грецкие орехи, ядра',10,'walnut')],
  pantry:['Корица — щепотка, по желанию'],
  steps:['Разогрей духовку до 180 °C. Разрежь яблоко пополам, убери сердцевину.','Выложи в небольшую форму с 1–2 столовыми ложками воды. Запекай около 20 минут до мягкости; время зависит от сорта и размера.','Дай немного остыть. Добавь творог и измельчённые орехи, при желании — корицу.'],
  note:'Сладкий вкус даёт само яблоко. Орехи и творог уже включены в расчёт порции.'},
 {id:'omelet-vegetables',title:'Омлет из двух яиц с овощами',minutes:12,kind:'Завтрак или обычный приём пищи',
  ingredients:[ingredient('Яйца без скорлупы',100,'egg','2 шт. · около 100 г без скорлупы'),ingredient('Помидор',150,'tomato'),ingredient('Болгарский перец',100,'pepper'),ingredient('Растительное масло',5,'oil','5 г · около 1 ч. л.')],
  pantry:['Зелень и перец — по вкусу'],
  steps:['Нарежь помидор и болгарский перец. Взбей два яйца вилкой. Молоко не требуется.','Прогрей масло на сковороде, добавь овощи и готовь 3–4 минуты, помешивая.','Влей яйца, убавь нагрев и накрой крышкой. Готовь до полной готовности без жидкого яйца; ориентир в центре омлета — 71 °C.','Добавь зелень. Это самостоятельная порция омлета; хлеб и другие дополнения в расчёт не включены.'],
  note:'Простой способ добавить овощи к привычным яйцам. Калорийность масла учтена.',safetySource:'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures'},
 {id:'buckwheat-chicken',title:'Гречка с курицей и овощами',minutes:30,kind:'Обед или ужин',
  ingredients:[ingredient('Гречневая крупа, сухая',50,'buckwheat'),ingredient('Куриное филе, сырое',150,'chicken'),ingredient('Помидор',150,'tomato'),ingredient('Болгарский перец',100,'pepper'),ingredient('Растительное масло',5,'oil','5 г · около 1 ч. л.')],
  pantry:['Вода для гречки — по инструкции на упаковке','Паприка, перец и зелень — по вкусу'],
  steps:['Промой гречку. Залей водой по инструкции на упаковке и свари до готовности; 50 г — масса сухой крупы.','Нарежь овощи и, на отдельной доске, куриное филе небольшими кусочками.','Прогрей масло на сковороде. Добавь курицу, затем овощи, немного воды и специи. Готовь под крышкой, помешивая, до 74 °C внутри самых толстых кусочков курицы.','Выложи к готовой гречке курицу и овощи. Указанного количества хватает на одну порцию.'],
  note:'Идея обычного обеда или ужина вместо одного приёма с фастфудом. Не требуется есть её дополнительно к уже съеденному.',safetySource:'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures'},
 {id:'lentils-vegetables',title:'Красная чечевица с овощами',minutes:25,kind:'Обед или ужин',
  ingredients:[ingredient('Красная чечевица, сухая',60,'lentils'),ingredient('Морковь',80,'carrot'),ingredient('Помидор',150,'tomato'),ingredient('Репчатый лук',40,'onion'),ingredient('Растительное масло',5,'oil','5 г · около 1 ч. л.')],
  pantry:['Вода — примерно 250 мл, при необходимости добавь ещё','Паприка или другие специи — по вкусу'],
  steps:['Промой чечевицу. Нарежь лук и помидор, натри морковь.','В кастрюле прогрей масло, добавь лук и морковь и готовь 3–4 минуты.','Добавь помидор, чечевицу, воду и специи. Туши на небольшом огне около 15–20 минут до мягкости чечевицы, при необходимости подливая воду.','Перемешай и дай постоять пару минут. Все указанные ингредиенты — одна порция.'],
  note:'Вариант, чтобы добавить в меню бобовые и овощи. Время варки уточняй по упаковке чечевицы.'},
 {id:'lemon-tea',title:'Холодный травяной чай с лимоном',minutes:10,kind:'Напиток',
  ingredients:[ingredient('Заваренный чай без сахара',250,'water','250 мл'),ingredient('Лимон, съедобная часть',20,'lemon')],
  pantry:['Лёд — по желанию'],
  steps:['Завари травяной чай по инструкции на упаковке.','Дай остыть до комфортной температуры, добавь вымытый лимон.','Для холодного варианта положи лёд. Сахар, сироп и мёд не добавляются.'],
  note:'Вариант вместо сладкого напитка. Это напиток, а не замена приёма пищи.'}
];
function get(id){return catalogue.find(r=>r.id===id)||null;}
function totals(recipe){return recipe.ingredients.reduce((out,i)=>{for(const k of ['kcal','protein','fat','carbs'])out[k]+=i[k]*i.grams/100;return out;},{kcal:0,protein:0,fat:0,carbs:0});}
const options={treats:['cottage-apple','baked-apple'],plants:['omelet-vegetables','lentils-vegetables'],drinks:['lemon-tea'],fast:['buckwheat-chicken','omelet-vegetables'],bread:['buckwheat-chicken','lentils-vegetables'],energy:['omelet-vegetables','buckwheat-chicken']};
const reasons={treats:'Вместо одного сладкого перекуса',plants:'Чтобы добавить овощи к обычному приёму пищи',drinks:'Вместо одного сладкого напитка',fast:'Вариант обычного обеда или ужина',bread:'Для разнообразия вместо части белого хлеба',energy:'Идея для следующего обычного приёма пищи'};
function recommend(report,limit=2){
 if(report.foods&&!report.foods.length||report.recordedDays===0)return [];
 const seed=String(report.date||report.from||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0),out=[];
 for(const f of report.focus||[]){
  const ids=options[f.code];if(!ids)continue;
  const id=ids[seed%ids.length];if(out.some(x=>x.recipe.id===id))continue;
  out.push({recipe:get(id),reason:reasons[f.code]});if(out.length>=limit)break;
 }
 if(!out.length){const ids=['buckwheat-chicken','omelet-vegetables','lentils-vegetables'];out.push({recipe:get(ids[seed%ids.length]),reason:'Идея, чтобы сохранить разнообразие'});}
 return out;
}
root.TeloCoachRecipes={catalogue,get,totals,recommend};
if(typeof module==='object'&&module.exports)module.exports=root.TeloCoachRecipes;
})(globalThis);
