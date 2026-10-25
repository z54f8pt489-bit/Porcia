/* Тело 2.0: локальные подсказки по записанной еде. Без отправки дневника. */
(function(root){
'use strict';
const norm=s=>String(s||'').toLocaleLowerCase('ru').normalize('NFKC').replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim();
const word=(s,re)=>new RegExp('(?:^| )(?:(?:'+re+'))(?:[а-яa-z]*)(?= |$)','i').test(s);
const shift=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const sum=(entries,key)=>entries.reduce((a,e)=>a+(Number.isFinite(e[key])?e[key]:0),0);
const unique=a=>[...new Set(a)];
function classify(entry){
 const s=norm(entry.name),tags=[];
 // A flavour is not a serving of fruit; flour in a name does not make a food unsuitable.
 const noSugar=/без сахара|без добавлен[а-я ]*сахара|zero|зеро|лайт|sugar free/.test(s);
 const drink=word(s,'сок|нектар|лимонад|кола|газировк|морс|компот|смузи|энергетик');
 const pastry=word(s,'круассан|пончик|пирожн|торт|кекс|маффин|вафл|печенье|печенья|печеньем|печенек|печеньк|эклер|плюшк|сдоб|булочк|штрудел');
 const sweet=word(s,'конфет|шоколад|морожен|зефир|мармелад|пастил|халв|пахлав|нутелл|nutella');
 const preparedDessert=pastry||sweet||word(s,'варень|джем|сироп|йогурт|йогуртов|пудинг|запеканк|сырник|блин|олад|пирог|батончик');
 const fast=word(s,'пицц|бургер|чизбургер|гамбургер|чипс|наггетс')||/карто[а-я]* фри|фри карто[а-я]*|хот дог/.test(s);
 if(drink&&(!noSugar||word(s,'сок|нектар|смузи')))tags.push('sweetDrink');
 if(pastry)tags.push('pastry');
 if(sweet&&!pastry)tags.push('sweets');
 if(fast)tags.push('fastFood');
 const noVeg=/без (?:[а-я]+ ){0,2}(?:овощ|помидор|огурц|зелени)/.test(s);
 const vegetables=word(s,'овощ|помидор|томат|огур|капуст|брокколи|цветная капуста|кабач|баклажан|морков|свекл|тыкв|редис|шпинат|руккол|зелень|перец болгарский|болгарский перец');
 const fruit=word(s,'фрукт|ягод|яблок|груш|банан|апельсин|мандарин|киви|персик|абрикос|слива|сливы|сливу|сливами|виноград|арбуз|дын|клубник|малин|черник|смородин|грейпфрут');
 // Do not credit a whole dessert / drink as a fruit or vegetable serving.
 if(vegetables&&!preparedDessert&&!drink&&!fast&&!noVeg&&!word(s,'кетчуп|соус'))tags.push('vegetables');
 if(fruit&&!preparedDessert&&!drink&&!fast&&!word(s,'хлеб|соус|варень|джем'))tags.push('fruit');
 if((word(s,'гречк|гречнев|овсян|овсян[а-я]*|овсяные хлопья|перлов|булгур|киноа')||/цельнозернов|бурый рис|коричневый рис|нешлифованн/.test(s))&&!preparedDessert&&!drink)tags.push('wholegrain');
 if(word(s,'фасол|чечевиц|нут|горох|бобов')&&!word(s,'арахис|соевый соус')&&!preparedDessert)tags.push('pulses');
 if(word(s,'орех|миндал|грецк|фундук|фисташк|семечк|кешью')&&!preparedDessert)tags.push('nuts');
 if(word(s,'куриц|курин|индейк|индейк[а-я]*|рыб|лосос|семг|сард|тунец|треск|минта|хек|творог|яйц|яичниц|омлет|говядин|свинин|тофу|йогурт натуральный')&&!pastry&&!sweet)tags.push('proteinFood');
 if(/белый хлеб|хлеб белый|пшеничный хлеб|хлеб пшеничный/.test(s)||word(s,'батон'))if(!tags.includes('wholegrain'))tags.push('refinedBread');
 const ordinary=word(s,'хлеб|макарон|рис|плов|картофел|картош|суп|борщ|салат|сыр|молок|кефир|масло|йогурт|пельмен|вареник|рагу|котлет|тефтел|солянк|уха|каша|вода|чай|кофе|соль|специ');
 const recognized=tags.length>0||ordinary||noSugar&&drink;
 let text='По одному названию состав неясен. Учту КБЖУ; качество блюда пока не оцениваю.';
 let tone='neutral';
 if(tags.includes('sweetDrink')){text='Сладкий напиток: обрати внимание на порцию и частоту. Воду или чай без сахара проще вписать в день.';tone='attention';}
 else if(tags.includes('pastry')||tags.includes('sweets')){text='Оставим место для любимого. Если таких перекусов несколько, один можно заменить фруктом и творогом.';tone='attention';}
 else if(tags.includes('fastFood')){text='Здесь стоит учитывать порцию и частоту. Для следующего приёма подойдут обычный гарнир, белковый продукт и овощи.';tone='attention';}
 else if(tags.includes('wholegrain')){text='Хорошая основа приёма пищи. Сочетай с овощами и белковым продуктом, учитывая порцию и добавки.';tone='positive';}
 else if(tags.includes('pulses')){text='Бобовые добавляют разнообразие и клетчатку. Хороший выбор для регулярного меню.';tone='positive';}
 else if(tags.includes('vegetables')||tags.includes('fruit')){text='В названии есть овощи или фрукты — хороший вклад в разнообразие. Их количество в смешанном блюде неизвестно.';tone='positive';}
 else if(tags.includes('proteinFood')){text='Есть белковый продукт. Посмотри также на порцию и дополнение из овощей.';tone='positive';}
 else if(tags.includes('nuts')){text='Орехи добавляют разнообразие. Порция важна: в небольшом объёме может быть много калорий.';tone='positive';}
 else if(tags.includes('refinedBread'))text='Хлеб может быть частью рациона. Для разнообразия иногда выбирай цельнозерновой и добавляй белок или овощи.';
 else if(recognized)text='Учитывай порцию и состав всего приёма пищи. По одному продукту качество дня не определить.';
 return {tags:unique(tags),recognized,tone,text,name:String(entry.name||'')};
}
function day(entries,goals,date,today){
 const foods=entries.filter(e=>e.date===date),classified=foods.map(classify);
 const has=tag=>classified.some(c=>c.tags.includes(tag));
 const withTag=tag=>foods.filter((e,i)=>classified[i].tags.includes(tag));
 const known=classified.filter(c=>c.recognized).length;
 const total=sum(foods,'kcal'),protein=sum(foods,'protein');
 const treats=foods.filter((e,i)=>classified[i].tags.some(t=>['pastry','sweets'].includes(t)));
 const treatKcal=sum(treats,'kcal'),drinkKcal=sum(withTag('sweetDrink'),'kcal');
 const grainFoods=withTag('wholegrain'),vegFoods=withTag('vegetables'),fruitFoods=withTag('fruit');
 const richTreats=(treats.length>=2&&treatKcal>=total*.25&&treatKcal>=200)||(treatKcal>=goals.kcal*.3&&treatKcal>=300);
 const sweetDrinks=withTag('sweetDrink').length>0&&drinkKcal>=80;
 const recurringFast=withTag('fastFood').length>=2&&sum(withTag('fastFood'),'kcal')>=total*.3;
 const breadKcal=sum(withTag('refinedBread'),'kcal');
 const muchBread=breadKcal>=350&&breadKcal>=total*.35;
 const meaningful=foods.length>=3&&new Set(foods.map(e=>e.meal)).size>=2;
 const enoughKnown=known>=Math.max(2,Math.ceil(foods.length*.6));
 const praise=[],focus=[];
 const example=list=>list.slice(0,2).map(e=>e.name).join(', ');
 if(vegFoods.length)praise.push('В записях есть овощи: '+example(vegFoods)+'. Это хороший шаг к более разнообразному рациону.');
 if(fruitFoods.length)praise.push('Есть фрукты или ягоды: '+example(fruitFoods)+'. Отличная привычка для разнообразия.');
 if(grainFoods.length)praise.push('Есть крупы или цельнозерновые продукты: '+example(grainFoods)+'. Хорошая основа меню.');
 if(has('pulses'))praise.push('В меню появились бобовые — здорово, что добавляешь разнообразие.');
 if(goals.protein>0&&protein>=goals.protein)praise.push('Белок по записям достиг твоего минимума: '+Math.round(protein)+' г.');
 if(richTreats)focus.push({code:'treats',text:'Сегодня выпечка и сладости заняли заметную долю записанного. Давай держаться твоей цели: в следующий раз один такой перекус замени творогом с фруктом, а к основному приёму добавь овощи.'});
 if(sweetDrinks)focus.push({code:'drinks',text:'В записях есть калории из сладких напитков. Попробуй один раз выбрать воду или несладкий чай, а фрукт съесть целиком.'});
 if(recurringFast)focus.push({code:'fast',text:'В этот день несколько записей с фастфудом или снеками. Следующий обычный приём пищи собери из гарнира, белкового продукта и овощей.'});
 if(muchBread)focus.push({code:'bread',text:'Белый хлеб занимает заметную долю записанного рациона. Хлеб может оставаться в меню; для разнообразия часть порции замени крупой или цельнозерновым хлебом и добавь овощи и белковый продукт.'});
 if(meaningful&&enoughKnown&&!has('vegetables')&&!has('fruit'))focus.push({code:'plants',text:'В названиях записанных блюд пока не видно овощей и фруктов. Если они были, отлично; если нет — добавь их к следующему обычному приёму пищи.'});
 if(total>goals.kcal*1.1)focus.push({code:'energy',text:'Записанная калорийность выше твоего ориентира '+Math.round(goals.kcal)+' ккал. Обрати внимание на порции и добавки. Завтра вернись к обычному режиму — компенсировать едой или нагрузкой ничего не нужно.'});
 const balanced=meaningful&&enoughKnown&&total>=goals.kcal*.7&&has('vegetables')&&(has('fruit')||has('wholegrain')||has('pulses'))&&focus.length===0;
 const title=!foods.length?'Для подсказки нужна запись':balanced?'Красавчик, так держать!':focus.length?'Есть на что обратить внимание':praise.length?'Есть удачные решения':'Начало положено';
 return {date,foods,classified,total,protein,known,unknown:foods.length-known,meaningful,balanced,praise,focus,hasVegetables:has('vegetables'),hasFruit:has('fruit'),hasWholegrain:has('wholegrain'),hasPulses:has('pulses'),title,tone:focus.length?'attention':balanced?'positive':'neutral',caveat:!foods.length?'Пустой день не считаем ни удачным, ни неудачным.':'Только по записанной еде: незаписанное неизвестно. Название не раскрывает точный состав и количество овощей; фото не анализируются.',past:date<today};
}
function week(entries,goals,from,today){
 const to=shift(from,6),dates=Array.from({length:7},(_,i)=>shift(from,i)).filter(d=>d<=today);
 const days=dates.map(d=>day(entries,goals,d,today)),recorded=days.filter(d=>d.foods.length),n=recorded.length;
 const count=key=>recorded.filter(d=>d[key]).length;
 const concerns=code=>recorded.filter(d=>d.focus.some(f=>f.code===code)).length;
 const praise=[],focus=[];
 if(count('hasVegetables'))praise.push('Овощи встречались в '+count('hasVegetables')+' из '+n+' дней с записями. Продолжай добавлять их к привычным блюдам.');
 if(count('hasFruit'))praise.push('Фрукты и ягоды отмечены в '+count('hasFruit')+' из '+n+' дней с записями.');
 if(count('hasWholegrain')||count('hasPulses'))praise.push('Крупы, цельнозерновые продукты или бобовые помогали разнообразить меню в '+recorded.filter(d=>d.hasWholegrain||d.hasPulses).length+' из '+n+' дней с записями.');
 const repeated=Math.max(2,Math.ceil(n*.4));
 if(n>=3&&concerns('treats')>=repeated)focus.push({code:'treats',text:'Выпечка и сладости занимали заметную долю записанного в '+concerns('treats')+' днях. Давай на следующей неделе в паре привычных перекусов выберем творог с фруктом или обычный бутерброд с белковым продуктом и овощами.'});
 if(n>=3&&concerns('drinks')>=repeated)focus.push({code:'drinks',text:'Сладкие напитки повторялись в '+concerns('drinks')+' днях. Начни с одной замены в день на воду или чай без сахара.'});
 if(n>=3&&concerns('fast')>=repeated)focus.push({code:'fast',text:'Приёмы с фастфудом повторялись. Подготовь один простой домашний вариант: крупа, курица или бобовые и овощи.'});
 if(n>=3&&concerns('bread')>=repeated)focus.push({code:'bread',text:'Белый хлеб занимал заметную долю рациона в '+concerns('bread')+' днях с записями. Попробуй часть заменить крупой или цельнозерновым вариантом, добавляя овощи и белковый продукт.'});
 if(n>=3&&recorded.filter(d=>d.meaningful&&d.known>=2&&!d.hasVegetables&&!d.hasFruit).length>=repeated)focus.push({code:'plants',text:'В нескольких днях с записями овощи и фрукты не распознаны. Это может быть неполный состав названий; если их действительно мало, начни добавлять овощи к обеду или ужину.'});
 if(n>=3&&concerns('energy')>=repeated)focus.push({code:'energy',text:'Записанная калорийность неоднократно была выше твоего ориентира. На следующей неделе посмотри на размер порций, масло и заправки. Резко урезать питание не нужно.'});
 const adequate=n>=4,balancedDays=count('balanced');
 const title=!n?'Пока нет записей':!adequate?'Первые наблюдения':focus.length?'Продолжаем с небольшим изменением':balancedDays>=3?'Красавчик, держишь направление!':'Есть хорошие привычки';
 return {from,to,days,recordedDays:n,missingDays:dates.length-n,unknown:recorded.reduce((a,d)=>a+d.unknown,0),balancedDays,adequate,title,praise,focus,tone:focus.length?'attention':adequate&&balancedDays>=3?'positive':'neutral',caveat:'Записи есть за '+n+' из '+dates.length+' дней периода. Пропуски не считаются нулём; полнота питания неизвестна. '+(!adequate?'Для вывода о привычках пока мало данных. ':'')+'Оценка по названиям и КБЖУ, без анализа фото.'};
}
function weekStart(date,offset=0){const day=new Date(date+'T12:00:00Z').getUTCDay();return shift(date,-((day+6)%7)+offset*7);}
root.TeloFoodCoach={classify,day,week,weekStart,shift};
if(typeof module==='object'&&module.exports)module.exports=root.TeloFoodCoach;
})(globalThis);
