// node test-planner.js : tests the pure logic block (/*LOGIC*/ ... /*ENDLOGIC*/) of index.html
var fs=require('fs'),assert=require('assert'),src=fs.readFileSync(__dirname+'/index.html','utf8');
var m=src.match(/\/\*LOGIC\*\/([\s\S]*?)\/\*ENDLOGIC\*\//);assert(m,'logic block');
var L=new Function(m[1]+';return{closedRow,groupClose,plSummary,ptFmt,planResultRow,GD_AUTH,authCheck,authSessOk,pnCalc,pushHist,histAdd,histGet,hKey,HCAP,zoneStrat,planWhy,sigInfo,OT}')();var n=0;
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
// ---- past P/L log ----
function rowE(o){var b={sym:'XAUUSD',d:1,lot:0.01,ent:3500,ext:3510,xau:true,dp:2,str:'Manual',ot:Date.UTC(2026,10,20,1,0),t:Date.UTC(2026,10,20,3,30)};for(var k in o)b[k]=o[k];return L.closedRow(b)}
t('P/L BUY win: 10 pts x 0.01 lot = $10',function(){var r=rowE({});assert.strictEqual(r.k,'closed');assert.strictEqual(r.ty,'BUY');assert.strictEqual(r.pts,10);assert.strictEqual(r.pl,10)});
t('P/L BUY loss',function(){var r=rowE({ext:3485.5});assert.strictEqual(r.pts,-14.5);assert.strictEqual(r.pl,-14.5)});
t('P/L SELL win (price down)',function(){var r=rowE({d:-1,ext:3490});assert.strictEqual(r.ty,'SELL');assert.strictEqual(r.pts,10);assert.strictEqual(r.pl,10)});
t('P/L SELL loss (price up)',function(){var r=rowE({d:-1,ext:3520.25});assert.strictEqual(r.pts,-20.25);assert.strictEqual(r.pl,-20.25)});
t('P/L scales with lot (0.05 -> x5) and rounds to cents',function(){assert.strictEqual(rowE({lot:0.05}).pl,50);assert.strictEqual(rowE({lot:0.03,ext:3500.33}).pl,0.99)});
t('P/L breakeven = 0',function(){var r=rowE({ext:3500});assert.strictEqual(r.pts,0);assert.strictEqual(r.pl,0)});
t('non-XAU: points only, no $',function(){var r=rowE({sym:'EURUSD',xau:false,dp:5,ent:1.08,ext:1.0825});assert.strictEqual(r.pts,0.0025);assert.strictEqual(r.pl,null)});
t('row stores strategy, lot, times',function(){var r=rowE({str:'Pivot bounce'});assert.strictEqual(r.str,'Pivot bounce');assert.strictEqual(r.lot,0.01);assert.strictEqual(r.ot,Date.UTC(2026,10,20,1,0));assert.strictEqual(r.t,Date.UTC(2026,10,20,3,30))});
t('ptFmt shows PHT (UTC+8)',function(){assert.strictEqual(L.ptFmt(Date.UTC(2026,10,20,1,0)),'11-20 09:00');assert.strictEqual(L.ptFmt(Date.UTC(2026,10,20,17,5)),'11-21 01:05');assert.strictEqual(L.ptFmt(null),'—')});
t('groupClose: avg entry per side, summed lot',function(){var es=[{d:1,p:3500,lot:0.01,str:'A',ot:1000},{d:1,p:3510,lot:0.01,str:'A',ot:500},{d:-1,p:3520,lot:0.02,str:'B',ot:900}];
 var rs=L.groupClose(es,{sym:'XAUUSD',ext:3515,xau:true,dp:2,t:5000});assert.strictEqual(rs.length,2);var b=rs.filter(function(r){return r.d>0})[0],s=rs.filter(function(r){return r.d<0})[0];
 assert.strictEqual(b.ent,3505);assert.strictEqual(b.lot,0.02);assert.strictEqual(b.pts,10);assert.strictEqual(b.pl,20);assert.strictEqual(b.ot,500);assert.strictEqual(b.str,'A');
 assert.strictEqual(s.ent,3520);assert.strictEqual(s.lot,0.02);assert.strictEqual(s.pts,5);assert.strictEqual(s.pl,10)});
t('groupClose: mixed strategies -> Mixed; missing lot -> 0.01; missing ot ok',function(){var rs=L.groupClose([{d:1,p:100,str:'A'},{d:1,p:102,str:'B'}],{sym:'XAUUSD',ext:101,xau:true,dp:2,t:1});assert.strictEqual(rs.length,1);assert.strictEqual(rs[0].str,'Mixed');assert.strictEqual(rs[0].lot,0.02);assert.strictEqual(rs[0].ot,null);assert.strictEqual(rs[0].ent,101);assert.strictEqual(rs[0].pl,0)});
t('plan result rows: TP1/TP2/SL with R, BUY and SELL',function(){var P={d:1,ent:3500,sl:3490,t1:3515,t2:3530,rk:10,str:'FVG retest',why:'w',fl:1000,lot:0.01};
 var a=L.planResultRow(P,'TP1 hit',{sym:'XAUUSD',xau:true,dp:2,t:2000}),b=L.planResultRow(P,'TP2 hit',{sym:'XAUUSD',xau:true,dp:2,t:2000}),c2=L.planResultRow(P,'SL hit',{sym:'XAUUSD',xau:true,dp:2,t:2000});
 assert.strictEqual(a.ext,3515);assert.strictEqual(a.pl,15);assert.strictEqual(a.r,1.5);assert.strictEqual(a.res,'TP1');assert.strictEqual(b.pl,30);assert.strictEqual(b.r,3);assert.strictEqual(c2.ext,3490);assert.strictEqual(c2.pl,-10);assert.strictEqual(c2.r,-1);assert.strictEqual(c2.res,'SL');assert.strictEqual(c2.ot,1000);assert.strictEqual(c2.str,'FVG retest');
 var S={d:-1,ent:3500,sl:3510,t1:3485,t2:3470,rk:10,str:'Pivot bounce',lot:0.02},s1=L.planResultRow(S,'TP2 hit',{sym:'XAUUSD',xau:true,dp:2,t:1}),s2=L.planResultRow(S,'SL hit',{sym:'XAUUSD',xau:true,dp:2,t:1});assert.strictEqual(s1.pl,60);assert.strictEqual(s1.r,3);assert.strictEqual(s2.pl,-20);assert.strictEqual(s2.r,-1);assert.strictEqual(s2.ty,'SELL')});
t('summary: total, wins, losses, win rate; planner rows excluded',function(){var rows=[rowE({}),rowE({ext:3485.5}),rowE({d:-1,ext:3490}),rowE({ext:3500}),{k:'calc',ty:'BUY LIMIT'},{k:'plan',ty:'BUY LIMIT'}],s=L.plSummary(rows);
 assert.strictEqual(s.n,4);assert.strictEqual(s.total,5.5);assert.strictEqual(s.wins,2);assert.strictEqual(s.losses,1);assert.strictEqual(s.flat,1);assert.strictEqual(s.rate,2/3)});
t('summary: empty, and non-XAU rows count by points but not in $ total',function(){var e=L.plSummary([]);assert.strictEqual(e.n,0);assert.strictEqual(e.total,0);assert.strictEqual(e.rate,null);
 var s=L.plSummary([rowE({}),rowE({sym:'EURUSD',xau:false,dp:5,ent:1.08,ext:1.07})]);assert.strictEqual(s.total,10);assert.strictEqual(s.wins,1);assert.strictEqual(s.losses,1);assert.strictEqual(s.noUsd,1)});
t('P/L log obeys the 30 cap, newest first, summary only over stored rows',function(){var st=mem();for(var i=1;i<=35;i++)L.histAdd(st,'dan',rowE({ext:3500+i,t:i}));var a=L.histGet(st,'dan');assert.strictEqual(a.length,30);assert.strictEqual(a[0].pts,35);assert.strictEqual(a[29].pts,6);
 var s=L.plSummary(a);assert.strictEqual(s.n,30);assert.strictEqual(s.wins,30);var tot=0;for(var j=6;j<=35;j++)tot+=j;assert.strictEqual(s.total,+tot.toFixed(2))});
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
