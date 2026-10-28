/* Individually checked product cards. This is not a complete Russian product database. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./barcode-utils.js'):root.TeloBarcode);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TeloVerifiedProducts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(B){
  'use strict';
  const cards=[
    {
      code:'4602358009481',name:'Творог «Коровка из Кореновки» 5%, рассыпчатый, 300 г',brand:'Коровка из Кореновки',
      kcal:121,protein:16,fat:5,carbs:3,packageGrams:300,
      source:'Коровка из Кореновки — данные производителя',
      sourceUrl:'https://kizk.ru/catalog/molochnye-produkty/tvorog-tvorozhnye-syrki/tvorog-5-300-g/',
      barcodeSourceUrl:'https://barcode-list.ru/barcode/RU/%D0%9F%D0%BE%D0%B8%D1%81%D0%BA.htm?barcode=4602358009481',
      sourceCheckedOn:'2026-10-28'
    },
    {
      code:'4607033689408',name:'Гавайская смесь с тунцом и соусом сальса «Магуро», 230 г',brand:'Магуро',
      kcal:120,protein:8,fat:5.6,carbs:9.8,packageGrams:230,
      source:'Магуро — данные производителя',
      sourceUrl:'https://maguro-tuna.ru/production/file-kusochki-polosatogo-tuntsa-s-risom-gavayskaya-smes/',
      barcodeSourceUrl:'https://barcode-list.ru/barcode/RU/%D0%9F%D0%BE%D0%B8%D1%81%D0%BA.htm?barcode=4607033689408',
      sourceCheckedOn:'2026-10-28'
    }
  ].map(card=>Object.freeze({...card,incomplete:false,estimated:false,russian:true,catalog:'verified-manufacturer'}));
  const normal=text=>String(text||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}%]+/gu,' ').trim();
  function lookup(raw){const parsed=B.parse(String(raw||''));const found=parsed&&cards.find(card=>B.sameProduct(card.code,parsed.code));return found?{...found}:null;}
  function search(query){
    const q=normal(query);if(q.length<2)return [];
    const exact=lookup(String(query||''));if(exact)return [exact];
    const words=q.split(/\s+/);return cards.filter(card=>words.every(word=>normal(card.name+' '+card.brand).includes(word))).map(card=>({...card}));
  }
  return Object.freeze({lookup,search});
});
