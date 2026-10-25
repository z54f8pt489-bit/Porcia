// Runs in the app's existing scope. No new storage or background permissions.
let foodCoachWeekOffset=-1;
function foodCoachHour(){return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',hourCycle:'h23'}).format(new Date()));}
function foodCoachEntryHint(entry){
 const c=TeloFoodCoach.classify(entry);
 return `<span class="fc-entry-hint fc-${c.tone}">${esc(c.text)}</span>`;
}
function foodCoachRecipeList(report){
 const ideas=TeloCoachRecipes.recommend(report);
 if(!ideas.length)return '';
 return `<div class="fc-recipe-ideas" aria-label="Блюда к этому совету">${ideas.map(({recipe:r,reason})=>{const t=TeloCoachRecipes.totals(r);return `<article class="fc-recipe-card"><p class="fc-recipe-reason">${esc(reason)}</p><h3>${esc(r.title)}</h3><p class="fc-recipe-meta">1 порция · около ${r.minutes} мин · ≈ ${fmt(t.kcal)} ккал</p><button type="button" class="secondary" data-action="food-coach-recipe" data-recipe="${esc(r.id)}" aria-label="Состав и рецепт: ${esc(r.title)}">Состав и рецепт →</button></article>`;}).join('')}</div>`;
}
function foodCoachRecipeBody(recipe){
 const t=TeloCoachRecipes.totals(recipe);
 return `<div class="fc-recipe-detail"><p class="fc-recipe-reason">${esc(recipe.kind)} · 1 порция · около ${recipe.minutes} минут</p><p>${esc(recipe.note)}</p><div class="fc-recipe-nutrition"><strong>≈ ${fmt(t.kcal)} ккал</strong><span>Б ${fmt(t.protein,1)} г · Ж ${fmt(t.fat,1)} г · У ${fmt(t.carbs,1)} г</span><small>На всю указанную порцию. Справочный расчёт: значения зависят от продуктов.</small></div><h3>Ингредиенты на одну порцию</h3><ul class="fc-ingredients">${recipe.ingredients.map(i=>`<li><span>${esc(i.name)}</span><strong>${esc(i.amount)}</strong></li>`).join('')}</ul>${recipe.pantry.length?`<p class="fc-caveat">${recipe.pantry.map(esc).join(' · ')}. В расчёт КБЖУ не включены небольшие количества специй.</p>`:''}<h3>Как приготовить</h3><ol class="fc-recipe-steps">${recipe.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p class="fc-caveat">Рецепт — идея для меню. Открытие карточки не добавляет его в съеденное.</p>${recipe.safetySource?`<a class="source-link" href="${esc(recipe.safetySource)}" target="_blank" rel="noopener noreferrer">О готовности мяса и яиц ↗</a>`:''}</div>`;
}
function foodCoachReportBody(report,limit=2){
 const praise=report.praise.slice(0,limit),focus=report.focus.slice(0,limit);
 return `${praise.map(p=>`<p class="fc-praise"><span aria-hidden="true">✓</span> ${esc(p)}</p>`).join('')}${focus.map(f=>`<p class="fc-focus"><strong>Обрати внимание.</strong> ${esc(f.text)}</p>`).join('')}${!praise.length&&!focus.length&&report.foods?.length?'<p>Продолжай записывать еду. Для содержательного вывода пока мало понятных записей.</p>':''}${foodCoachRecipeList(report)}<p class="fc-caveat">${esc(report.caveat)}${report.unknown?' Не удалось определить состав '+report.unknown+' записей.':''}</p>`;
}
function foodCoachDayView(date=currentDate){
 const today=N.dateKey(),r=TeloFoodCoach.day(state.entries,state.goals,date,today);
 const ended=date<today||date===today&&foodCoachHour()>=20;
 const yesterday=TeloFoodCoach.day(state.entries,state.goals,N.shiftDate(today,-1),today);
 return `<section class="small-card fc-card fc-${r.tone}" aria-label="Обратная связь по питанию за день"><div class="fc-eyebrow">${ended?'Итог дня по питанию':'Подсказка по рациону'} · ${statDateShort(date)}</div><h2>${esc(r.title)}</h2>${foodCoachReportBody(r)}${ended&&r.foods.length?'<p class="fc-next">Одна небольшая перемена полезнее жёстких запретов. Продолжаем в обычном режиме.</p>':''}${date===today&&!ended&&yesterday.foods.length?`<details class="fc-details"><summary>Вчера по записям · ${esc(yesterday.title)}</summary>${foodCoachReportBody(yesterday,1)}</details>`:''}<details class="fc-details"><summary>Как формируется подсказка</summary><p>Правила работают автоматически на этом iPhone, по названию и КБЖУ записи. Неясный состав не угадывается. У смешанного блюда не считается вся масса овощами или фруктами. Выпечка отмечается, когда её доля в записях заметна, а не за один небольшой десерт. Это ориентир для привычек, а не оценка здоровья.</p><p>Полезна общая картина: разнообразие, порции, овощи, фрукты, бобовые и цельнозерновые продукты. Твои цели КБЖУ берутся из настроек.</p><a href="https://www.who.int/news-room/fact-sheets/detail/healthy-diet" target="_blank" rel="noopener noreferrer">Рекомендации ВОЗ о разнообразном питании ↗</a></details></section>`;
}
function foodCoachWeekView(){
 const today=N.dateKey(),from=TeloFoodCoach.weekStart(today,foodCoachWeekOffset),r=TeloFoodCoach.week(state.entries,state.goals,from,today);
 return `<section class="small-card fc-card fc-${r.tone}" aria-label="Обратная связь по питанию за неделю"><div class="fc-eyebrow">Питание за неделю · ${statDateShort(r.from)} — ${statDateShort(r.to)}</div><div class="fc-switch" role="group" aria-label="Неделя отчёта"><button type="button" data-action="food-coach-week" data-offset="-1" aria-pressed="${foodCoachWeekOffset===-1}">Прошлая неделя</button><button type="button" data-action="food-coach-week" data-offset="0" aria-pressed="${foodCoachWeekOffset===0}">Эта неделя</button></div><h2>${esc(r.title)}</h2>${!r.recordedDays?'<p>За эту неделю записей пока нет. Отсутствие записей ничего не говорит о качестве питания.</p>':foodCoachReportBody(r)}<div class="fc-days">${r.days.map(d=>`<div class="fc-day"><strong>${statDateShort(d.date)}</strong><span>${!d.foods.length?'Нет записей':[d.hasVegetables?'овощи':null,d.hasFruit?'фрукты':null,d.hasWholegrain?'крупы':null,d.hasPulses?'бобовые':null].filter(Boolean).join(' · ')||'есть записи'}</span>${d.focus.some(f=>f.code==='treats')?'<small>заметная доля выпечки / сладостей</small>':''}</div>`).join('')}</div><p class="fc-next">${r.focus.length?'На следующую неделю достаточно выбрать одно изменение из подсказок.':r.recordedDays?'Сохраняй удачные привычки и продолжай добавлять разнообразие.':'Отчёт заполнится автоматически по записям.'}</p></section>`;
}
function foodCoachStart(){
 if(foodCoachStart.started)return;
 foodCoachStart.started=true;
 document.addEventListener('click',event=>{
 const recipeButton=event.target.closest('[data-action="food-coach-recipe"]');
 if(recipeButton){
  if(busy)return;
  const recipe=TeloCoachRecipes.get(recipeButton.dataset.recipe);
  if(recipe)showDialog(recipe.title,foodCoachRecipeBody(recipe));
  return;
 }
 const b=event.target.closest('[data-action="food-coach-week"]');
 if(!b||busy)return;
 foodCoachWeekOffset=b.dataset.offset==='0'?0:-1;render();
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)foodCoachRefresh();});
 setInterval(foodCoachRefresh,60000);
}
// Refresh only the advice cards at the end of the day / week while the app is open.
// No background collection or push notifications are implied.
function foodCoachRefresh(){
 if(!state||document.hidden)return;
 const daily=document.querySelector('[aria-label="Обратная связь по питанию за день"]');
 if(daily)daily.outerHTML=foodCoachDayView();
 const weekly=document.querySelector('[aria-label="Обратная связь по питанию за неделю"]');
 if(weekly)weekly.outerHTML=foodCoachWeekView();
}
