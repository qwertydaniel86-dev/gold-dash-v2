// node test-planner.js : tests the pure logic block (/*LOGIC*/ ... /*ENDLOGIC*/) of index.html
var fs=require('fs'),assert=require('assert'),src=fs.readFileSync(__dirname+'/index.html','utf8');
var m=src.match(/\/\*LOGIC\*\/([\s\S]*?)\/\*ENDLOGIC\*\//);assert(m,'logic block');
var L=new Function(m[1]+';return{GD_AUTH,authCheck,authSessOk,pnCalc,pushHist,histAdd,histGet,hKey,HCAP,zoneStrat,planWhy,sigInfo,OT}')();var n=0;
function t(name,fn){fn();n++;console.log('ok',name)}
var base={price:4000,off:0,lot:0.01,slD:15,tpD:30,acct:80,dp:2,xau:true};
function c(k,o){var x={};for(var i in base)x[i]=base[i];x.k=k;if(o)for(var j in o)x[j]=o[j];return L.pnCalc(x)}
var DEF={mb:0,ms:0,bl:-10,sl:10,bs:10,ss:-10};
t('default offsets',function(){L.OT.forEach(function(o){assert.strictEqual(o[3],DEF[o[0]])})});
// [type, offset, entry, sl, tp]
[['mb',0,4000,3985,4030],['ms',0,4000,4015,3970],['bl',-10,3990,3975,4020],['sl',10,4010,4025,3980],['bs',10,4010,3995,4040],['ss',-10,3990,4005,3960]].forEach(function(r){
 t('type '+r[0]+' prices & direction',function(){var x=c(r[0],{off:r[1]});assert.strictEqual(x.ent,r[2]);assert.strictEqual(x.sl,r[3]);assert.strictEqual(x.tp,r[4]);
  var buy=r[0]=='mb'||r[0]=='bl'||r[0]=='bs';if(buy){assert(x.sl<x.ent&&x.tp>x.ent)}else{assert(x.sl>x.ent&&x.tp<x.ent)}
  assert.strictEqual(x.risk,15);assert.strictEqual(x.rew,30);assert.strictEqual(x.rr,2)})});
t('market ignores offset',function(){var x=c('mb',{off:99});assert.strictEqual(x.ent,4000)});
t('$ math 0.01 lot = $1 per $1; 0.05 lot SL 20',function(){var x=c('ms',{lot:0.05,slD:20,tpD:40,acct:1000});assert.strictEqual(x.risk,100);assert.strictEqual(x.rew,200);assert.deepStrictEqual(x.warn,[])});
t('no warnings when safe (SL 10, lot .01, acct 200)',function(){var x=c('bl',{slD:10,tpD:20,acct:200,off:-10});assert.strictEqual(x.risk,10);assert.deepStrictEqual(x.warn,[])});
t('warn risk>10% (default $15 on $80)',function(){var x=c('bl',{off:-10});assert(x.warn.some(function(w){return /over 10%/.test(w)}))});
t('risk exactly 10% is OK',function(){var x=c('bl',{off:-10,slD:10,tpD:20,acct:100});assert.strictEqual(x.risk,10);assert(!x.warn.some(function(w){return /over 10%/.test(w)}))});
t('warn lot>=0.03 on $80 (and $50), not on $200',function(){assert(c('mb',{lot:0.03}).warn.some(function(w){return /too big/.test(w)}));assert(c('mb',{lot:0.03,acct:50}).warn.some(function(w){return /too big/.test(w)}));assert(!c('mb',{lot:0.03,acct:200}).warn.some(function(w){return /too big/.test(w)}));assert(!c('mb',{lot:0.02}).warn.some(function(w){return /too big/.test(w)}))});
t('warn SL<10',function(){assert(c('mb',{slD:9.99,tpD:20}).warn.some(function(w){return /tighter than \$10/.test(w)}));assert(!c('mb',{slD:10,tpD:20,acct:500}).warn.some(function(w){return /tighter/.test(w)}))});
t('wrong-side offset warns',function(){assert(c('bl',{off:10}).warn.some(function(w){return /must be below/.test(w)}));assert(c('sl',{off:-10}).warn.some(function(w){return /must be above/.test(w)}));assert(c('bs',{off:-5}).warn.some(function(w){return /must be above/.test(w)}));assert(c('ss',{off:5}).warn.some(function(w){return /must be below/.test(w)}));assert(!c('ss',{off:-10}).warn.some(function(w){return /must be/.test(w)}))});
t('bad inputs',function(){assert(c('mb',{slD:0}).warn.length>0);assert(c('mb',{lot:0}).warn.some(function(w){return /Lot/.test(w)}));assert.strictEqual(c('mb',{price:null}).ok,false)});
t('rounding to symbol precision',function(){var x=c('bl',{price:4000.123,off:-10.005,dp:2});assert.strictEqual(x.ent,3990.12);var y=c('mb',{price:1.08123,slD:0.0015,tpD:0.003,dp:5,xau:false});assert.strictEqual(y.sl,1.07973);assert.strictEqual(y.tp,1.08423)});
t('non-XAU: no $ math',function(){var x=c('mb',{xau:false});assert.strictEqual(x.risk,null);assert.strictEqual(x.rew,null);assert(!x.warn.some(function(w){return /over 10%|too big|tighter/.test(w)}))});
// history cap
t('history cap 30, newest first, oldest dropped',function(){var a=[];for(var i=1;i<=35;i++)a=L.pushHist(a,{i:i});assert.strictEqual(a.length,30);assert.strictEqual(a[0].i,35);assert.strictEqual(a[29].i,6)});
function mem(){var d={};return{getItem:function(k){return k in d?d[k]:null},setItem:function(k,v){d[k]=v},d:d}}
t('history stored per user, capped, survives reload',function(){var st=mem();for(var i=1;i<=40;i++)L.histAdd(st,'Daniel',{i:i,str:'x'});L.histAdd(st,'mophet',{i:1});
 assert.strictEqual(L.histGet(st,'daniel').length,30);assert.strictEqual(L.histGet(st,'daniel')[0].i,40);assert.strictEqual(L.histGet(st,'daniel')[29].i,11);assert.strictEqual(L.histGet(st,'mophet').length,1);assert.strictEqual(L.histAdd(st,'',{i:1}).length,0);assert.deepStrictEqual(Object.keys(st.d).sort(),['gdH2_daniel','gdH2_mophet'])});
t('oversized stored array is trimmed on read',function(){var st=mem(),a=[];for(var i=0;i<50;i++)a.push({i:i});st.setItem('gdH2_x',JSON.stringify(a));assert.strictEqual(L.histGet(st,'x').length,30);assert.strictEqual(L.histAdd(st,'x',{i:99}).length,30)});
t('corrupt storage is safe',function(){var st=mem();st.setItem('gdH2_x','{bad');assert.deepStrictEqual(L.histGet(st,'x'),[])});
// strategy labels
t('zone → strategy',function(){assert.strictEqual(L.zoneStrat('S1 pivot'),'Pivot bounce');assert.strictEqual(L.zoneStrat('P pivot'),'Pivot bounce');assert.strictEqual(L.zoneStrat('Day high'),'Day high/low reject');assert.strictEqual(L.zoneStrat('Day low'),'Day high/low reject');assert.strictEqual(L.zoneStrat('Bull FVG'),'FVG retest');assert.strictEqual(L.zoneStrat('Bear FVG'),'FVG retest');assert.strictEqual(L.zoneStrat('Round 4,000.00'),'Round-number reject')});
t('signal strategy label + reason',function(){var up={'1h':{d:1},'4h':{d:1}},a=L.sigInfo('BUY',0.031,0.02,up);assert.strictEqual(a.name,'Momentum (10-min move)');assert(/\+0\.031% in 10 min/.test(a.why)&&/with 1H\/4H trend/.test(a.why));
 assert(/against 1H\/4H trend/.test(L.sigInfo('SELL',-0.03,0.02,up).why));assert(!/trend/.test(L.sigInfo('BUY',0.03,0.02,{'1h':{d:1},'4h':{d:-1}}).why));var w=L.sigInfo('WAIT',0.005,0.02,up);assert.strictEqual(w.name,'No signal');assert(/under the ±0\.02%/.test(w.why))});
t('plan reason is one line, mentions trend + zone',function(){var w=L.planWhy(1,'S1 pivot',4800,2.1,function(x){return x.toFixed(2)});assert(!/\n/.test(w));assert(/Trend up on 1H\+4H/.test(w)&&/S1 pivot 4800\.00/.test(w)&&/R:R 1:2\.1/.test(w))});
var PW=process.env.GD_PW;
async function authTests(){
 if(!PW){console.log('SKIP auth tests (set GD_PW to run)');return}
 var ok=await L.authCheck('Dan',PW);assert(ok&&ok===L.GD_AUTH.h);n++;console.log('ok auth: correct password');
 assert.strictEqual(await L.authCheck('dan ',PW),ok);n++;console.log('ok auth: username case/space-insensitive');
 assert.strictEqual(await L.authCheck('Dan',PW+'x'),null);assert.strictEqual(await L.authCheck('Dan',PW.toLowerCase()),null);assert.strictEqual(await L.authCheck('Dan',''),null);n++;console.log('ok auth: wrong password rejected');
 assert.strictEqual(await L.authCheck('daniel',PW),null);assert.strictEqual(await L.authCheck('',PW),null);n++;console.log('ok auth: wrong username rejected');
 assert(L.authSessOk({u:'dan',k:L.GD_AUTH.h}));assert(!L.authSessOk({u:'dan',k:'x'}));assert(!L.authSessOk({u:'dan'}));assert(!L.authSessOk(null));n++;console.log('ok auth: stored session must carry the hash');
 assert(src.split(L.GD_AUTH.name).join('').toLowerCase().indexOf(PW.toLowerCase())<0,'no plaintext in source (besides the display name)');assert(/^[0-9a-f]{32}$/.test(L.GD_AUTH.salt)&&L.GD_AUTH.it>=100000);n++;console.log('ok auth: salted PBKDF2, no plaintext in source')}
authTests().then(function(){console.log(n+' tests passed')});
