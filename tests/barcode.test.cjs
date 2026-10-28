const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const B=require('../barcode-utils.js');
const root=path.resolve(__dirname,'..');
const code='4607033680610',gtin='04607033680610';
const gs1='01'+gtin+'215ABc123456789\u001d93ABCD';
function withCheck(body){
 let sum=0;for(let i=body.length-1,w=3;i>=0;i--,w=4-w)sum+=Number(body[i])*w;
 return body+String((10-sum%10)%10);
}
test('Российский EAN, дополненный GTIN и GS1 Data Matrix указывают на один товар',()=>{
 for(const raw of [code,gtin,gs1,']d2\u001d'+gs1,'\u00e8'+gs1,'(01)'+gtin+'(21)ABC123','https://id.gs1.org/01/'+gtin+'/21/ABC123']){
  assert.equal(B.parse(raw)?.code,code,raw);
  assert.equal(B.parse(raw)?.gtin14,gtin,raw);
 }
 assert.equal(B.parse(' 460 7033 680610 ')?.code,code);
 assert.ok(B.sameProduct(code,gtin));
 const packed=withCheck('1460703368061');
 assert.equal(B.parse(packed)?.code,packed);
 assert.ok(!B.sameProduct(packed,code),'a different packaging indicator must not turn into the retail product');
 assert.deepEqual(B.lookupCodes(gs1),[code,gtin]);
 assert.equal(B.parse('04252614','upc_e')?.code,'042100005264');
});
test('Посторонний QR, чек, неверная контрольная цифра и случайные цифры не становятся продуктом',()=>{
 for(const raw of ['00000000','4607033680611','https://example.org/'+code,'t=20261028T1400&s=523.00&fn=123456789&i=34&fp=456&n=1','https://example.org/?code='+gs1,'Гречка '+code,'javascript:alert(1)','https://example.org/01/04607033680611','1'.repeat(5000)])assert.equal(B.parse(raw),null,raw.slice(0,80));
});
function bridge(fetch){
 const ctx={console,URL,AbortController,setTimeout,clearTimeout,Date,Map,TeloBarcode:B,fetch,navigator:{}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'pwa-bridge.js'),'utf8'),ctx);
 return raw=>ctx.porciaCall('lookupBarcode',{code:raw});
}
const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
const product=(code)=>({status:1,product:{code,product_name_ru:'Тестовый российский продукт',brands:'Тест',nutriments:{'energy-kcal_100g':120,proteins_100g:16,fat_100g:5,carbohydrates_100g:3}}});
test('HTTP 404 и status:0 означают отсутствие карточки; повторный код не тратит запросы',async()=>{
 const calls=[];const lookup=bridge(async u=>{calls.push(u);return response(404,{});});
 assert.equal(await lookup(gs1),null);
 assert.equal(calls.length,2);assert.ok(calls.every(u=>u.startsWith('https://world.openfoodfacts.org/')));
 assert.equal(await lookup(gtin),null);assert.equal(calls.length,2);
 const empty=bridge(async()=>response(200,{status:0,status_verbose:'product not found'}));
 assert.equal(await empty(code),null);
});
test('Поиск находит русское название по GTIN-14 и не отправляет серийный номер маркировки',async()=>{
 const calls=[];const lookup=bridge(async u=>{
  calls.push(u);return u.includes('/'+gtin+'.json')?response(200,product(gtin)):response(404,{});
 });
 const food=await lookup(gs1);
 assert.equal(food.code,code);assert.equal(food.name,'Тестовый российский продукт');assert.equal(food.protein,16);
 assert.ok(calls.every(u=>!u.includes('ABc')&&!u.includes('215')&&!u.includes('93ABCD')));
 assert.equal(calls.length,2);
 assert.equal((await lookup('https://id.gs1.org/01/'+gtin+'/21/DIFFERENT')).name,food.name);
 assert.equal(calls.length,2);
});
test('Сетевой сбой и лимит не маскируются отсутствием товара; неполные КБЖУ не заменяются нулями',async()=>{
 let calls=0;const offline=bridge(async()=>{calls++;throw Error('Failed to fetch');});
 await assert.rejects(offline(code),/Не удалось связаться/);assert.equal(calls,2);
 calls=0;const limited=bridge(async()=>{calls++;return response(429,{});});
 await assert.rejects(limited(code),/через минуту/);assert.equal(calls,1);
 const fallback=bridge(async u=>u.startsWith('https://ru.')?response(200,product(code)):response(503,{}));
 assert.equal((await fallback(code)).code,code);
 const incomplete=bridge(async()=>response(200,{status:1,product:{code,product_name_ru:'Творог',nutriments:{proteins_100g:16}}}));
 const food=await incomplete(code);assert.equal(food.protein,16);assert.equal(food.kcal,null);assert.equal(food.fat,null);assert.equal(food.incomplete,true);
 const bad=bridge(async()=>response(200,product('3017624010701')));
 await assert.rejects(bad(code),/другой номер/);
});
function pixels(f,rotate=false){
 const pad=10,scale=5,w=(f.rows[0].length+pad*2)*scale,h=(f.rows.length+pad*2)*scale;
 const gray=new Uint8ClampedArray(w*h).fill(255);
 for(let y=0;y<f.rows.length;y++)for(let x=0;x<f.rows[y].length;x++)if(f.rows[y][x]==='1')for(let dy=0;dy<scale;dy++)gray.fill(0,((y+pad)*scale+dy)*w+(x+pad)*scale,((y+pad)*scale+dy)*w+(x+pad+1)*scale);
 if(!rotate)return {gray,w,h};
 const turned=new Uint8ClampedArray(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)turned[x*h+(h-1-y)]=gray[y*w+x];
 return {gray:turned,w:h,h:w};
}
test('Реальный ZXing читает изображения EAN-13, GS1 Data Matrix с FNC1 и QR, включая поворот квадратных кодов',()=>{
 const Z=require('../vendor/zxing.min.js'),fixtures=require('./fixtures/product-barcodes.json');
 const empty=new Z.MultiFormatReader();empty.setHints(new Map([[Z.DecodeHintType.POSSIBLE_FORMATS,B.zxingFormats.map(name=>Z.BarcodeFormat[name])]]));
 assert.throws(()=>empty.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(new Uint8ClampedArray(400*300).fill(255),400,300)))),e=>B.isDecodeMiss(e,Z));
 assert.equal(B.isDecodeMiss(Error('Actual program error'),Z),false);
 for(const fixture of fixtures)for(const rotate of fixture.format==='EAN_13'?[false]:[false,true]){
  const {gray,w,h}=pixels(fixture,rotate);
  const hints=new Map([[Z.DecodeHintType.POSSIBLE_FORMATS,B.zxingFormats.map(name=>Z.BarcodeFormat[name])],[Z.DecodeHintType.TRY_HARDER,true]]);
  const reader=new Z.MultiFormatReader();reader.setHints(hints);
  const result=reader.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(gray,w,h))));
  assert.equal(B.parse(result.getText(),Z.BarcodeFormat[result.getBarcodeFormat()])?.code,fixture.code,fixture.name+' rotated='+rotate);
  assert.equal(result.getBarcodeFormat(),Z.BarcodeFormat[fixture.format]);
 }
});
