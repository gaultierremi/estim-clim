(function(){
  "use strict";
  var euro = new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0});
  var euro2 = new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
  var STORAGE_KEY = 'estimclim_pro_v1';
  var UID = function(){ return Math.random().toString(36).slice(2,9); };

  /* ---------------- default / seed state ---------------- */
  function seed(){
    return {
      company:{
        name:'Reno.energy', addr:'Rue de Tilff, 4031 Angleur', phone:'078 15 20 00',
        email:'', vatNr:'', logo:null, validity:30, quotePrefix:'DEV-2026-',
        footer:"Devis indicatif sous réserve de visite technique. Clim réversible (PAC air-air) : non éligible aux primes wallonnes. TVA réduite à 6 % sur fourniture + pose des pompes à chaleur et climatisations réversibles (tous logements, 01/01/2026 → 31/12/2030)."
      },
      catalog:[
        {id:UID(), brand:'Daikin', model:'Stylish', type:'mural', kw:2.0, energy:'A+++', price:1150},
        {id:UID(), brand:'Daikin', model:'Stylish', type:'mural', kw:2.5, energy:'A+++', price:1250},
        {id:UID(), brand:'Daikin', model:'Sensira', type:'mural', kw:3.5, energy:'A++', price:1050},
        {id:UID(), brand:'Mitsubishi', model:'MSZ-AP', type:'mural', kw:2.5, energy:'A+++', price:1200},
        {id:UID(), brand:'Mitsubishi', model:'MSZ-LN', type:'mural', kw:5.0, energy:'A+++', price:1750},
        {id:UID(), brand:'Panasonic', model:'Etherea', type:'mural', kw:3.5, energy:'A+++', price:1300},
        {id:UID(), brand:'Panasonic', model:'Console Z', type:'console', kw:3.5, energy:'A++', price:1450},
        {id:UID(), brand:'Daikin', model:'Cassette FFA', type:'cassette', kw:5.0, energy:'A++', price:1950},
        {id:UID(), brand:'Daikin', model:'Gainable FBA', type:'gainable', kw:6.0, energy:'A+', price:2300}
      ],
      outdoors:[
        {id:UID(), brand:'Daikin', model:'Mono 2.5', kw:2.5, ports:1, price:900},
        {id:UID(), brand:'Daikin', model:'Mono 3.5', kw:3.5, ports:1, price:1050},
        {id:UID(), brand:'Mitsubishi', model:'Multi 2 sorties', kw:5.0, ports:2, price:1700},
        {id:UID(), brand:'Daikin', model:'Multi 4 sorties', kw:8.0, ports:4, price:2600},
        {id:UID(), brand:'Daikin', model:'Multi 5 sorties', kw:10.0, ports:5, price:3100}
      ],
      labour:{ pose:{mural:600, console:700, cassette:900, gainable:1200}, miseEnService:150, liaisonPerM:45, liaisonDefaultM:5, diversPct:8, techPrices:newTechPrices() },
      extras:[
        {id:UID(), name:'Dépose ancien appareil', price:150},
        {id:UID(), name:'Pompe de relevage des condensats', price:220},
        {id:UID(), name:'Carottage supplémentaire', price:90},
        {id:UID(), name:'Cache liaison décoratif (par m)', price:35},
        {id:UID(), name:'Support / protection groupe extérieur', price:120}
      ],
      primes:{ base:600, mult:{R1:6,R2:4,R3:2,R4:1.5}, capPct:{R1:70,R2:70,R3:50,R4:50}, minAgeYears:15, requiresAudit:true },
      finance:{ acomptePct:30, paymentTerms:'Acompte à la commande, solde à la fin des travaux. Devis valable selon la durée indiquée, sous réserve de visite technique.', cgv:'' },
      savings:{ fossilPrice:0.11, fossilEff:0.9, pacPrice:0.30, scop:3.8 },
      settings:{ vat:6, quoteCounter:1 },
      quote: newQuote(),
      plan: newPlan(),
      savedQuotes:[],
      ui:{ tab:'devis', adminSection:'societe', clientPrices:true, clientView:false, planSel:null }
    };
  }
  function newQuote(){
    return {
      client:{name:'', addr:'', phone:'', email:''},
      date:new Date().toISOString().slice(0,10),
      projectType:'clim', incomeCat:'none', annualKwh:0,
      rooms:[ newRoom('Séjour') ],
      outdoorId:null, extraLines:[], remise:0
    };
  }
  function newRoom(name){
    return {id:UID(), name:name||'Pièce', surface:20, height:2.5, ori:'sud', glz:'moyen', iso:'moyenne', roof:false, occ:2, charge:'aucune', productId:null, liaisonM:null, tech:newTech()};
  }
  // Relevé de pose par unité intérieure. Aucune donnée de sécurité en dur : les seuils/diamètres
  // proviennent du catalogue (saisis par l'utilisateur) ; ici, uniquement le relevé terrain.
  function newTech(){
    return {
      liaisonLen:0, deniv:0, diamLiquide:'', diamGaz:'',
      condensats:'gravite', evacLen:0,
      goulotteLen:0, goulotteSection:'',
      trouDiam:60, trouNb:1, trouNote:'',
      support:'equerres', elecNote:'', elecAmeneeLen:0,
      elevation:null
    };
  }
  function ensureRoomTech(r){
    if(!r.tech || typeof r.tech!=='object'){ r.tech=newTech(); return r.tech; }
    var d=newTech(); for(var k in d){ if(!(k in r.tech)) r.tech[k]=d[k]; }
    return r.tech;
  }
  function ensureQuoteTech(q){ if(q && Array.isArray(q.rooms)) q.rooms.forEach(ensureRoomTech); return q; }
  // Tarifs des fournitures techniques (€). Livrés à 0 (aucune valeur en dur) ; éditables en Réglages.
  function newTechPrices(){ return { goulotteM:0, carottage:0, pompe:0, evacM:0, support:0, elecM:0 }; }
  function ensureTechPrices(){ if(!state.labour.techPrices) state.labour.techPrices={}; var d=newTechPrices(); for(var k in d){ if(state.labour.techPrices[k]==null) state.labour.techPrices[k]=d[k]; } return state.labour.techPrices; }
  function newPlan(){ return { wcm:1000, hcm:700, grid:50, snap:25, rooms:[], items:[], tech:newPlanTech() }; }
  function newPlanTech(){ return { goulottes:[], trous:[] }; }
  function ensurePlanTech(p){ if(p && (!p.tech || typeof p.tech!=='object')) p.tech=newPlanTech(); else if(p && p.tech){ if(!Array.isArray(p.tech.goulottes)) p.tech.goulottes=[]; if(!Array.isArray(p.tech.trous)) p.tech.trous=[]; } return p; }
  var PLAN_ITEMS = {
    mural:   {label:'Split mural', w:90,  h:28, fill:'#e6f5f6', stroke:'#0e9aa8', cat:'indoor'},
    console: {label:'Console',     w:80,  h:50, fill:'#e6f5f6', stroke:'#0e9aa8', cat:'indoor'},
    cassette:{label:'Cassette',    w:62,  h:62, fill:'#e6f5f6', stroke:'#0e9aa8', cat:'indoor'},
    gainable:{label:'Gainable',    w:110, h:34, fill:'#eef7e9', stroke:'#2f8f5b', cat:'indoor'},
    outdoor: {label:'Groupe ext.', w:86,  h:56, fill:'#fbf0e0', stroke:'#c9760f', cat:'outdoor'}
  };
  var planCanvasWrap, planSideHost;
  var techDraft=[];      // points de la goulotte en cours de tracé (transient, non persisté)
  var lastTrouDiam=60;   // dernier Ø de trou utilisé (mm)

  var TYPES = [['mural','Murale'],['console','Console'],['cassette','Cassette plafond'],['gainable','Gainable']];
  var typeLabel = function(t){ var m={mural:'Murale',console:'Console',cassette:'Cassette',gainable:'Gainable'}; return m[t]||t; };

  /* ---------------- state load/save ---------------- */
  var state;
  function load(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(raw){ var s = JSON.parse(raw); state = mergeDefaults(s); storageOK = true; return; }
    }catch(e){ storageOK = false; }
    state = seed();
    if(storageOK===undefined) storageOK=true;
  }
  var storageOK;
  function mergeDefaults(s){
    var d = seed();
    s = s||{};
    d.company = Object.assign(d.company, s.company||{});
    if(Array.isArray(s.catalog)) d.catalog = s.catalog;
    if(Array.isArray(s.outdoors)) d.outdoors = s.outdoors;
    if(s.labour){ d.labour = Object.assign(d.labour, s.labour); if(s.labour.pose) d.labour.pose = Object.assign(d.labour.pose, s.labour.pose); d.labour.techPrices = Object.assign(newTechPrices(), s.labour.techPrices||{}); }
    if(Array.isArray(s.extras)) d.extras = s.extras;
    if(s.settings) d.settings = Object.assign(d.settings, s.settings);
    if(s.quote) d.quote = Object.assign(newQuote(), s.quote);
    ensureQuoteTech(d.quote);
    if(s.plan) d.plan = Object.assign(newPlan(), s.plan);
    ensurePlanTech(d.plan);
    if(s.primes){ d.primes=Object.assign(d.primes,s.primes); if(s.primes.mult)d.primes.mult=Object.assign(d.primes.mult,s.primes.mult); if(s.primes.capPct)d.primes.capPct=Object.assign(d.primes.capPct,s.primes.capPct); }
    if(s.finance) d.finance=Object.assign(d.finance,s.finance);
    if(s.savings) d.savings=Object.assign(d.savings,s.savings);
    if(Array.isArray(s.savedQuotes)) d.savedQuotes = s.savedQuotes;
    d.savedQuotes.forEach(function(sq){ if(sq && sq.data) ensureQuoteTech(sq.data); });
    return d;
  }
  var saveTimer;
  function save(){
    setSaveState(true,'Enregistrement…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function(){
      try{
        var copy = Object.assign({}, state); delete copy.ui;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
        setSaveState(true,'Enregistré');
      }catch(e){ setSaveState(false,'Session uniquement'); }
    }, 250);
  }
  function setSaveState(ok, txt){
    var s = document.getElementById('saveState');
    s.classList.toggle('off', !ok);
    document.getElementById('saveTxt').textContent = txt;
  }

  /* ---------------- sizing engine ---------------- */
  var BASE_W={bonne:55,moyenne:75,faible:95}, ORI={nord:1.00,est:1.05,ouest:1.10,sud:1.15}, GLZ={faible:1.00,moyen:1.05,eleve:1.15}, CHARGE={aucune:0,moderee:300,elevee:800};
  var LADDER=[2.0,2.5,3.5,5.0,6.0,7.1];
  function pickLadder(kw){ for(var i=0;i<LADDER.length;i++){ if(LADDER[i]>=kw-0.05) return LADDER[i]; } return LADDER[LADDER.length-1]; }
  function computeRoom(r){
    var s=Math.max(0,+r.surface||0), h=Math.max(2.2,+r.height||2.5);
    var base=BASE_W[r.iso]||75, oriF=ORI[r.ori]||1.10, glzF=GLZ[r.glz]||1.05, roofF=r.roof?1.10:1.0, heightF=h>2.5?(h/2.5):1.0;
    var env=s*base*oriF*glzF*roofF*heightF, occ=Math.max(0,(+r.occ||0)-2)*100, ch=CHARGE[r.charge]||0;
    var loadW=env+occ+ch, kW=loadW/1000;
    return {loadW:loadW,kW:kW,reco:pickLadder(kW),base:base,oriF:oriF,glzF:glzF,roofF:roofF,heightF:heightF,occ:occ,charge:ch};
  }
  function getProduct(id){ for(var i=0;i<state.catalog.length;i++) if(state.catalog[i].id===id) return state.catalog[i]; return null; }
  function getOutdoor(id){ for(var i=0;i<state.outdoors.length;i++) if(state.outdoors[i].id===id) return state.outdoors[i]; return null; }
  function roomCapacity(r){ var p=getProduct(r.productId); return p? (+p.kw||0) : computeRoom(r).reco; }
  function suggestOutdoor(){
    var n=state.quote.rooms.length; if(n===0) return null;
    var div = n>1?0.85:1.0;
    var need = state.quote.rooms.reduce(function(a,r){return a+roomCapacity(r);},0)*div;
    var cands = state.outdoors.filter(function(o){return (+o.kw||0)>=need-0.1 && (+o.ports||1)>=n;})
                              .sort(function(a,b){return (+a.kw)-(+b.kw);});
    return cands[0]||null;
  }
  function activeOutdoor(){
    if(state.quote.outdoorId){ var o=getOutdoor(state.quote.outdoorId); if(o) return {unit:o, auto:false}; }
    var s=suggestOutdoor(); return {unit:s, auto:true};
  }
  function computeTotals(){
    var q=state.quote, L=state.labour, n=q.rooms.length;
    var indoor=0, pose=0, liaison=0, needKW=0;
    q.rooms.forEach(function(r){
      var p=getProduct(r.productId); indoor += p?(+p.price||0):0;
      var t = p?p.type:'mural'; pose += (+L.pose[t]||0);
      var m = (r.liaisonM===null||r.liaisonM==='')? (+L.liaisonDefaultM||0) : (+r.liaisonM||0);
      liaison += m*(+L.liaisonPerM||0);
      needKW += roomCapacity(r);
    });
    if(n>0) pose += (+L.miseEnService||0);
    var ao=activeOutdoor(); var outdoor = ao.unit?(+ao.unit.price||0):0;
    var extras=0;
    q.extraLines.forEach(function(line){
      if(line.origin==='tech'){ extras += (+line.unitPrice||0)*(+line.qty||0); return; }
      var e=state.extras.filter(function(x){return x.id===line.extraId;})[0]; if(e) extras += (+e.price||0)*(+line.qty||0);
    });
    var subtotal = indoor+outdoor+pose+liaison+extras;
    var divers = subtotal*((+L.diversPct||0)/100);
    var htvaBrut = subtotal+divers;
    var remise = Math.max(0, +q.remise||0);
    var htva = Math.max(0, htvaBrut - remise);
    var vat = htva*(state.settings.vat/100);
    var tvac = htva+vat;
    return {n:n, needKW:needKW, indoor:indoor, outdoor:outdoor, outdoorUnit:ao.unit, outdoorAuto:ao.auto, pose:pose, liaison:liaison, extras:extras, divers:divers, remise:remise, htva:htva, vat:vat, tvac:tvac, system:(n<=1?'Mono-split':'Multi-split '+n)};
  }

  function computePrime(){
    var q=state.quote, t=computeTotals(), P=state.primes;
    if(q.projectType!=='chauffage') return {eligible:false, amount:0, reason:'Climatisation réversible (PAC air-air) : non éligible aux primes wallonnes.'};
    if(!q.incomeCat || q.incomeCat==='none') return {eligible:false, amount:0, reason:'Catégorie de revenus non renseignée, ou revenus > 122 800 € (R5, non éligible).'};
    var base=(+P.base||0)*(+(P.mult[q.incomeCat])||0);
    var cap=t.tvac*((+(P.capPct[q.incomeCat])||0)/100);
    var amount=Math.max(0, Math.min(base, cap));
    return {eligible:true, amount:amount, base:base, cap:cap, reason:'Prime Habitation estimée (PAC air-eau, cat. '+q.incomeCat+'). Audit logement requis avant travaux, logement de plus de '+P.minAgeYears+' ans. Montant à confirmer sur logement.wallonie.be.'};
  }
  function computeFinance(){
    var t=computeTotals(), pr=computePrime();
    var reste=Math.max(0, t.tvac - pr.amount);
    var acompte=t.tvac*((+state.finance.acomptePct||0)/100);
    return {tvac:t.tvac, htva:t.htva, prime:pr, reste:reste, acompte:acompte, solde:t.tvac-acompte};
  }
  function computeROI(){
    var q=state.quote, S=state.savings; var kwh=+q.annualKwh||0;
    if(kwh<=0 || q.projectType!=='chauffage') return null;
    var perKwh=((+S.fossilPrice||0)/((+S.fossilEff||0.9))) - ((+S.pacPrice||0)/((+S.scop||1)));
    var annual=kwh*perKwh; var fin=computeFinance();
    return {annual:annual, payback:(annual>0? fin.reste/annual : null)};
  }

  /* ---------------- DOM helpers ---------------- */
  function el(tag,attrs,kids){ var n=document.createElement(tag); if(attrs) for(var k in attrs){ if(k==='class')n.className=attrs[k]; else if(k==='html')n.innerHTML=attrs[k]; else n.setAttribute(k,attrs[k]); } (kids||[]).forEach(function(c){ n.appendChild(typeof c==='string'?document.createTextNode(c):c); }); return n; }
  function opt(v,l,sel){ var o=el('option',{value:v}); o.textContent=l; if(sel)o.selected=true; return o; }
  function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  /* ---------------- view router ---------------- */
  var viewEl=document.getElementById('view');
  function render(){
    if(threeCleanup){ try{threeCleanup();}catch(e){} threeCleanup=null; }
    setTab();
    viewEl.innerHTML='';
    if(state.ui.tab==='devis') viewEl.appendChild(renderDevis());
    else if(state.ui.tab==='plan') viewEl.appendChild(renderPlan());
    else if(state.ui.tab==='technique') viewEl.appendChild(renderTechnique());
    else if(state.ui.tab==='3d') viewEl.appendChild(renderThreeD());
    else if(state.ui.tab==='dash') viewEl.appendChild(renderDash());
    else viewEl.appendChild(renderAdmin());
  }
  function setTab(){
    document.getElementById('tab-devis').setAttribute('aria-selected', state.ui.tab==='devis');
    document.getElementById('tab-plan').setAttribute('aria-selected', state.ui.tab==='plan');
    document.getElementById('tab-technique').setAttribute('aria-selected', state.ui.tab==='technique');
    document.getElementById('tab-3d').setAttribute('aria-selected', state.ui.tab==='3d');
    document.getElementById('tab-dash').setAttribute('aria-selected', state.ui.tab==='dash');
    document.getElementById('tab-admin').setAttribute('aria-selected', state.ui.tab==='admin');
    document.getElementById('printBtn').style.display = (state.ui.tab==='devis'||state.ui.tab==='plan') ? '' : 'none';
  }

  /* ============================================================
     DEVIS VIEW
     ============================================================ */
  function renderDevis(){
    var wrap=el('div',{class:'layout'});
    var left=el('div',{class:'stack'});

    // client + meta
    var c1=el('div',{class:'card'}); var p1=el('div',{class:'pad'});
    p1.appendChild(el('div',{class:'eyebrow'},['Étape 1']));
    p1.appendChild(el('h2',{class:'section-title'},['Client & devis']));
    var clientGrid=el('div',{class:'grid g2',style:'margin-top:14px'});
    clientGrid.appendChild(textField('Client', state.quote.client.name, 'Nom du client', function(v){state.quote.client.name=v; save();}));
    clientGrid.appendChild(textField('Téléphone', state.quote.client.phone, '', function(v){state.quote.client.phone=v; save();}));
    p1.appendChild(clientGrid);
    var clientGrid2=el('div',{class:'grid g2',style:'margin-top:12px'});
    clientGrid2.appendChild(textField('Adresse du bien', state.quote.client.addr, 'Rue, code postal, commune', function(v){state.quote.client.addr=v; save();}));
    clientGrid2.appendChild(textField('Email', state.quote.client.email, '', function(v){state.quote.client.email=v; save();}));
    p1.appendChild(clientGrid2);
    var dateField=el('input',{type:'date',style:'max-width:200px'}); dateField.value=state.quote.date;
    dateField.addEventListener('input',function(){state.quote.date=dateField.value; save();});
    p1.appendChild(el('label',{class:'field',style:'margin-top:12px; max-width:220px'},[el('span',null,['Date']), dateField]));
    c1.appendChild(p1); left.appendChild(c1);

    // projet & prime
    var cp=el('div',{class:'card'}); var pp=el('div',{class:'pad'});
    pp.appendChild(el('div',{class:'eyebrow'},['Type de projet & aides']));
    pp.appendChild(el('h2',{class:'section-title',style:'margin-bottom:4px'},['Projet & prime']));
    var segP=el('div',{class:'seg',style:'margin-top:12px'});
    var bClim=el('button',{},['Climatisation (air-air)']); bClim.setAttribute('aria-pressed', state.quote.projectType==='clim');
    var bChauf=el('button',{},['PAC air-eau (chauffage)']); bChauf.setAttribute('aria-pressed', state.quote.projectType==='chauffage');
    bClim.addEventListener('click',function(){ state.quote.projectType='clim'; bClim.setAttribute('aria-pressed','true'); bChauf.setAttribute('aria-pressed','false'); refreshDevis(); save(); });
    bChauf.addEventListener('click',function(){ state.quote.projectType='chauffage'; bChauf.setAttribute('aria-pressed','true'); bClim.setAttribute('aria-pressed','false'); refreshDevis(); save(); });
    segP.appendChild(bClim); segP.appendChild(bChauf); pp.appendChild(segP);
    var grcat=el('div',{class:'grid g2',style:'margin-top:12px'});
    grcat.appendChild(selField('Catégorie de revenus (Wallonie)', state.quote.incomeCat, [['none','Non concerné / R5 (non éligible)'],['R1','R1'],['R2','R2'],['R3','R3'],['R4','R4']], function(v){ state.quote.incomeCat=v; refreshDevis(); save(); }));
    grcat.appendChild(numField('Conso. chauffage actuelle (kWh/an)', state.quote.annualKwh, '100', function(v){ state.quote.annualKwh=v; refreshDevis(); save(); }));
    pp.appendChild(grcat);
    pp.appendChild(el('div',{class:'reco',id:'projetHint',style:'margin-top:8px'}));
    cp.appendChild(pp); left.appendChild(cp);

    // rooms
    var c2=el('div',{class:'card'}); var p2=el('div',{class:'pad'});
    p2.appendChild(el('div',{class:'eyebrow'},['Étape 2']));
    p2.appendChild(el('h2',{class:'section-title'},['Pièces & matériel']));
    p2.appendChild(el('p',{class:'section-sub'},['La puissance se calcule en direct ; choisis ensuite l\u2019unité dans ton catalogue.']));
    var roomsBox=el('div',{class:'rooms',id:'roomsBox'});
    state.quote.rooms.forEach(function(r){ roomsBox.appendChild(buildRoomCard(r)); });
    p2.appendChild(roomsBox);
    var addBtn=el('button',{class:'add-row'},['＋ Ajouter une pièce']);
    addBtn.addEventListener('click',function(){ var r=newRoom(); autoSelectProduct(r); state.quote.rooms.push(r); roomsBox.appendChild(buildRoomCard(r)); reindexRooms(); refreshDevis(); save(); });
    p2.appendChild(addBtn);
    c2.appendChild(p2); left.appendChild(c2);

    // outdoor + extras + remise
    var c3=el('div',{class:'card'}); var p3=el('div',{class:'pad'});
    p3.appendChild(el('div',{class:'eyebrow'},['Étape 3']));
    p3.appendChild(el('h2',{class:'section-title'},['Groupe extérieur & options']));
    // outdoor select
    var outSel=el('select',{id:'outSel'});
    outSel.appendChild(opt('','Auto (suggéré)', !state.quote.outdoorId));
    state.outdoors.forEach(function(o){ outSel.appendChild(opt(o.id, o.brand+' '+o.model+' — '+fmtKw(o.kw)+' / '+o.ports+' sorties — '+euro.format(o.price), state.quote.outdoorId===o.id)); });
    outSel.addEventListener('change',function(){ state.quote.outdoorId = outSel.value||null; refreshDevis(); save(); });
    p3.appendChild(el('label',{class:'field',style:'margin-top:14px'},[el('span',null,['Groupe extérieur']), outSel]));
    p3.appendChild(el('div',{class:'reco',id:'outHint',style:'margin-top:6px'}));

    // extras
    p3.appendChild(el('div',{style:'margin-top:16px',class:'total-label'},['Prestations supplémentaires']));
    var extrasBox=el('div',{id:'extrasBox',style:'margin-top:8px'});
    p3.appendChild(extrasBox);
    rebuildExtras(extrasBox);
    var addExtra=el('select',{style:'margin-top:10px; max-width:340px'});
    addExtra.appendChild(opt('','+ Ajouter une prestation…',true));
    state.extras.forEach(function(e){ addExtra.appendChild(opt(e.id, e.name+' — '+euro.format(e.price))); });
    addExtra.addEventListener('change',function(){
      if(!addExtra.value) return;
      var existing = state.quote.extraLines.filter(function(l){return l.extraId===addExtra.value;})[0];
      if(existing) existing.qty=(+existing.qty||0)+1; else state.quote.extraLines.push({extraId:addExtra.value, qty:1});
      addExtra.value=''; rebuildExtras(document.getElementById('extrasBox')); refreshDevis(); save();
    });
    p3.appendChild(addExtra);

    // remise
    var remiseInp=el('input',{type:'number',min:'0',step:'10'}); remiseInp.value=state.quote.remise||0;
    remiseInp.addEventListener('input',function(){ state.quote.remise=remiseInp.value; refreshDevis(); save(); });
    p3.appendChild(el('label',{class:'field',style:'margin-top:16px; max-width:220px'},[el('span',null,['Remise (€ HTVA)']), el('div',{class:'input-eur'},[remiseInp])]));

    c3.appendChild(p3); left.appendChild(c3);

    wrap.appendChild(left);

    // RIGHT: summary + reminders + save
    var right=el('div');
    right.appendChild(buildSummary());
    right.appendChild(buildReminders());
    right.appendChild(buildSavePanel());
    wrap.appendChild(right);

    // initial compute after mount
    setTimeout(refreshDevis,0);
    return wrap;
  }

  function fmtKw(k){ return (Math.round((+k||0)*10)/10).toString().replace('.',',')+' kW'; }

  function indoorMurals(){ return state.catalog.filter(function(p){return p.type==='mural';}).sort(function(a,b){return (+a.kw||0)-(+b.kw||0);}); }
  function suggestIndoor(reco){
    var murals=indoorMurals();
    return murals.filter(function(p){return (+p.kw||0)>=reco-0.05;})[0] || murals[0] || state.catalog[0] || null;
  }
  function autoSelectProduct(r){
    var pick=suggestIndoor(computeRoom(r).reco);
    r.productId = pick? pick.id : null;
  }
  // Suggestion AR : même moteur de charge (computeRoom → reco) que le devis ; on prend la plus petite
  // unité ≥ besoin. Si rien d'assez puissant : la plus grande, avec enough=false (multi-split hors périmètre).
  function suggestIndoorForAR(reco){
    var murals=indoorMurals();
    if(!murals.length) murals=state.catalog.slice().sort(function(a,b){return (+a.kw||0)-(+b.kw||0);});
    if(!murals.length) return {product:null, enough:false};
    var fit=murals.filter(function(p){return (+p.kw||0)>=reco-0.05;})[0];
    if(fit) return {product:fit, enough:true};
    return {product:murals[murals.length-1], enough:false};
  }

  function buildRoomCard(r){
    if(r.productId && !getProduct(r.productId)) r.productId=null;
    if(r.productId===null) autoSelectProduct(r);
    var card=el('div',{class:'room','data-id':r.id});
    var nameInp=el('input'); nameInp.value=r.name; nameInp.placeholder='Nom de la pièce';
    nameInp.addEventListener('input',function(){ r.name=nameInp.value; save(); });
    var del=el('button',{class:'icon-btn','aria-label':'Supprimer la pièce',title:'Supprimer'},[]);
    del.innerHTML='<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6.5 4V2.8h3V4M5 4l.6 9h4.8L11 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    del.addEventListener('click',function(){ state.quote.rooms=state.quote.rooms.filter(function(x){return x.id!==r.id;}); card.remove(); reindexRooms(); refreshDevis(); save(); });
    var idx=el('div',{class:'room-idx'},['•']);
    var head=el('div',{class:'room-head'},[idx, el('div',{class:'room-name'},[nameInp]), del]);

    var grid=el('div',{class:'room-grid'},[
      numField('Surface (m²)', r.surface,'1',function(v){r.surface=v; refreshRoom(card,r); refreshDevis(); save();}),
      numField('Hauteur (m)', r.height,'0.1',function(v){r.height=v; refreshRoom(card,r); refreshDevis(); save();}),
      selField('Exposition', r.ori,[['nord','Nord'],['est','Est'],['ouest','Ouest'],['sud','Sud']],function(v){r.ori=v; refreshRoom(card,r); refreshDevis(); save();}),
      selField('Vitrage', r.glz,[['faible','Faible'],['moyen','Moyen'],['eleve','Élevé']],function(v){r.glz=v; refreshRoom(card,r); refreshDevis(); save();}),
      selField('Isolation', r.iso,[['bonne','Bonne'],['moyenne','Moyenne'],['faible','Faible']],function(v){r.iso=v; refreshRoom(card,r); refreshDevis(); save();}),
      numField('Occupants', r.occ,'1',function(v){r.occ=v; refreshRoom(card,r); refreshDevis(); save();}),
      selField('Charges', r.charge,[['aucune','Aucune'],['moderee','Modérée'],['elevee','Élevée']],function(v){r.charge=v; refreshRoom(card,r); refreshDevis(); save();}),
      liaisonField(r)
    ]);

    var roofChk=el('input',{type:'checkbox'}); roofChk.checked=!!r.roof;
    roofChk.addEventListener('change',function(){ r.roof=roofChk.checked; refreshRoom(card,r); refreshDevis(); save(); });
    var roof=el('label',{class:'check'},[roofChk, el('span',null,['Dernier étage / sous toiture'])]);

    // product selector
    var prodSel=el('select');
    rebuildProductOptions(prodSel, r);
    prodSel.addEventListener('change',function(){ r.productId=prodSel.value||null; refreshRoom(card,r); refreshDevis(); save(); });
    var prodWrap=el('label',{class:'field'},[el('span',null,['Unité intérieure (catalogue)']), prodSel]);

    var result=el('div',{class:'room-result'});
    var resKW=el('div',{class:'kw num'});
    var resRight=el('div'); var reco=el('div',{class:'reco'}); var bd=el('div',{class:'breakdown'});
    resRight.appendChild(reco); resRight.appendChild(bd);
    result.appendChild(el('div',null,[el('div',{class:'total-label'},['Besoin estimé']), resKW]));
    result.appendChild(resRight);

    card._idx=idx; card._resKW=resKW; card._reco=reco; card._bd=bd; card._prodSel=prodSel; card._room=r;

    card.appendChild(head);
    card.appendChild(el('div',{class:'room-body'},[grid, roof, prodWrap, result]));
    refreshRoom(card,r);
    return card;
  }
  function liaisonField(r){
    var inp=el('input',{type:'number',min:'0',step:'1',placeholder:String(state.labour.liaisonDefaultM)});
    if(r.liaisonM!==null && r.liaisonM!=='') inp.value=r.liaisonM;
    inp.addEventListener('input',function(){ r.liaisonM = inp.value===''?null:inp.value; refreshDevis(); save(); });
    return el('label',{class:'field'},[el('span',null,['Liaison (m)']), inp]);
  }
  function rebuildProductOptions(sel, r){
    sel.innerHTML='';
    var reco=computeRoom(r).reco;
    var list=state.catalog.slice().sort(function(a,b){ return Math.abs(a.kw-reco)-Math.abs(b.kw-reco) || a.kw-b.kw; });
    sel.appendChild(opt('','— Aucune —', !r.productId));
    list.forEach(function(p){
      var near = Math.abs(p.kw-reco)<=0.6 ? ' ✓' : '';
      sel.appendChild(opt(p.id, p.brand+' '+p.model+' '+fmtKw(p.kw)+' ['+typeLabel(p.type)+'] — '+euro.format(p.price)+near, r.productId===p.id));
    });
  }
  function refreshRoom(card, r){
    var c=computeRoom(r);
    card._resKW.innerHTML = c.kW.toFixed(1).replace('.',',')+' <small>kW</small>';
    var p=getProduct(r.productId);
    var msg;
    if(p){
      var diff=(+p.kw)-c.reco;
      var ok = (+p.kw)>=c.reco-0.05;
      msg = 'Choisi : <b>'+escapeHtml(p.brand+' '+p.model)+'</b> ('+fmtKw(p.kw)+'). ' + (ok? 'Capacité adaptée.' : '<span style="color:var(--warm)">Sous-dimensionné vs '+fmtKw(c.reco)+'.</span>');
    } else {
      msg = 'Unité conseillée : <b>'+fmtKw(c.reco)+'</b>'+(c.kW>7.1?' — pièce volumineuse, envisager 2 unités/gainable.':'');
    }
    card._reco.innerHTML = msg;
    card._bd.textContent = (+r.surface||0)+' m² × '+c.base+' W/m² × expo '+c.oriF+' × vitrage '+c.glzF + (c.roofF>1?' × toiture '+c.roofF:'') + (c.heightF>1?' × h '+c.heightF.toFixed(2):'') + (c.occ>0?' + '+c.occ+'W occ.':'') + (c.charge>0?' + '+c.charge+'W charges':'');
  }
  function reindexRooms(){ document.querySelectorAll('#roomsBox .room').forEach(function(c,i){ c._idx.textContent=i+1; }); }

  function rebuildExtras(box){
    box.innerHTML='';
    if(state.quote.extraLines.length===0){ box.appendChild(el('div',{class:'reco',style:'color:var(--muted-2)'},['Aucune prestation ajoutée.'])); return; }
    state.quote.extraLines.forEach(function(line){
      if(line.origin==='tech'){
        var trow=el('div',{class:'saved-item',style:'margin-top:8px'});
        var untar=(+line.unitPrice||0)===0;
        var tmeta=el('div',{class:'meta'},[ el('b',null,[line.label]), el('span',null,[techRound1(line.qty)+' '+(line.unit||'')+' × '+euro.format(line.unitPrice||0)+(untar?'  · non tarifé':'')]) ]);
        var ttag=el('span',{class:'badge-confirm'},['Technique']);
        var trm=el('button',{class:'icon-btn','aria-label':'Retirer'},[]); trm.innerHTML='✕';
        trm.addEventListener('click',function(){ state.quote.extraLines=state.quote.extraLines.filter(function(l){return l!==line;}); rebuildExtras(box); refreshDevis(); save(); });
        trow.appendChild(tmeta); trow.appendChild(ttag); trow.appendChild(trm); box.appendChild(trow); return;
      }
      var e=state.extras.filter(function(x){return x.id===line.extraId;})[0]; if(!e) return;
      var row=el('div',{class:'saved-item',style:'margin-top:8px'});
      var meta=el('div',{class:'meta'},[el('b',null,[e.name]), el('span',null,[euro.format(e.price)+' / unité'])]);
      var qty=el('input',{type:'number',min:'1',step:'1',style:'width:64px'}); qty.value=line.qty;
      qty.addEventListener('input',function(){ line.qty=qty.value; refreshDevis(); save(); });
      var rm=el('button',{class:'icon-btn','aria-label':'Retirer'},[]); rm.innerHTML='✕';
      rm.addEventListener('click',function(){ state.quote.extraLines=state.quote.extraLines.filter(function(l){return l!==line;}); rebuildExtras(box); refreshDevis(); save(); });
      row.appendChild(meta); row.appendChild(qty); row.appendChild(rm);
      box.appendChild(row);
    });
  }

  function buildSummary(){
    var c=el('div',{class:'card summary',id:'summary'});
    c.innerHTML =
      '<div class="sum-head"><div class="total-label">Total estimé TVAC</div><div class="total-tvac num" id="s_tvac">—</div></div>'+
      '<div class="pill-row"><span class="pill cool" id="s_kw">0 kW</span><span class="pill" id="s_units">0 unité</span><span class="pill" id="s_system">—</span></div>'+
      '<div class="sum-div"></div>'+
      '<div class="sum-line"><span>Matériel — unités int.</span><span class="v num" id="s_indoor">—</span></div>'+
      '<div class="sum-line"><span>Matériel — groupe ext.</span><span class="v num" id="s_outdoor">—</span></div>'+
      '<div class="sum-line"><span>Pose + mise en service</span><span class="v num" id="s_pose">—</span></div>'+
      '<div class="sum-line"><span>Liaisons frigorifiques</span><span class="v num" id="s_liaison">—</span></div>'+
      '<div class="sum-line"><span>Prestations</span><span class="v num" id="s_extras">—</span></div>'+
      '<div class="sum-line sub"><span>Divers</span><span class="v num" id="s_divers">—</span></div>'+
      '<div class="sum-line sub" id="s_remiseLine" style="color:var(--good)"><span>Remise</span><span class="v num" id="s_remise">—</span></div>'+
      '<div class="sum-div"></div>'+
      '<div class="sum-line"><span><b>Total HTVA</b></span><span class="v num" id="s_htva" style="font-weight:800">—</span></div>'+
      '<div class="vat-row"><span style="font-size:13px;color:var(--muted)">Taux TVA</span><div class="seg" id="vatSeg"><button data-vat="6">6 %</button><button data-vat="21">21 %</button></div></div>'+
      '<div class="vat-note" id="vatNote"></div>'+
      '<div class="sum-line"><span>TVA</span><span class="v num" id="s_vat">—</span></div>'+
      '<div class="sum-div" id="s_primeDiv" style="display:none"></div>'+
      '<div class="sum-line" id="s_primeLine" style="display:none"><span style="color:var(--good)">Prime estimée (Région)</span><span class="v num" id="s_prime" style="color:var(--good)">—</span></div>'+
      '<div class="sum-line" id="s_resteLine" style="display:none"><span><b>Reste à charge estimé</b></span><span class="v num" id="s_reste" style="font-weight:800">—</span></div>';
    return c;
  }
  function buildReminders(){
    var c=el('div',{class:'card reminders no-print',style:'margin-top:18px'});
    c.innerHTML='<div class="pad"><div class="eyebrow">À dire au client</div><h2 class="section-title" style="margin-bottom:8px">Rappels 2026</h2>'+
      '<div class="rem"><span class="dot warn"></span><div><b>Pas de prime wallonne</b> pour une clim réversible (air-air). Ne pas la promettre.</div></div>'+
      '<div class="rem"><span class="dot ok"></span><div><b>TVA 6 %</b> fourniture + pose, tous logements depuis le 01/01/2026.</div></div>'+
      '<div class="rem"><span class="dot info"></span><div>Client qui veut une prime → <b>PAC air-eau</b> (~3 600 €), audit logement obligatoire, +15 ans.</div></div>'+
      '<div class="rem"><span class="dot warn"></span><div>Régime primes : bascule au <b>01/10/2026</b> (Rénopack / saut de label).</div></div></div>';
    return c;
  }
  function buildSavePanel(){
    var c=el('div',{class:'card no-print',style:'margin-top:18px'}); var p=el('div',{class:'pad'});
    p.appendChild(el('div',{class:'eyebrow'},['Devis enregistrés']));
    p.appendChild(el('h2',{class:'section-title',style:'margin-bottom:4px'},['Mémoriser ce devis']));
    var row=el('div',{style:'display:flex; gap:8px; margin-top:10px'});
    var nameInp=el('input',{placeholder:'Nom (ex. Dupont – séjour+chambres)'});
    var saveBtn=el('button',{class:'btn primary'},['Enregistrer']);
    saveBtn.addEventListener('click',function(){
      var t=computeTotals();
      var num=state.company.quotePrefix+String(state.settings.quoteCounter).padStart(4,'0');
      state.savedQuotes.unshift({id:UID(), name:nameInp.value||(state.quote.client.name||'Devis')+' – '+num, number:num, date:new Date().toLocaleDateString('fr-BE'), total:t.tvac, status:'brouillon', data:JSON.parse(JSON.stringify(state.quote))});
      state.settings.quoteCounter++;
      nameInp.value=''; save(); render();
    });
    row.appendChild(nameInp); row.appendChild(saveBtn);
    p.appendChild(row);
    var newBtn=el('button',{class:'btn subtle sm',style:'margin-top:10px'},['＋ Nouveau devis vierge']);
    newBtn.addEventListener('click',function(){ if(!confirm('Démarrer un nouveau devis ? (le courant sera remplacé)')) return; state.quote=newQuote(); state.quote.rooms.forEach(autoSelectProduct); save(); render(); });
    p.appendChild(newBtn);

    if(state.savedQuotes.length){
      var list=el('div',{style:'margin-top:14px'});
      state.savedQuotes.forEach(function(sq){
        var item=el('div',{class:'saved-item'});
        item.appendChild(el('div',{class:'meta'},[el('b',null,[sq.name]), el('span',null,[sq.date+' · '+euro.format(sq.total)])]));
        var loadB=el('button',{class:'btn subtle sm'},['Ouvrir']);
        loadB.addEventListener('click',function(){ state.quote=ensureQuoteTech(JSON.parse(JSON.stringify(sq.data))); save(); render(); });
        var delB=el('button',{class:'btn danger sm'},['✕']);
        delB.addEventListener('click',function(){ state.savedQuotes=state.savedQuotes.filter(function(x){return x.id!==sq.id;}); save(); render(); });
        item.appendChild(loadB); item.appendChild(delB);
        list.appendChild(item);
      });
      p.appendChild(list);
    }
    c.appendChild(p); return c;
  }

  function refreshDevis(){
    var t=computeTotals();
    var set=function(id,val){ var n=document.getElementById(id); if(n) n.textContent=val; };
    set('s_tvac', t.n>0?euro.format(t.tvac):'—');
    set('s_kw', t.needKW.toFixed(1).replace('.',',')+' kW besoin');
    set('s_units', t.n+(t.n>1?' unités':' unité'));
    set('s_system', t.n>0?t.system:'—');
    set('s_indoor', euro.format(t.indoor));
    set('s_outdoor', euro.format(t.outdoor));
    set('s_pose', euro.format(t.pose));
    set('s_liaison', euro.format(t.liaison));
    set('s_extras', euro.format(t.extras));
    set('s_divers', euro.format(t.divers));
    set('s_htva', euro.format(t.htva));
    set('s_vat', euro.format(t.vat));
    var pr=computePrime();
    var pd=document.getElementById('s_primeDiv'), pl=document.getElementById('s_primeLine'), rl2=document.getElementById('s_resteLine');
    if(pl&&rl2){ if(pr.eligible&&pr.amount>0){ if(pd)pd.style.display='block'; pl.style.display='flex'; rl2.style.display='flex'; set('s_prime','− '+euro.format(pr.amount)); set('s_reste', euro.format(Math.max(0,t.tvac-pr.amount))); } else { if(pd)pd.style.display='none'; pl.style.display='none'; rl2.style.display='none'; } }
    var ph=document.getElementById('projetHint'); if(ph){ ph.textContent=pr.reason; ph.style.color = pr.eligible? 'var(--good)':'var(--muted)'; }
    var rl=document.getElementById('s_remiseLine');
    if(rl){ if(t.remise>0){ rl.style.display='flex'; set('s_remise','− '+euro.format(t.remise)); } else rl.style.display='none'; }
    // vat seg
    document.querySelectorAll('#vatSeg button').forEach(function(b){ b.setAttribute('aria-pressed', (+b.getAttribute('data-vat'))===state.settings.vat); });
    var note=document.getElementById('vatNote');
    if(note){ if(state.settings.vat===6){ note.innerHTML='Clim/PAC : 6 % fourniture + pose, tous logements depuis 2026.'; note.style.color='var(--good)'; } else { note.innerHTML='21 % : cas hors taux réduit (usage non résidentiel, etc.).'; note.style.color='var(--warm)'; } }
    // outdoor hint
    var hint=document.getElementById('outHint');
    if(hint){ if(t.outdoorUnit){ hint.innerHTML=(t.outdoorAuto?'Suggéré automatiquement : ':'Sélectionné : ')+'<b>'+escapeHtml(t.outdoorUnit.brand+' '+t.outdoorUnit.model)+'</b> ('+fmtKw(t.outdoorUnit.kw)+', '+t.outdoorUnit.ports+' sorties) pour '+t.n+' unité(s).'; hint.style.color='var(--muted)'; } else { hint.innerHTML='<span style="color:var(--warm)">Aucun groupe extérieur du catalogue ne couvre '+t.n+' unités à la puissance requise. Ajoute-en un dans Réglages.</span>'; } }
  }

  /* bind vat seg via delegation (rebound each render through buildSummary markup) */
  document.addEventListener('click',function(e){
    var b=e.target.closest('#vatSeg button'); if(!b) return;
    state.settings.vat=+b.getAttribute('data-vat'); refreshDevis(); save();
  });

  /* ============================================================
     ADMIN VIEW
     ============================================================ */
  var ADMIN_SECTIONS=[['societe','Société'],['interieures','Unités intérieures'],['exterieurs','Groupes extérieurs'],['mainoeuvre','Main-d\u2019œuvre'],['prestations','Prestations'],['primes','Primes & finances'],['sauvegardes','Sauvegardes & devis']];
  function renderAdmin(){
    var wrap=el('div');
    var nav=el('div',{class:'subnav'});
    ADMIN_SECTIONS.forEach(function(s){
      var b=el('button',{},[s[1]]); b.setAttribute('aria-selected', state.ui.adminSection===s[0]);
      b.addEventListener('click',function(){ state.ui.adminSection=s[0]; render(); });
      nav.appendChild(b);
    });
    wrap.appendChild(nav);
    var sec=state.ui.adminSection;
    if(sec==='societe') wrap.appendChild(adminSociete());
    else if(sec==='interieures') wrap.appendChild(adminInterieures());
    else if(sec==='exterieurs') wrap.appendChild(adminExterieurs());
    else if(sec==='mainoeuvre') wrap.appendChild(adminMainOeuvre());
    else if(sec==='prestations') wrap.appendChild(adminPrestations());
    else if(sec==='primes') wrap.appendChild(adminPrimesFinances());
    else wrap.appendChild(adminSauvegardes());
    return wrap;
  }

  function placeholderBanner(){
    return el('div',{class:'banner warn',style:'margin-bottom:16px',html:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l7 13H1L8 1z" stroke="#b6810f" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6v4M8 12h.01" stroke="#b6810f" stroke-width="1.5" stroke-linecap="round"/></svg><div><b>Données de démonstration.</b> Marques, modèles et prix sont des exemples — remplace-les par le catalogue et la grille tarifaire réels de l\u2019entreprise.</div>'});
  }

  function adminSociete(){
    var c=el('div',{class:'card'}); var p=el('div',{class:'pad'});
    p.appendChild(el('div',{class:'eyebrow'},['En-tête du PDF']));
    p.appendChild(el('h2',{class:'section-title'},['Votre société']));
    var g=el('div',{class:'grid g2',style:'margin-top:14px'});
    g.appendChild(textField('Nom', state.company.name,'', function(v){state.company.name=v; save();}));
    g.appendChild(textField('Téléphone', state.company.phone,'', function(v){state.company.phone=v; save();}));
    p.appendChild(g);
    var g2=el('div',{class:'grid g2',style:'margin-top:12px'});
    g2.appendChild(textField('Adresse', state.company.addr,'', function(v){state.company.addr=v; save();}));
    g2.appendChild(textField('Email', state.company.email,'', function(v){state.company.email=v; save();}));
    p.appendChild(g2);
    var g3=el('div',{class:'grid g3',style:'margin-top:12px'});
    g3.appendChild(textField('N° TVA', state.company.vatNr,'BE 0xxx.xxx.xxx', function(v){state.company.vatNr=v; save();}));
    g3.appendChild(textField('Préfixe n° devis', state.company.quotePrefix,'DEV-2026-', function(v){state.company.quotePrefix=v; save();}));
    g3.appendChild(numField('Validité (jours)', state.company.validity,'1', function(v){state.company.validity=v; save();}));
    p.appendChild(g3);

    // logo
    var prev=el('div',{class:'logo-prev'}); 
    if(state.company.logo){ var im=el('img'); im.src=state.company.logo; prev.appendChild(im); } else prev.appendChild(el('span',null,['Pas de logo']));
    var file=el('input',{type:'file',accept:'image/*',style:'display:none'});
    var btn=el('button',{class:'btn subtle sm'},['Choisir un logo']);
    btn.addEventListener('click',function(){file.click();});
    file.addEventListener('change',function(){ var f=file.files[0]; if(!f) return; var rd=new FileReader(); rd.onload=function(){ state.company.logo=rd.result; save(); render(); }; rd.readAsDataURL(f); });
    var rmLogo=el('button',{class:'btn danger sm'},['Retirer']); rmLogo.addEventListener('click',function(){ state.company.logo=null; save(); render(); });
    var logoRow=el('div',{class:'logo-drop',style:'margin-top:14px'},[prev, el('div',null,[btn, document.createTextNode(' '), rmLogo, file])]);
    p.appendChild(el('label',{class:'field',style:'margin-top:14px'},[el('span',null,['Logo (apparaît sur le PDF)'])]));
    p.appendChild(logoRow);

    var foot=el('textarea'); foot.value=state.company.footer; foot.addEventListener('input',function(){state.company.footer=foot.value; save();});
    p.appendChild(el('label',{class:'field',style:'margin-top:14px'},[el('span',null,['Mention légale / bas de page du devis']), foot]));
    c.appendChild(p); return c;
  }

  function adminInterieures(){
    var box=el('div'); box.appendChild(placeholderBanner());
    var c=el('div',{class:'card'}); var p=el('div',{class:'pad'});
    p.appendChild(el('div',{class:'eyebrow'},['Catalogue']));
    p.appendChild(el('h2',{class:'section-title'},['Unités intérieures']));
    p.appendChild(el('p',{class:'section-sub'},['Marque, modèle, type, puissance et prix matériel HTVA.']));
    var wrap=el('div',{class:'tbl-wrap',style:'margin-top:14px'});
    var tbl=el('table',{class:'tbl'});
    tbl.innerHTML='<thead><tr><th>Marque</th><th>Modèle</th><th>Type</th><th class="r">Puiss. (kW)</th><th>Classe</th><th class="r">Prix HTVA</th><th></th><th></th></tr></thead>';
    var tb=el('tbody');
    state.catalog.forEach(function(prod){ tb.appendChild(catalogRow(prod, tb)); });
    tbl.appendChild(tb); wrap.appendChild(tbl); p.appendChild(wrap);
    var add=el('button',{class:'add-row'},['＋ Ajouter une unité intérieure']);
    add.addEventListener('click',function(){ var prod={id:UID(),brand:'',model:'',type:'mural',kw:2.5,energy:'',price:0}; state.catalog.push(prod); tb.appendChild(catalogRow(prod, tb)); save(); });
    p.appendChild(add);
    c.appendChild(p); box.appendChild(c); return box;
  }
  var INDOOR_TECH_FIELDS=[
    ['Ø liquide','diamLiquide','text','1/4'],['Ø gaz','diamGaz','text','3/8'],
    ['Liaison incluse (m)','liaisonBaseLen','number','',0.5],['Liaison max (m)','liaisonMaxLen','number','',0.5],
    ['Dénivelé max (m)','denivMax','number','',0.5],['Charge add. (g/m)','chargeGM','number','',1],
    ['Disjoncteur conseillé (note)','disjoncteur','text','ex. 16 A — à confirmer'],['Section goulotte conseillée','goulotteSectionConseillee','text','60x45']
  ];
  var OUTDOOR_TECH_FIELDS=[
    ['Dénivelé max (m)','denivMax','number','',0.5],['Disjoncteur conseillé (note)','disjoncteur','text','ex. 16 A — à confirmer']
  ];
  // Champs techniques par modèle : tous optionnels, livrés vides. L'app les applique au relevé
  // quand ils existent, sinon « à confirmer ». Aucune valeur de sécurité par défaut.
  function modelTechField(obj, def){
    var label=def[0], key=def[1], type=def[2]||'text', ph=def[3], step=def[4];
    var i=el('input',{type:type}); if(type==='number'){ i.step=step||'0.1'; i.min='0'; }
    i.value=(obj[key]==null?'':obj[key]); if(ph) i.placeholder=ph;
    i.addEventListener('input',function(){ obj[key] = (type==='number') ? (i.value===''?'':+i.value) : i.value; save(); });
    return el('label',{class:'field'},[el('span',null,[label]),i]);
  }
  function techFieldsRow(obj, defs, colspan){
    var tr=el('tr',{class:'tech-row'});
    var cell=el('td',{colspan:String(colspan)});
    cell.appendChild(el('div',{class:'banner info',style:'margin-bottom:10px',html:'<div>Données techniques du modèle (optionnelles). Le disjoncteur conseillé est une <b>note à confirmer par l’électricien</b> ; la charge de réfrigérant déduite reste une estimation à confirmer et peser par l’installateur certifié.</div>'}));
    var g=el('div',{class:'grid g3',style:'gap:10px'});
    defs.forEach(function(d){ g.appendChild(modelTechField(obj,d)); });
    cell.appendChild(g); tr.appendChild(cell);
    tr.style.display='none';
    return tr;
  }
  function techToggleCell(getDefs, getColspan, hostObj){
    var detailsTr=null;
    var b=el('button',{class:'btn subtle sm',type:'button'},['⚙ Tech']);
    b.addEventListener('click',function(){
      var mainTr=b.closest('tr');
      if(!detailsTr){ detailsTr=techFieldsRow(hostObj, getDefs, getColspan); mainTr.parentNode.insertBefore(detailsTr, mainTr.nextSibling); }
      var open=detailsTr.style.display==='none'; detailsTr.style.display=open?'':'none'; b.setAttribute('aria-pressed', open);
    });
    return td(b);
  }
  function catalogRow(prod, tb){
    var tr=el('tr');
    tr.appendChild(td(cellInput(prod,'brand','text','Marque')));
    tr.appendChild(td(cellInput(prod,'model','text','Modèle')));
    tr.appendChild(td(cellSelect(prod,'type',TYPES)));
    tr.appendChild(tdc('col-num', cellInput(prod,'kw','number','',0.1)));
    tr.appendChild(td(cellInput(prod,'energy','text','A++')));
    tr.appendChild(tdc('col-num', cellEur(prod,'price')));
    tr.appendChild(techToggleCell(INDOOR_TECH_FIELDS, 8, prod));
    tr.appendChild(delCell(function(){ state.catalog=state.catalog.filter(function(x){return x.id!==prod.id;}); tr.remove(); save(); }));
    return tr;
  }

  function adminExterieurs(){
    var box=el('div'); box.appendChild(placeholderBanner());
    var c=el('div',{class:'card'}); var p=el('div',{class:'pad'});
    p.appendChild(el('div',{class:'eyebrow'},['Catalogue']));
    p.appendChild(el('h2',{class:'section-title'},['Groupes extérieurs']));
    p.appendChild(el('p',{class:'section-sub'},['Le devis sélectionne automatiquement le plus petit groupe couvrant la puissance et le nombre d\u2019unités.']));
    var wrap=el('div',{class:'tbl-wrap',style:'margin-top:14px'});
    var tbl=el('table',{class:'tbl'});
    tbl.innerHTML='<thead><tr><th>Marque</th><th>Modèle</th><th class="r">Puiss. (kW)</th><th class="r">Sorties</th><th class="r">Prix HTVA</th><th></th><th></th></tr></thead>';
    var tb=el('tbody');
    state.outdoors.forEach(function(o){ tb.appendChild(outdoorRow(o)); });
    tbl.appendChild(tb); wrap.appendChild(tbl); p.appendChild(wrap);
    var add=el('button',{class:'add-row'},['＋ Ajouter un groupe extérieur']);
    add.addEventListener('click',function(){ var o={id:UID(),brand:'',model:'',kw:2.5,ports:1,price:0}; state.outdoors.push(o); tb.appendChild(outdoorRow(o)); save(); });
    p.appendChild(add);
    c.appendChild(p); box.appendChild(c); return box;
  }
  function outdoorRow(o){
    var tr=el('tr');
    tr.appendChild(td(cellInput(o,'brand','text','Marque')));
    tr.appendChild(td(cellInput(o,'model','text','Modèle')));
    tr.appendChild(tdc('col-num', cellInput(o,'kw','number','',0.1)));
    tr.appendChild(tdc('col-num', cellInput(o,'ports','number','',1)));
    tr.appendChild(tdc('col-num', cellEur(o,'price')));
    tr.appendChild(techToggleCell(OUTDOOR_TECH_FIELDS, 7, o));
    tr.appendChild(delCell(function(){ state.outdoors=state.outdoors.filter(function(x){return x.id!==o.id;}); tr.remove(); save(); }));
    return tr;
  }

  function adminMainOeuvre(){
    var c=el('div',{class:'card'}); var p=el('div',{class:'pad'});
    p.appendChild(el('div',{class:'eyebrow'},['Tarifs de pose']));
    p.appendChild(el('h2',{class:'section-title'},['Main-d\u2019œuvre & frais']));
    p.appendChild(el('p',{class:'section-sub'},['Coût de pose par type d\u2019unité + frais annexes appliqués automatiquement.']));
    var g=el('div',{class:'grid g2',style:'margin-top:14px'});
    g.appendChild(eurField('Pose — unité murale', state.labour.pose.mural, function(v){state.labour.pose.mural=v; save();}));
    g.appendChild(eurField('Pose — console', state.labour.pose.console, function(v){state.labour.pose.console=v; save();}));
    g.appendChild(eurField('Pose — cassette plafond', state.labour.pose.cassette, function(v){state.labour.pose.cassette=v; save();}));
    g.appendChild(eurField('Pose — gainable', state.labour.pose.gainable, function(v){state.labour.pose.gainable=v; save();}));
    g.appendChild(eurField('Forfait mise en service', state.labour.miseEnService, function(v){state.labour.miseEnService=v; save();}));
    g.appendChild(eurField('Liaison frigorifique — par mètre', state.labour.liaisonPerM, function(v){state.labour.liaisonPerM=v; save();}));
    g.appendChild(numField('Mètres de liaison par défaut / unité', state.labour.liaisonDefaultM,'1', function(v){state.labour.liaisonDefaultM=v; save();}));
    g.appendChild(numField('Divers (%) — condensats, élec., supports', state.labour.diversPct,'1', function(v){state.labour.diversPct=v; save();}));
    p.appendChild(g);
    var tp=ensureTechPrices();
    p.appendChild(el('h2',{class:'section-title',style:'font-size:14px;margin-top:18px'},['Fournitures techniques (relevé de pose)']));
    p.appendChild(el('p',{class:'section-sub'},['Tarifs unitaires utilisés par « Ajouter les fournitures au devis » (onglet Technique). Livrés vides — renseigne tes prix.']));
    var gt=el('div',{class:'grid g2',style:'margin-top:12px'});
    gt.appendChild(eurField('Goulotte — par mètre', tp.goulotteM, function(v){tp.goulotteM=v; save();}));
    gt.appendChild(eurField('Carottage — par trou', tp.carottage, function(v){tp.carottage=v; save();}));
    gt.appendChild(eurField('Pompe de relevage — pièce', tp.pompe, function(v){tp.pompe=v; save();}));
    gt.appendChild(eurField('Évacuation condensats — par mètre', tp.evacM, function(v){tp.evacM=v; save();}));
    gt.appendChild(eurField('Support / fixation — pièce', tp.support, function(v){tp.support=v; save();}));
    gt.appendChild(eurField('Amenée électrique — par mètre', tp.elecM, function(v){tp.elecM=v; save();}));
    p.appendChild(gt);
    c.appendChild(p); return c;
  }

  function adminPrestations(){
    var c=el('div',{class:'card'}); var p=el('div',{class:'pad'});
    p.appendChild(el('div',{class:'eyebrow'},['Options à la carte']));
    p.appendChild(el('h2',{class:'section-title'},['Prestations supplémentaires']));
    p.appendChild(el('p',{class:'section-sub'},['Ajoutables au devis avec une quantité (ex. dépose, pompe de relevage…).']));
    var wrap=el('div',{class:'tbl-wrap',style:'margin-top:14px'});
    var tbl=el('table',{class:'tbl',style:'min-width:420px'});
    tbl.innerHTML='<thead><tr><th>Prestation</th><th class="r">Prix HTVA</th><th></th></tr></thead>';
    var tb=el('tbody');
    state.extras.forEach(function(e){ tb.appendChild(extraRow(e)); });
    tbl.appendChild(tb); wrap.appendChild(tbl); p.appendChild(wrap);
    var add=el('button',{class:'add-row'},['＋ Ajouter une prestation']);
    add.addEventListener('click',function(){ var e={id:UID(),name:'',price:0}; state.extras.push(e); tb.appendChild(extraRow(e)); save(); });
    p.appendChild(add);
    c.appendChild(p); return c;
  }
  function extraRow(e){
    var tr=el('tr');
    tr.appendChild(td(cellInput(e,'name','text','Nom de la prestation')));
    tr.appendChild(tdc('col-num', cellEur(e,'price')));
    tr.appendChild(delCell(function(){ state.extras=state.extras.filter(function(x){return x.id!==e.id;}); tr.remove(); save(); }));
    return tr;
  }

  function adminPrimesFinances(){
    var box=el('div'); box.appendChild(placeholderBanner());
    var c=el('div',{class:'card'}); var p=el('div',{class:'pad'});
    p.appendChild(el('div',{class:'eyebrow'},['Wallonie']));
    p.appendChild(el('h2',{class:'section-title'},['Prime Habitation (PAC air-eau)']));
    p.appendChild(el('p',{class:'section-sub',style:'color:var(--warm)'},['⚠︎ Coefficients indicatifs. Vérifie les montants officiels sur logement.wallonie.be. La clim air-air reste non éligible.']));
    var g=el('div',{class:'grid g2',style:'margin-top:14px'});
    g.appendChild(eurField('Montant de base', state.primes.base, function(v){state.primes.base=v; save();}));
    g.appendChild(numField('Âge minimum du logement (ans)', state.primes.minAgeYears,'1', function(v){state.primes.minAgeYears=v; save();}));
    p.appendChild(g);
    p.appendChild(el('div',{class:'total-label',style:'margin-top:16px'},['Coefficient par catégorie de revenus (× base)']));
    var g2=el('div',{class:'grid g2',style:'margin-top:8px'});
    ['R1','R2','R3','R4'].forEach(function(r){ g2.appendChild(numField('Coeff. '+r, state.primes.mult[r],'0.1', function(v){state.primes.mult[r]=+v; save();})); });
    p.appendChild(g2);
    p.appendChild(el('div',{class:'total-label',style:'margin-top:16px'},['Plafond (% du TVAC) par catégorie']));
    var g3=el('div',{class:'grid g2',style:'margin-top:8px'});
    ['R1','R2','R3','R4'].forEach(function(r){ g3.appendChild(numField('Plafond '+r+' (%)', state.primes.capPct[r],'1', function(v){state.primes.capPct[r]=+v; save();})); });
    p.appendChild(g3);
    c.appendChild(p); box.appendChild(c);

    var c2=el('div',{class:'card',style:'margin-top:18px'}); var p2=el('div',{class:'pad'});
    p2.appendChild(el('div',{class:'eyebrow'},['Conditions']));
    p2.appendChild(el('h2',{class:'section-title'},['Acompte & paiement']));
    var gf=el('div',{class:'grid g2',style:'margin-top:14px'});
    gf.appendChild(numField('Acompte (%)', state.finance.acomptePct,'1', function(v){state.finance.acomptePct=v; save();}));
    p2.appendChild(gf);
    var pt=el('textarea'); pt.value=state.finance.paymentTerms; pt.addEventListener('input',function(){state.finance.paymentTerms=pt.value; save();});
    p2.appendChild(el('label',{class:'field',style:'margin-top:12px'},[el('span',null,['Conditions de paiement (PDF)']), pt]));
    var cgv=el('textarea',{style:'min-height:90px'}); cgv.value=state.finance.cgv; cgv.addEventListener('input',function(){state.finance.cgv=cgv.value; save();});
    p2.appendChild(el('label',{class:'field',style:'margin-top:12px'},[el('span',null,['Conditions générales (page séparée du PDF, optionnel)']), cgv]));
    c2.appendChild(p2); box.appendChild(c2);

    var c3=el('div',{class:'card',style:'margin-top:18px'}); var p3=el('div',{class:'pad'});
    p3.appendChild(el('div',{class:'eyebrow'},['Estimation d\u2019économies']));
    p3.appendChild(el('h2',{class:'section-title'},['Hypothèses ROI (PAC vs énergie fossile)']));
    p3.appendChild(el('p',{class:'section-sub'},['Servent à estimer les économies annuelles dans la vue client (projet chauffage).']));
    var gs=el('div',{class:'grid g3',style:'margin-top:14px'});
    gs.appendChild(numField('Prix énergie fossile (€/kWh)', state.savings.fossilPrice,'0.01', function(v){state.savings.fossilPrice=v; save();}));
    gs.appendChild(numField('Rendement chaudière', state.savings.fossilEff,'0.05', function(v){state.savings.fossilEff=v; save();}));
    gs.appendChild(numField('Prix électricité (€/kWh)', state.savings.pacPrice,'0.01', function(v){state.savings.pacPrice=v; save();}));
    gs.appendChild(numField('SCOP de la PAC', state.savings.scop,'0.1', function(v){state.savings.scop=v; save();}));
    p3.appendChild(gs);
    c3.appendChild(p3); box.appendChild(c3);
    return box;
  }

  function adminSauvegardes(){
    var c=el('div',{class:'card'}); var p=el('div',{class:'pad'});
    p.appendChild(el('div',{class:'eyebrow'},['Données']));
    p.appendChild(el('h2',{class:'section-title'},['Sauvegardes & devis enregistrés']));
    p.appendChild(el('div',{class:'banner info',style:'margin-top:14px',html:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#0b6e78" stroke-width="1.3"/><path d="M8 7.2v4M8 4.8h.01" stroke="#0b6e78" stroke-width="1.5" stroke-linecap="round"/></svg><div>Tes réglages sont enregistrés dans ce navigateur. Pour changer d\u2019appareil ou ne rien perdre, utilise <b>Exporter</b> (en haut) puis <b>Importer</b> sur l\u2019autre appareil.</div>'}));
    var row=el('div',{style:'display:flex; gap:8px; margin-top:14px; flex-wrap:wrap'});
    var ex=el('button',{class:'btn primary'},['⤓ Exporter toute la configuration']);
    ex.addEventListener('click', doExport);
    var im=el('button',{class:'btn subtle'},['⤒ Importer une configuration']);
    im.addEventListener('click',function(){ document.getElementById('importFile').click(); });
    row.appendChild(ex); row.appendChild(im);
    p.appendChild(row);

    var reset=el('button',{class:'btn danger sm',style:'margin-top:16px'},['Réinitialiser aux données de démonstration']);
    reset.addEventListener('click',function(){ if(!confirm('Tout effacer et revenir aux données de démo ? Cette action est irréversible.')) return; state=seed(); save(); render(); });
    p.appendChild(reset);

    if(state.savedQuotes.length){
      p.appendChild(el('h3',{class:'section-title',style:'margin-top:22px; font-size:15px'},['Devis mémorisés ('+state.savedQuotes.length+')']));
      var list=el('div',{style:'margin-top:8px'});
      state.savedQuotes.forEach(function(sq){
        var item=el('div',{class:'saved-item'});
        item.appendChild(el('div',{class:'meta'},[el('b',null,[sq.name]), el('span',null,[sq.date+' · '+euro.format(sq.total)])]));
        var del=el('button',{class:'btn danger sm'},['Supprimer']);
        del.addEventListener('click',function(){ state.savedQuotes=state.savedQuotes.filter(function(x){return x.id!==sq.id;}); save(); render(); });
        item.appendChild(del); list.appendChild(item);
      });
      p.appendChild(list);
    }
    c.appendChild(p); return c;
  }

  /* ---------- small field/cell factories ---------- */
  function textField(label,val,ph,on){ var i=el('input',{type:'text'}); i.value=val||''; if(ph)i.placeholder=ph; i.addEventListener('input',function(){on(i.value);}); return el('label',{class:'field'},[el('span',null,[label]),i]); }
  function numField(label,val,step,on){ var i=el('input',{type:'number',step:step||'1',min:'0'}); i.value=val; i.addEventListener('input',function(){on(i.value);}); return el('label',{class:'field'},[el('span',null,[label]),i]); }
  function eurField(label,val,on){ var i=el('input',{type:'number',step:'10',min:'0'}); i.value=val; i.addEventListener('input',function(){on(i.value);}); return el('label',{class:'field'},[el('span',null,[label]), el('div',{class:'input-eur'},[i])]); }
  function selField(label,val,options,on){ var s=el('select'); options.forEach(function(o){s.appendChild(opt(o[0],o[1],o[0]===val));}); s.addEventListener('change',function(){on(s.value);}); return el('label',{class:'field'},[el('span',null,[label]),s]); }
  function cellInput(obj,key,type,ph,step){ var i=el('input',{type:type}); if(type==='number'){i.step=step||'1'; i.min='0';} i.value=obj[key]; if(ph)i.placeholder=ph; i.addEventListener('input',function(){ obj[key]= type==='number'? (i.value===''?0:+i.value) : i.value; save(); }); return i; }
  function cellEur(obj,key){ var w=el('div',{class:'input-eur'}); var i=el('input',{type:'number',step:'10',min:'0'}); i.value=obj[key]; i.addEventListener('input',function(){ obj[key]=i.value===''?0:+i.value; save(); }); w.appendChild(i); return w; }
  function cellSelect(obj,key,options){ var s=el('select'); options.forEach(function(o){s.appendChild(opt(o[0],o[1],o[0]===obj[key]));}); s.addEventListener('change',function(){obj[key]=s.value; save();}); return s; }
  function td(child){ var t=el('td'); t.appendChild(child); return t; }
  function tdc(cls,child){ var t=el('td',{class:cls}); t.appendChild(child); return t; }
  function delCell(onDel){ var t=el('td',{class:'actions'}); var b=el('button',{class:'icon-btn','aria-label':'Supprimer'},[]); b.innerHTML='<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6.5 4V2.8h3V4M5 4l.6 9h4.8L11 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'; b.addEventListener('click',onDel); t.appendChild(b); return t; }

  /* ---------- export / import ---------- */
  function doExport(){
    var copy=Object.assign({},state); delete copy.ui;
    var blob=new Blob([JSON.stringify(copy,null,2)],{type:'application/json'});
    var a=el('a'); a.href=URL.createObjectURL(blob); a.download='estimclim-config-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ try{ if(URL.revokeObjectURL) URL.revokeObjectURL(a.href); }catch(e){} a.remove(); },100);
  }
  document.getElementById('exportBtn').addEventListener('click', doExport);
  document.getElementById('importBtn').addEventListener('click',function(){ document.getElementById('importFile').click(); });
  document.getElementById('importFile').addEventListener('change',function(e){
    var f=e.target.files[0]; if(!f) return;
    var rd=new FileReader();
    rd.onload=function(){ try{ var s=JSON.parse(rd.result); state=mergeDefaults(s); state.ui={tab:'devis',adminSection:'societe',clientPrices:true,clientView:false,planSel:null}; save(); render(); alert('Configuration importée.'); }catch(err){ alert('Fichier illisible : '+err.message); } };
    rd.readAsText(f); e.target.value='';
  });

  /* ---------- tabs ---------- */
  document.getElementById('tab-devis').addEventListener('click',function(){ state.ui.tab='devis'; state.ui.clientView=false; render(); });
  document.getElementById('tab-plan').addEventListener('click',function(){ state.ui.tab='plan'; render(); });
  document.getElementById('tab-technique').addEventListener('click',function(){ state.ui.tab='technique'; state.ui.clientView=false; render(); });
  document.getElementById('tab-3d').addEventListener('click',function(){ state.ui.tab='3d'; state.ui.clientView=false; render(); });
  document.getElementById('tab-dash').addEventListener('click',function(){ state.ui.tab='dash'; state.ui.clientView=false; render(); });
  document.getElementById('tab-admin').addEventListener('click',function(){ state.ui.tab='admin'; state.ui.clientView=false; render(); });

  /* ---------- print ---------- */
  document.getElementById('printBtn').addEventListener('click',function(){ buildPrint(); window.print(); });
  function buildPrint(){
    var t=computeTotals(), q=state.quote, co=state.company, fin=computeFinance();
    var num=co.quotePrefix+String(state.settings.quoteCounter).padStart(4,'0');
    var dateStr=q.date?new Date(q.date+'T00:00').toLocaleDateString('fr-BE'):new Date().toLocaleDateString('fr-BE');
    var valid=new Date(Date.now()+ (parseInt(co.validity,10)||30)*864e5).toLocaleDateString('fr-BE');

    var rows=q.rooms.map(function(r){
      var c=computeRoom(r), p=getProduct(r.productId);
      var label = p? (p.brand+' '+p.model+' '+fmtKw(p.kw)+' ('+typeLabel(p.type)+')') : '— unité à définir —';
      var price = p? euro2.format(p.price) : '—';
      return '<tr><td>'+escapeHtml(r.name)+'</td><td>'+escapeHtml(label)+'</td><td class="r">'+(+r.surface||0)+' m²</td><td class="r">'+c.kW.toFixed(1).replace('.',',')+' kW</td><td class="r">'+price+'</td></tr>';
    }).join('');

    var extraRows=q.extraLines.map(function(line){
      if(line.origin==='tech'){ return '<tr><td colspan="3">'+escapeHtml(line.label)+'</td><td class="r">'+techRound1(line.qty)+' '+escapeHtml(line.unit||'')+'</td><td class="r">'+euro2.format((+line.unitPrice||0)*(+line.qty||0))+'</td></tr>'; }
      var e=state.extras.filter(function(x){return x.id===line.extraId;})[0]; if(!e)return''; return '<tr><td colspan="3">'+escapeHtml(e.name)+'</td><td class="r">×'+(+line.qty||0)+'</td><td class="r">'+euro2.format((+e.price||0)*(+line.qty||0))+'</td></tr>';
    }).join('');
    var od=t.outdoorUnit? '<tr><td colspan="2">Groupe extérieur — '+escapeHtml(t.outdoorUnit.brand+' '+t.outdoorUnit.model)+'</td><td class="r">'+fmtKw(t.outdoorUnit.kw)+'</td><td class="r">'+t.outdoorUnit.ports+' sorties</td><td class="r">'+euro2.format(t.outdoorUnit.price)+'</td></tr>':'';

    var logoHtml = co.logo? '<img src="'+co.logo+'" alt="logo">':'';
    var html=
      '<div class="pd-head"><div class="pd-co">'+logoHtml+'<div class="co-name">'+escapeHtml(co.name||'Votre société')+'</div>'+
        (co.addr?escapeHtml(co.addr)+'<br>':'')+(co.phone?'Tél. '+escapeHtml(co.phone)+'  ':'')+(co.email?escapeHtml(co.email):'')+(co.vatNr?'<br>'+escapeHtml(co.vatNr):'')+'</div>'+
        '<div class="pd-meta"><b>DEVIS '+escapeHtml(num)+'</b><br>Date : '+dateStr+'<br>Valable jusqu\'au '+valid+'<br><br>'+
          (q.client.name?'<b>'+escapeHtml(q.client.name)+'</b><br>':'')+(q.client.addr?escapeHtml(q.client.addr)+'<br>':'')+(q.client.phone?escapeHtml(q.client.phone):'')+'</div></div>'+
      '<div class="pd-section-label">Installation '+t.system+' — climatisation réversible</div>'+
      '<table class="pd-table"><thead><tr><th>Pièce</th><th>Unité intérieure</th><th class="r">Surface</th><th class="r">Besoin</th><th class="r">Prix HTVA</th></tr></thead><tbody>'+
        (rows||'<tr><td colspan="5" style="color:#8499a1">Aucune pièce.</td></tr>')+od+
        (extraRows?'<tr><td colspan="5" style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#8499a1;padding-top:10px">Prestations</td></tr>'+extraRows:'')+
      '</tbody></table>'+
      '<div class="pd-tot">'+
        '<div><span>Total matériel + pose</span><span>'+euro2.format(t.indoor+t.outdoor+t.pose+t.liaison+t.extras)+'</span></div>'+
        '<div><span>Divers ('+ (state.labour.diversPct||0) +' %)</span><span>'+euro2.format(t.divers)+'</span></div>'+
        (t.remise>0?'<div><span>Remise</span><span>− '+euro2.format(t.remise)+'</span></div>':'')+
        '<div style="border-top:1px solid #dce5e8;margin-top:4px;padding-top:6px"><span><b>Total HTVA</b></span><span><b>'+euro2.format(t.htva)+'</b></span></div>'+
        '<div><span>TVA '+state.settings.vat+' %</span><span>'+euro2.format(t.vat)+'</span></div>'+
        '<div class="grand"><span>Total TVAC</span><span>'+euro2.format(t.tvac)+'</span></div>'+
        (fin.prime.eligible&&fin.prime.amount>0? '<div style="color:#2f8f5b"><span>Prime Habitation estimée</span><span>− '+euro2.format(fin.prime.amount)+'</span></div><div style="font-weight:800"><span>Reste à charge estimé</span><span>'+euro2.format(fin.reste)+'</span></div>':'')+
        '<div style="margin-top:6px"><span>Acompte ('+(state.finance.acomptePct||0)+' %)</span><span>'+euro2.format(fin.acompte)+'</span></div>'+
        '<div><span>Solde à la fin des travaux</span><span>'+euro2.format(fin.solde)+'</span></div>'+
      '</div>'+
      '<div class="pd-legal">'+escapeHtml(state.finance.paymentTerms||'')+(fin.prime.eligible&&fin.prime.amount>0?' '+escapeHtml(fin.prime.reason):'')+'<br>'+escapeHtml(co.footer||'')+'</div>'+
      (state.finance.cgv? '<div style="page-break-before:always"></div><div class="pd-section-label">Conditions générales</div><div class="pd-legal" style="border-top:none">'+escapeHtml(state.finance.cgv)+'</div>':'')+
      (planHasContent()? '<div style="page-break-before:always"></div><div class="pd-section-label">Plan d\'implantation</div><div style="border:1px solid #dce5e8;border-radius:8px;overflow:hidden;margin-top:4px">'+planSVGString({readonly:true})+'</div>' : '');
    document.getElementById('printDoc').innerHTML=html;
  }

  /* ============================================================
     PLAN VIEW (éditeur 2D + vue client)
     ============================================================ */
  var SVGNS='http://www.w3.org/2000/svg';
  function svgN(name,attrs){ var n=document.createElementNS(SVGNS,name); if(attrs) for(var k in attrs) n.setAttribute(k,attrs[k]); return n; }
  function svgPoint(svg,evt){ var p=svg.createSVGPoint(); var src=evt.touches&&evt.touches[0]?evt.touches[0]:evt; p.x=src.clientX; p.y=src.clientY; var m=svg.getScreenCTM(); return p.matrixTransform(m.inverse()); }
  function snap(v){ var s=state.plan.snap||25; return Math.round(v/s)*s; }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function isSel(kind,id){ var s=state.ui.planSel; return !!(s&&s.kind===kind&&s.id===id); }
  function maxX(obj,kind){ var w = kind==='room'? obj.w : PLAN_ITEMS[obj.type].w; return Math.max(0, state.plan.wcm - w); }
  function maxY(obj,kind){ var h = kind==='room'? obj.h : PLAN_ITEMS[obj.type].h; return Math.max(0, state.plan.hcm - h); }

  function renderPlan(){
    state.planMode = state.planMode || 'select';
    if(state.ui.clientView) return renderClientView();
    var box=el('div');
    box.appendChild(planToolbar());
    var layout=el('div',{class:'plan-layout'});
    planCanvasWrap=el('div',{class:'plan-canvas-wrap'});
    planCanvasWrap.appendChild(buildEditorSVG());
    var left=el('div');
    left.appendChild(planCanvasWrap);
    left.appendChild(el('div',{class:'plan-hint'},[ state.planMode==='drawroom' ? 'Clique-glisse sur la zone pour dessiner une pièce.' : 'Glisse les éléments pour les positionner. Clique un élément pour le régler.' ]));
    planSideHost=el('div',{class:'plan-side'});
    planSideHost.appendChild(buildPlanSide());
    layout.appendChild(left); layout.appendChild(planSideHost);
    box.appendChild(layout);
    return box;
  }
  function renderPlanCanvas(){ if(!planCanvasWrap) return; planCanvasWrap.innerHTML=''; planCanvasWrap.appendChild(buildEditorSVG()); }
  function renderSide(){ if(!planSideHost) return; planSideHost.innerHTML=''; planSideHost.appendChild(buildPlanSide()); }

  function planToolbar(){
    var t=el('div',{class:'plan-toolbar'});
    var bSel=el('button',{class:'planbtn'},['🖱 Sélection']); bSel.setAttribute('aria-pressed', state.planMode==='select'); bSel.addEventListener('click',function(){ state.planMode='select'; render(); });
    var bRoom=el('button',{class:'planbtn'},['▭ Dessiner une pièce']); bRoom.setAttribute('aria-pressed', state.planMode==='drawroom'); bRoom.addEventListener('click',function(){ state.planMode='drawroom'; state.ui.planSel=null; render(); });
    t.appendChild(bSel); t.appendChild(bRoom);
    t.appendChild(el('span',{class:'sep'}));
    Object.keys(PLAN_ITEMS).forEach(function(type){ var m=PLAN_ITEMS[type]; var b=el('button',{class:'planbtn eq'},['＋ '+m.label]); b.addEventListener('click',function(){ addItem(type); }); t.appendChild(b); });
    t.appendChild(el('span',{class:'sep'}));
    var bGoul=el('button',{class:'planbtn'},['🧵 Goulotte (tech)']); bGoul.setAttribute('aria-pressed', state.planMode==='goulotte'); bGoul.addEventListener('click',function(){ state.planMode='goulotte'; techDraft=[]; state.ui.planSel=null; render(); }); t.appendChild(bGoul);
    var bTrou=el('button',{class:'planbtn'},['⊙ Trou (tech)']); bTrou.setAttribute('aria-pressed', state.planMode==='trou'); bTrou.addEventListener('click',function(){ state.planMode='trou'; techDraft=[]; state.ui.planSel=null; render(); }); t.appendChild(bTrou);
    t.appendChild(el('span',{class:'sep'}));
    t.appendChild(el('span',{style:'font-size:12px;color:var(--muted)'},['Plan']));
    var wIn=el('input',{type:'number',min:'2',step:'1',class:'psize'}); wIn.value=(state.plan.wcm/100); wIn.addEventListener('change',function(){ state.plan.wcm=Math.max(200,Math.round((+wIn.value||10)*100)); save(); render(); });
    var hIn=el('input',{type:'number',min:'2',step:'1',class:'psize'}); hIn.value=(state.plan.hcm/100); hIn.addEventListener('change',function(){ state.plan.hcm=Math.max(200,Math.round((+hIn.value||7)*100)); save(); render(); });
    t.appendChild(wIn); t.appendChild(el('span',{style:'font-size:12px;color:var(--muted)'},['×'])); t.appendChild(hIn); t.appendChild(el('span',{style:'font-size:12px;color:var(--muted)'},['m']));
    t.appendChild(el('span',{class:'sep'}));
    var fromB=el('button',{class:'planbtn'},['⟳ Reprendre les pièces du devis']); fromB.addEventListener('click', fromDevis); t.appendChild(fromB);
    var clrB=el('button',{class:'planbtn'},['🗑 Vider']); clrB.addEventListener('click',function(){ if(!confirm('Vider le plan ?')) return; state.plan.rooms=[]; state.plan.items=[]; state.plan.tech=newPlanTech(); techDraft=[]; state.ui.planSel=null; save(); render(); }); t.appendChild(clrB);
    t.appendChild(el('span',{class:'sep'}));
    var arB=el('button',{class:'planbtn'},['📐 Mesurer en AR']); arB.addEventListener('click', startARMeasure); t.appendChild(arB);
    var arViz=el('button',{class:'planbtn'},['🛋 Voir la clim sur le mur (AR)']); arViz.addEventListener('click', startARPlace); t.appendChild(arViz);
    var arScan=el('button',{class:'planbtn'},['✨ Scanner & équiper en AR']); arScan.addEventListener('click', startARScanEquip); t.appendChild(arScan);
    var d3=el('button',{class:'btn subtle sm'},['🧊 Voir en 3D']); d3.addEventListener('click',function(){ state.ui.tab='3d'; render(); }); t.appendChild(d3);
    var cvB=el('button',{class:'btn primary sm'},['👁 Vue client']); cvB.addEventListener('click',function(){ state.ui.clientView=true; render(); }); t.appendChild(cvB);
    return t;
  }

  function buildEditorSVG(){
    var P=state.plan, K=0.6;
    var svg=svgN('svg',{class:'plan-svg', viewBox:'0 0 '+P.wcm+' '+P.hcm, width:Math.round(P.wcm*K), height:Math.round(P.hcm*K)});
    var defs=svgN('defs'); var pat=svgN('pattern',{id:'edgrid',width:P.grid,height:P.grid,patternUnits:'userSpaceOnUse'});
    pat.appendChild(svgN('path',{d:'M '+P.grid+' 0 L 0 0 0 '+P.grid, fill:'none', stroke:'#e8eff0', 'stroke-width':1})); defs.appendChild(pat); svg.appendChild(defs);
    var bg=svgN('rect',{x:0,y:0,width:P.wcm,height:P.hcm,fill:'url(#edgrid)'}); svg.appendChild(bg);
    svg.appendChild(svgN('rect',{x:1,y:1,width:P.wcm-2,height:P.hcm-2,fill:'none',stroke:'#dce5e8','stroke-width':2}));
    P.rooms.forEach(function(r){ svg.appendChild(buildRoomNode(r)); });
    P.items.forEach(function(it){ svg.appendChild(buildItemNode(it)); });
    buildTechEditorNodes(svg);
    attachBgHandler(svg,bg);
    return svg;
  }

  function goulotteLenM(points){ var L=0; for(var i=1;i<points.length;i++){ var dx=points[i].x-points[i-1].x, dy=points[i].y-points[i-1].y; L+=Math.sqrt(dx*dx+dy*dy); } return L/100; }
  function ptsAttr(points){ return points.map(function(p){return p.x+','+p.y;}).join(' '); }
  function buildTechEditorNodes(svg){
    ensurePlanTech(state.plan); var T=state.plan.tech;
    T.goulottes.forEach(function(g){
      var sel=isSel('goulotte',g.id);
      var pl=svgN('polyline',{points:ptsAttr(g.points), fill:'none', stroke:sel?'#0f1b24':'#c9760f', 'stroke-width':sel?5:4, 'stroke-dasharray':'10 6', 'stroke-linejoin':'round', 'stroke-linecap':'round', style:'cursor:pointer'});
      pl.addEventListener('pointerdown',function(ev){ if(state.planMode!=='select') return; ev.stopPropagation(); state.ui.planSel={kind:'goulotte',id:g.id}; renderSide(); renderPlanCanvas(); });
      svg.appendChild(pl);
    });
    T.trous.forEach(function(h){
      var sel=isSel('trou',h.id);
      var grp=svgN('g',{style:'cursor:pointer'});
      var r=Math.max(8, (+h.d||60)/4);
      grp.appendChild(svgN('circle',{cx:h.x, cy:h.y, r:r, fill:'rgba(191,70,49,.18)', stroke:sel?'#0f1b24':'#bf4631','stroke-width':sel?3:2}));
      grp.appendChild(svgN('line',{x1:h.x-r,y1:h.y,x2:h.x+r,y2:h.y, stroke:'#bf4631','stroke-width':1.5}));
      grp.appendChild(svgN('line',{x1:h.x,y1:h.y-r,x2:h.x,y2:h.y+r, stroke:'#bf4631','stroke-width':1.5}));
      var tx=svgN('text',{x:h.x+r+3,y:h.y+4,'font-size':12,fill:'#bf4631','font-weight':700}); tx.textContent='Ø'+(+h.d||60); grp.appendChild(tx);
      grp.addEventListener('pointerdown',function(ev){ if(state.planMode!=='select') return; ev.stopPropagation(); state.ui.planSel={kind:'trou',id:h.id}; renderSide(); renderPlanCanvas(); });
      svg.appendChild(grp);
    });
    if(state.planMode==='goulotte' && techDraft.length){
      svg.appendChild(svgN('polyline',{points:ptsAttr(techDraft), fill:'none', stroke:'#c9760f','stroke-width':4,'stroke-dasharray':'4 5','stroke-linejoin':'round','stroke-linecap':'round'}));
      techDraft.forEach(function(p){ svg.appendChild(svgN('circle',{cx:p.x,cy:p.y,r:5,fill:'#c9760f'})); });
    }
  }
  function finishGoulotte(){
    if(techDraft.length<2){ alert('Place au moins 2 points pour tracer une goulotte (clique sur le plan).'); return; }
    ensurePlanTech(state.plan);
    var g={id:UID(), points:techDraft.slice(), m:Math.round(goulotteLenM(techDraft)*100)/100, roomId:null};
    state.plan.tech.goulottes.push(g);
    techDraft=[]; state.planMode='select'; state.ui.planSel={kind:'goulotte',id:g.id}; save(); render();
  }
  function assignGoulotteToRoom(g, roomId){
    if(roomId){
      var r=state.quote.rooms.filter(function(x){return x.id===roomId;})[0];
      if(r){ ensureRoomTech(r);
        if((+r.tech.goulotteLen||0)>0 && Math.abs((+r.tech.goulotteLen)-g.m)>0.01 && !confirm('La goulotte de « '+r.name+' » est déjà à '+techRound1(r.tech.goulotteLen)+' m. La remplacer par '+techRound1(g.m)+' m (depuis le plan) ?')) return false;
        r.tech.goulotteLen=g.m; r.tech.goulotteSrc='plan';
      }
    }
    g.roomId=roomId||null; save(); return true;
  }

  function attachBgHandler(svg,bg){
    bg.addEventListener('pointerdown',function(ev){
      if(state.planMode==='goulotte' || state.planMode==='trou'){
        ev.stopPropagation();
        var start=svgPoint(svg,ev);
        try{ bg.setPointerCapture(ev.pointerId); }catch(e){}
        function up(e){ try{bg.releasePointerCapture(ev.pointerId);}catch(e2){} bg.removeEventListener('pointerup',up);
          var p=svgPoint(svg,e); if(Math.abs(p.x-start.x)+Math.abs(p.y-start.y)>15) return; // glissé → ignorer
          var x=snap(p.x), y=snap(p.y);
          if(state.planMode==='trou'){ ensurePlanTech(state.plan); state.plan.tech.trous.push({id:UID(), x:x, y:y, d:lastTrouDiam}); save(); renderPlanCanvas(); renderSide(); }
          else { techDraft.push({x:x,y:y}); renderPlanCanvas(); renderSide(); }
        }
        bg.addEventListener('pointerup',up);
        return;
      }
      if(state.planMode==='drawroom'){
        ev.stopPropagation();
        var start=svgPoint(svg,ev);
        var temp=svgN('rect',{fill:'rgba(14,154,168,.12)', stroke:'#0e9aa8','stroke-width':2, rx:6}); svg.appendChild(temp);
        try{ bg.setPointerCapture(ev.pointerId);}catch(e){}
        function mv(e){ var p=svgPoint(svg,e); var x=Math.min(start.x,p.x),y=Math.min(start.y,p.y),w=Math.abs(p.x-start.x),h=Math.abs(p.y-start.y); temp.setAttribute('x',x);temp.setAttribute('y',y);temp.setAttribute('width',w);temp.setAttribute('height',h); }
        function up(e){ try{bg.releasePointerCapture(ev.pointerId);}catch(e2){} bg.removeEventListener('pointermove',mv); bg.removeEventListener('pointerup',up);
          var p=svgPoint(svg,e); var x=snap(Math.min(start.x,p.x)),y=snap(Math.min(start.y,p.y)),w=snap(Math.abs(p.x-start.x)),h=snap(Math.abs(p.y-start.y)); temp.remove();
          if(w>=50&&h>=50){ var room={id:UID(),x:x,y:y,w:w,h:h,name:'Pièce '+(state.plan.rooms.length+1)}; state.plan.rooms.push(room); state.planMode='select'; state.ui.planSel={kind:'room',id:room.id}; save(); render(); } }
        bg.addEventListener('pointermove',mv); bg.addEventListener('pointerup',up);
      } else {
        if(state.ui.planSel){ state.ui.planSel=null; renderSide(); renderPlanCanvas(); }
      }
    });
  }

  function attachDrag(node,obj,kind){
    node.addEventListener('pointerdown',function(ev){
      if(state.planMode==='drawroom') return;
      ev.stopPropagation();
      var svg=node.ownerSVGElement; if(!svg) return;
      state.ui.planSel={kind:kind,id:obj.id}; renderSide();
      var rectEl=node.querySelector('rect'); if(rectEl){ rectEl.setAttribute('stroke', kind==='item'?'#0f1b24':'#0e9aa8'); rectEl.setAttribute('stroke-width',3); }
      var start=svgPoint(svg,ev); var ox=obj.x, oy=obj.y;
      try{ node.setPointerCapture(ev.pointerId);}catch(e){}
      function mv(e){ var p=svgPoint(svg,e); obj.x=clamp(ox+(p.x-start.x),0,maxX(obj,kind)); obj.y=clamp(oy+(p.y-start.y),0,maxY(obj,kind)); node._apply(); }
      function up(e){ try{node.releasePointerCapture(ev.pointerId);}catch(e2){} node.removeEventListener('pointermove',mv); node.removeEventListener('pointerup',up);
        obj.x=clamp(snap(obj.x),0,maxX(obj,kind)); obj.y=clamp(snap(obj.y),0,maxY(obj,kind)); node._apply(); save(); renderPlanCanvas(); }
      node.addEventListener('pointermove',mv); node.addEventListener('pointerup',up);
    });
  }

  function buildRoomNode(room){
    var sel=isSel('room',room.id);
    var g=svgN('g',{'data-id':room.id, style:'cursor:move'});
    var rect=svgN('rect',{rx:6,fill:'#ffffff',stroke:sel?'#0e9aa8':'#9fb6bd','stroke-width':sel?3:1.6});
    var t=svgN('text',{'font-size':16,fill:'#5e727c','font-weight':600});
    var dim=svgN('text',{'text-anchor':'end','font-size':13,fill:'#9fb6bd'});
    g.appendChild(rect); g.appendChild(t); g.appendChild(dim);
    g._apply=function(){ rect.setAttribute('x',room.x);rect.setAttribute('y',room.y);rect.setAttribute('width',room.w);rect.setAttribute('height',room.h);
      t.setAttribute('x',room.x+8);t.setAttribute('y',room.y+20); t.textContent=room.name;
      dim.setAttribute('x',room.x+room.w-8);dim.setAttribute('y',room.y+room.h-8);
      dim.textContent=(room.w/100).toFixed(1).replace('.',',')+'×'+(room.h/100).toFixed(1).replace('.',',')+' m'; };
    g._apply(); attachDrag(g,room,'room'); return g;
  }

  function buildItemNode(it){
    var meta=PLAN_ITEMS[it.type]; var sel=isSel('item',it.id);
    var g=svgN('g',{'data-id':it.id, style:'cursor:move'});
    var rect=svgN('rect',{x:0,y:0,width:meta.w,height:meta.h,rx:7, fill:meta.fill, stroke:sel?'#0f1b24':meta.stroke,'stroke-width':sel?3:2});
    g.appendChild(rect);
    var prod=it.productId? (meta.cat==='outdoor'?getOutdoor(it.productId):getProduct(it.productId)) : null;
    var l1=svgN('text',{x:meta.w/2,y:meta.h/2-(prod?6:0),'text-anchor':'middle','font-size':12,'font-weight':700,fill:'#0f1b24'}); l1.textContent=meta.label; g.appendChild(l1);
    if(prod){ var l2=svgN('text',{x:meta.w/2,y:meta.h/2+12,'text-anchor':'middle','font-size':10,fill:'#5e727c'}); l2.textContent=(prod.brand||'')+' '+fmtKw(prod.kw); g.appendChild(l2); }
    g._apply=function(){ g.setAttribute('transform','translate('+it.x+','+it.y+') rotate('+(it.rot||0)+' '+(meta.w/2)+' '+(meta.h/2)+')'); };
    g._apply(); attachDrag(g,it,'item'); return g;
  }

  function addItem(type){ var m=PLAN_ITEMS[type]; var it={id:UID(),type:type, x:clamp(snap(state.plan.wcm/2-m.w/2),0,maxX({type:type},'item')), y:clamp(snap(state.plan.hcm/2-m.h/2),0,maxY({type:type},'item')), rot:0, productId:null}; state.plan.items.push(it); state.planMode='select'; state.ui.planSel={kind:'item',id:it.id}; save(); render(); }

  function fromDevis(){
    if(state.quote.rooms.length===0){ alert('Aucune pièce dans le devis.'); return; }
    if(!confirm('Générer un plan à partir des pièces du devis ? Le plan actuel sera remplacé.')) return;
    var rooms=[], items=[], margin=40, gap=40, x=margin, y=margin, rowH=0, maxW=state.plan.wcm-margin;
    state.quote.rooms.forEach(function(r){
      var side=Math.max(200, Math.round(Math.sqrt(Math.max(4,+r.surface||9))*100));
      var w=side, h=Math.max(180, Math.round(side*0.8));
      if(x+w>maxW){ x=margin; y+=rowH+gap; rowH=0; }
      var room={id:UID(),x:snap(x),y:snap(y),w:snap(w),h:snap(h),name:r.name}; rooms.push(room);
      var p=getProduct(r.productId); var type=p?p.type:'mural'; if(!PLAN_ITEMS[type])type='mural'; var m=PLAN_ITEMS[type];
      items.push({id:UID(),type:type, x:snap(room.x+room.w/2-m.w/2), y:snap(room.y+room.h/2-m.h/2), rot:0, productId:r.productId||null});
      x+=w+gap; rowH=Math.max(rowH,h);
    });
    var ao=activeOutdoor(); var om=PLAN_ITEMS.outdoor;
    var needH = y+rowH+gap+om.h+margin;
    if(needH>state.plan.hcm) state.plan.hcm=Math.ceil(needH/50)*50;
    items.push({id:UID(),type:'outdoor', x:snap(margin), y:snap(Math.max(margin, state.plan.hcm-om.h-margin)), rot:0, productId: ao.unit?ao.unit.id:null});
    state.plan.rooms=rooms; state.plan.items=items; state.ui.planSel=null; save(); render();
  }

  function buildPlanSide(){
    var sel=state.ui.planSel;
    var c=el('div',{class:'card'}); var p=el('div',{class:'pad'});
    if(state.planMode==='goulotte'){
      p.appendChild(el('div',{class:'eyebrow'},['Technique']));
      p.appendChild(el('h2',{class:'section-title',style:'margin-bottom:6px'},['Tracé de goulotte']));
      p.appendChild(el('p',{class:'section-sub'},['Clique sur le plan pour ajouter des points (de l’unité vers le mur / groupe ext.). Longueur : '+techRound1(goulotteLenM(techDraft))+' m · '+techDraft.length+' point(s).']));
      var grow=el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px'});
      var fin=el('button',{class:'btn primary sm'},['✓ Terminer la goulotte']); fin.addEventListener('click', finishGoulotte);
      var und=el('button',{class:'btn subtle sm'},['↶ Retirer le point']); und.addEventListener('click',function(){ techDraft.pop(); renderPlanCanvas(); renderSide(); });
      var can=el('button',{class:'btn subtle sm'},['✕ Annuler']); can.addEventListener('click',function(){ techDraft=[]; state.planMode='select'; render(); });
      grow.appendChild(fin); grow.appendChild(und); grow.appendChild(can); p.appendChild(grow);
      c.appendChild(p); return c;
    }
    if(state.planMode==='trou'){
      p.appendChild(el('div',{class:'eyebrow'},['Technique']));
      p.appendChild(el('h2',{class:'section-title',style:'margin-bottom:6px'},['Trou de carottage']));
      p.appendChild(el('p',{class:'section-sub'},['Clique sur le plan pour poser un trou.']));
      p.appendChild(numField('Ø par défaut (mm)', lastTrouDiam, '1', function(v){ lastTrouDiam=Math.max(1,Math.round(+v||60)); }));
      p.appendChild(drillWarning());
      var doneB=el('button',{class:'btn subtle sm',style:'margin-top:10px'},['Terminer']); doneB.addEventListener('click',function(){ state.planMode='select'; render(); }); p.appendChild(doneB);
      c.appendChild(p); return c;
    }
    if(!sel){ p.appendChild(el('div',{class:'eyebrow'},['Édition'])); p.appendChild(el('h2',{class:'section-title',style:'margin-bottom:6px'},['Aucune sélection'])); p.appendChild(el('p',{class:'section-sub'},['Dessine une pièce, ajoute des éléments depuis la barre, puis clique un élément pour le régler ou le déplacer.'])); c.appendChild(p); return c; }
    if(sel.kind==='trou'){
      var hole=(state.plan.tech&&state.plan.tech.trous||[]).filter(function(x){return x.id===sel.id;})[0];
      if(!hole){ state.ui.planSel=null; return buildPlanSide(); }
      p.appendChild(el('div',{class:'eyebrow'},['Technique']));
      p.appendChild(el('h2',{class:'section-title',style:'margin-bottom:8px'},['Trou de carottage']));
      p.appendChild(numField('Ø (mm)', hole.d, '1', function(v){ hole.d=Math.max(1,Math.round(+v||60)); lastTrouDiam=hole.d; renderPlanCanvas(); save(); }));
      p.appendChild(drillWarning());
      var delH=el('button',{class:'btn danger sm',style:'margin-top:12px'},['Supprimer le trou']); delH.addEventListener('click',function(){ state.plan.tech.trous=state.plan.tech.trous.filter(function(x){return x.id!==hole.id;}); state.ui.planSel=null; save(); render(); }); p.appendChild(delH);
      c.appendChild(p); return c;
    }
    if(sel.kind==='goulotte'){
      var goul=(state.plan.tech&&state.plan.tech.goulottes||[]).filter(function(x){return x.id===sel.id;})[0];
      if(!goul){ state.ui.planSel=null; return buildPlanSide(); }
      p.appendChild(el('div',{class:'eyebrow'},['Technique']));
      p.appendChild(el('h2',{class:'section-title',style:'margin-bottom:8px'},['Goulotte — '+techRound1(goul.m)+' m']));
      var asel=el('select'); asel.appendChild(opt('','— Affecter à une unité… —', !goul.roomId));
      state.quote.rooms.forEach(function(r){ asel.appendChild(opt(r.id, r.name+(r.tech&&+r.tech.goulotteLen?(' ('+techRound1(r.tech.goulotteLen)+' m)'):''), goul.roomId===r.id)); });
      asel.addEventListener('change',function(){ if(!assignGoulotteToRoom(goul, asel.value||null)) asel.value=goul.roomId||''; renderSide(); });
      p.appendChild(el('label',{class:'field'},[el('span',null,['Reporter la longueur dans le relevé de l’unité']), asel]));
      p.appendChild(el('p',{class:'section-sub',style:'font-size:12px'},['La longueur est reportée dans tech.goulotteLen de l’unité choisie (marquée « depuis le plan »).']));
      var delG=el('button',{class:'btn danger sm',style:'margin-top:12px'},['Supprimer la goulotte']); delG.addEventListener('click',function(){ state.plan.tech.goulottes=state.plan.tech.goulottes.filter(function(x){return x.id!==goul.id;}); state.ui.planSel=null; save(); render(); }); p.appendChild(delG);
      c.appendChild(p); return c;
    }
    if(sel.kind==='room'){
      var room=state.plan.rooms.filter(function(r){return r.id===sel.id;})[0];
      if(!room){ state.ui.planSel=null; return buildPlanSide(); }
      p.appendChild(el('div',{class:'eyebrow'},['Pièce']));
      p.appendChild(textField('Nom', room.name,'', function(v){ room.name=v; renderPlanCanvas(); save(); }));
      var g=el('div',{class:'grid g2',style:'margin-top:12px'});
      g.appendChild(numField('Largeur (m)', (room.w/100), '0.1', function(v){ room.w=clamp(Math.round((+v||1)*100),50,state.plan.wcm); renderPlanCanvas(); save(); }));
      g.appendChild(numField('Profondeur (m)', (room.h/100), '0.1', function(v){ room.h=clamp(Math.round((+v||1)*100),50,state.plan.hcm); renderPlanCanvas(); save(); }));
      p.appendChild(g);
      p.appendChild(roomPhotoField(room));
      var del=el('button',{class:'btn danger sm',style:'margin-top:14px'},['Supprimer la pièce']); del.addEventListener('click',function(){ state.plan.rooms=state.plan.rooms.filter(function(r){return r.id!==room.id;}); state.ui.planSel=null; save(); render(); }); p.appendChild(del);
    } else {
      var it=state.plan.items.filter(function(x){return x.id===sel.id;})[0];
      if(!it){ state.ui.planSel=null; return buildPlanSide(); }
      var meta=PLAN_ITEMS[it.type];
      p.appendChild(el('div',{class:'eyebrow'},['Élément']));
      p.appendChild(el('h2',{class:'section-title',style:'margin-bottom:8px'},[meta.label]));
      var sel2=el('select'); sel2.appendChild(opt('','— Modèle non précisé —', !it.productId));
      var list = meta.cat==='outdoor'? state.outdoors : state.catalog.filter(function(pp){ return pp.type===it.type; });
      if(meta.cat!=='outdoor' && list.length===0) list=state.catalog;
      list.forEach(function(pp){ sel2.appendChild(opt(pp.id, pp.brand+' '+pp.model+' '+fmtKw(pp.kw)+(meta.cat==='outdoor'?(' / '+pp.ports+' sorties'):''), it.productId===pp.id)); });
      sel2.addEventListener('change',function(){ it.productId=sel2.value||null; renderPlanCanvas(); save(); });
      p.appendChild(el('label',{class:'field'},[el('span',null,['Modèle (catalogue)']), sel2]));
      var rot=el('button',{class:'btn subtle sm',style:'margin-top:12px'},['⟲ Pivoter 90°']); rot.addEventListener('click',function(){ it.rot=((it.rot||0)+90)%360; renderPlanCanvas(); save(); }); p.appendChild(rot);
      var del2=el('button',{class:'btn danger sm',style:'margin-top:12px; margin-left:8px'},['Supprimer']); del2.addEventListener('click',function(){ state.plan.items=state.plan.items.filter(function(x){return x.id!==it.id;}); state.ui.planSel=null; save(); render(); }); p.appendChild(del2);
    }
    c.appendChild(p); return c;
  }

  /* read-only SVG markup (client view + PDF) */
  function defaultItemResolve(it){ var m=PLAN_ITEMS[it.type]; return it.productId?(m.cat==='outdoor'?getOutdoor(it.productId):getProduct(it.productId)):null; }
  function planSVGString(opt){
    opt=opt||{}; var P=opt.plan||state.plan; var resolveItem=opt.resolveItem||defaultItemResolve;
    var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+P.wcm+' '+P.hcm+'" style="display:block;width:100%;height:auto;background:#fbfdfd" font-family="Inter,system-ui,sans-serif">';
    s+='<defs><pattern id="cvgrid" width="'+P.grid+'" height="'+P.grid+'" patternUnits="userSpaceOnUse"><path d="M '+P.grid+' 0 L 0 0 0 '+P.grid+'" fill="none" stroke="#e8eff0" stroke-width="1"/></pattern></defs>';
    s+='<rect x="0" y="0" width="'+P.wcm+'" height="'+P.hcm+'" fill="url(#cvgrid)"/>';
    s+='<rect x="1" y="1" width="'+(P.wcm-2)+'" height="'+(P.hcm-2)+'" fill="none" stroke="#dce5e8" stroke-width="2"/>';
    P.rooms.forEach(function(r){
      s+='<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'" rx="6" fill="#ffffff" stroke="#9fb6bd" stroke-width="1.6"/>';
      s+='<text x="'+(r.x+8)+'" y="'+(r.y+20)+'" font-size="16" font-weight="600" fill="#5e727c">'+escapeHtml(r.name)+'</text>';
      s+='<text x="'+(r.x+r.w-8)+'" y="'+(r.y+r.h-8)+'" text-anchor="end" font-size="13" fill="#9fb6bd">'+((r.w/100).toFixed(1).replace('.',',')+'×'+(r.h/100).toFixed(1).replace('.',',')+' m')+'</text>';
    });
    P.items.forEach(function(it){
      var m=PLAN_ITEMS[it.type]; var prod=resolveItem(it); var cx=m.w/2, cy=m.h/2;
      s+='<g transform="translate('+it.x+','+it.y+') rotate('+(it.rot||0)+' '+cx+' '+cy+')">';
      s+='<rect x="0" y="0" width="'+m.w+'" height="'+m.h+'" rx="7" fill="'+m.fill+'" stroke="'+m.stroke+'" stroke-width="2"/>';
      s+='<text x="'+cx+'" y="'+(cy-(prod?6:0))+'" text-anchor="middle" font-size="12" font-weight="700" fill="#0f1b24">'+escapeHtml(m.label)+'</text>';
      if(prod) s+='<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" font-size="10" fill="#5e727c">'+escapeHtml((prod.brand||'')+' '+fmtKw(prod.kw))+'</text>';
      s+='</g>';
    });
    if(opt.technical && P.tech){
      (P.tech.goulottes||[]).forEach(function(g){
        if(!g.points||!g.points.length) return;
        s+='<polyline points="'+ptsAttr(g.points)+'" fill="none" stroke="#c9760f" stroke-width="4" stroke-dasharray="10 6" stroke-linejoin="round" stroke-linecap="round"/>';
        var mid=g.points[Math.floor(g.points.length/2)];
        s+='<text x="'+mid.x+'" y="'+(mid.y-6)+'" font-size="13" fill="#c9760f" font-weight="700">'+techRound1(g.m)+' m</text>';
      });
      (P.tech.trous||[]).forEach(function(h){
        var r=Math.max(8,(+h.d||60)/4);
        s+='<circle cx="'+h.x+'" cy="'+h.y+'" r="'+r+'" fill="rgba(191,70,49,.18)" stroke="#bf4631" stroke-width="2"/>';
        s+='<line x1="'+(h.x-r)+'" y1="'+h.y+'" x2="'+(h.x+r)+'" y2="'+h.y+'" stroke="#bf4631" stroke-width="1.5"/><line x1="'+h.x+'" y1="'+(h.y-r)+'" x2="'+h.x+'" y2="'+(h.y+r)+'" stroke="#bf4631" stroke-width="1.5"/>';
        s+='<text x="'+(h.x+r+3)+'" y="'+(h.y+4)+'" font-size="12" fill="#bf4631" font-weight="700">Ø'+(+h.d||60)+'</text>';
      });
    }
    s+='</svg>'; return s;
  }
  function planHasContent(){ return state.plan && (state.plan.rooms.length||state.plan.items.length); }
  function countItems(){
    var map={}; state.plan.items.forEach(function(it){ var meta=PLAN_ITEMS[it.type]; var prod=it.productId?(meta.cat==='outdoor'?getOutdoor(it.productId):getProduct(it.productId)):null; var key=it.type+'|'+(it.productId||''); var label=meta.label+(prod?' — '+(prod.brand||'')+' '+(prod.model||'')+' '+fmtKw(prod.kw):''); if(!map[key]) map[key]={n:0,stroke:meta.stroke,label:label}; map[key].n++; });
    return Object.keys(map).map(function(k){ var m=map[k]; return {text:m.n+'× '+m.label, stroke:m.stroke}; });
  }

  function renderClientView(){
    var co=state.company, q=state.quote, t=computeTotals();
    var dateStr = q.date? new Date(q.date+'T00:00').toLocaleDateString('fr-BE') : new Date().toLocaleDateString('fr-BE');
    var box=el('div');
    var bar=el('div',{style:'margin-bottom:14px; display:flex; gap:8px; align-items:center; flex-wrap:wrap'});
    var back=el('button',{class:'btn subtle'},['← Retour à l\u2019édition']); back.addEventListener('click',function(){ state.ui.clientView=false; render(); });
    var tg=el('button',{class:'btn subtle'},[state.ui.clientPrices?'Masquer les prix':'Afficher les prix']); tg.addEventListener('click',function(){ state.ui.clientPrices=!state.ui.clientPrices; save(); render(); });
    var pr=el('button',{class:'btn primary'},['🖨 Imprimer le devis + plan']); pr.addEventListener('click',function(){ buildPrint(); window.print(); });
    var sh=el('button',{class:'btn primary'},['📤 Partager au client (lien + QR)']); sh.addEventListener('click', openShareModal);
    bar.appendChild(back); bar.appendChild(tg); bar.appendChild(pr); bar.appendChild(sh); box.appendChild(bar);

    var cv=el('div',{class:'cv'});
    var head=el('div',{class:'cv-head'});
    var coInfo=el('div'); if(co.logo){ var im=el('img'); im.src=co.logo; coInfo.appendChild(im); }
    coInfo.appendChild(el('div',{class:'co-name'},[co.name||'Votre société']));
    coInfo.appendChild(el('div',{style:'font-size:12.5px;color:#bcd0d6;margin-top:4px'},[(co.phone||'')+(co.email?'  ·  '+co.email:'')]));
    var meta=el('div',{class:'meta'}); meta.innerHTML='<b style="color:#fff">Votre projet climatisation</b><br>'+(q.client.name?escapeHtml(q.client.name)+'<br>':'')+(q.client.addr?escapeHtml(q.client.addr)+'<br>':'')+dateStr;
    head.appendChild(coInfo); head.appendChild(meta); cv.appendChild(head);

    var body=el('div',{class:'cv-body'});
    if(planHasContent()){ var pw=el('div',{class:'cv-plan'}); pw.innerHTML=planSVGString({readonly:true}); body.appendChild(pw); }
    else body.appendChild(el('p',{class:'section-sub'},['Aucun plan dessiné. Reviens à l\u2019édition pour en créer un, ou utilise « Reprendre les pièces du devis ».']));
    var counts=countItems(); if(counts.length){ var leg=el('div',{class:'cv-legend'}); counts.forEach(function(cc){ leg.appendChild(el('div',{class:'cv-leg'},[ el('span',{class:'sw',style:'background:'+cc.stroke}), document.createTextNode(cc.text) ])); }); body.appendChild(leg); }
    if(state.ui.clientPrices){
      var fin=computeFinance(); var roi=computeROI();
      var offer=el('div',{class:'cv-offer'});
      var headlineLabel = (fin.prime.eligible&&fin.prime.amount>0)? 'Reste à charge estimé après prime' : 'Investissement total TVAC';
      var headlineVal = (fin.prime.eligible&&fin.prime.amount>0)? fin.reste : t.tvac;
      offer.appendChild(el('div',null,[ el('div',{class:'total-label'},[headlineLabel]), el('div',{class:'big num'},[euro.format(headlineVal)]) ]));
      var rh=el('div',{style:'font-size:12.5px;color:var(--muted);text-align:right'});
      var rhHtml = 'Total '+euro.format(t.tvac)+' TVAC (TVA '+state.settings.vat+' %)';
      if(fin.prime.eligible&&fin.prime.amount>0) rhHtml += '<br>Prime Région estimée : −'+euro.format(fin.prime.amount);
      rhHtml += '<br>Acompte à la commande : '+euro.format(fin.acompte);
      rh.innerHTML=rhHtml; offer.appendChild(rh); body.appendChild(offer);
      if(roi && roi.annual>0){
        var roiBox=el('div',{style:'margin-top:14px; background:var(--good-wash); border:1px solid #c7e6d3; border-radius:12px; padding:14px 16px; font-size:13px; color:#23603f'});
        roiBox.innerHTML='💡 <b>Économies estimées</b> : environ '+euro.format(roi.annual)+' / an vs votre énergie actuelle'+(roi.payback?', soit un retour sur le reste à charge en ~'+roi.payback.toFixed(1).replace('.',',')+' ans.':'.')+' <span style="color:var(--muted)">Estimation indicative selon les hypothèses de prix et de SCOP.</span>';
        body.appendChild(roiBox);
      }
    }
    body.appendChild(el('div',{class:'cv-note'},['Climatisation réversible (pompe à chaleur air-air). TVA réduite à 6 % sur fourniture et pose appliquée. Estimation sous réserve de visite technique. '+(co.footer||'')]));
    cv.appendChild(body); box.appendChild(cv);
    return box;
  }

  /* ============================================================
     PARTAGE : proposition autonome (lien #hash + QR), sans backend
     ============================================================ */
  var SHARE_QR_LIMIT=1800; // au-delà, un QR n'est plus fiable à scanner depuis un écran
  function r0(v){ return Math.round(+v||0); }
  function sharedItemResolve(it){ return it.b? {brand:it.b, kw:it.k} : null; }
  function sharedPlanObj(pl){ return { wcm:pl.w, hcm:pl.h, grid:pl.g, rooms:pl.rooms||[], items:pl.items||[] }; }

  // Instantané résolu et compact : seulement ce qui s'affiche, montants figés, sans photos ni catalogue.
  function buildShareSnapshot(){
    var co=state.company, q=state.quote, t=computeTotals(), fin=computeFinance(), roi=computeROI(), P=state.plan;
    return {
      v:1,
      co:{ n:co.name||'', p:co.phone||'', e:co.email||'', f:co.footer||'' },
      cl:{ n:q.client.name||'', a:q.client.addr||'' },
      d: q.date || new Date().toISOString().slice(0,10),
      pr: !!state.ui.clientPrices,
      vat: state.settings.vat,
      t:{ tvac:r0(t.tvac), vat:r0(t.vat) },
      f:{ ac:r0(fin.acompte), re:r0(fin.reste), pe:!!(fin.prime.eligible&&fin.prime.amount>0), pa:r0(fin.prime.amount) },
      r: (roi&&roi.annual>0)? { a:r0(roi.annual), p:(roi.payback!=null? Math.round(roi.payback*10)/10 : null) } : null,
      lg: countItems(),
      pl:{ w:P.wcm, h:P.hcm, g:P.grid,
        rooms: P.rooms.map(function(rm){ return { x:rm.x, y:rm.y, w:rm.w, h:rm.h, name:rm.name }; }),
        items: P.items.map(function(it){ var prod=defaultItemResolve(it); return { type:it.type, x:it.x, y:it.y, rot:it.rot||0, b:prod?(prod.brand||''):'', k:prod?(+prod.kw||0):0 }; })
      }
    };
  }
  function shareURL(snap){
    var payload=LZString.compressToEncodedURIComponent(JSON.stringify(snap));
    return location.href.replace(/#.*$/,'') + '#p=' + payload;
  }

  function openShareModal(){
    if(typeof LZString==='undefined'){ alert('Le partage nécessite une connexion internet (librairie de compression non chargée). Reconnecte-toi puis recharge la page.'); return; }
    var snap, url;
    try{ snap=buildShareSnapshot(); url=shareURL(snap); }
    catch(e){ alert('Impossible de générer le lien : '+(e&&e.message||e)); return; }

    var back=el('div',{class:'share-modal', id:'shareModal'});
    var panel=el('div',{class:'share-panel'});
    panel.appendChild(el('div',{class:'eyebrow'},['Proposition']));
    panel.appendChild(el('h2',{class:'section-title',style:'margin:2px 0 4px'},['Partager au client']));
    panel.appendChild(el('p',{class:'section-sub',style:'margin-bottom:12px'},['Le client scanne le QR ou ouvre le lien : il voit l’offre, le plan et la 3D en lecture seule, même hors de votre présence. '+(snap.pr?'Prix affichés.':'Prix masqués.')]));

    var qrHost=el('div',{class:'share-qr'});
    if(url.length<=SHARE_QR_LIMIT){
      try{ var qr=qrcode(0,'M'); qr.addData(url); qr.make(); qrHost.innerHTML=qr.createImgTag(6,12); }
      catch(e){ qrHost.appendChild(el('div',{class:'share-qr-msg'},['QR indisponible (proposition trop volumineuse). Utilise « Copier le lien » ou « Partager » ci-dessous.'])); }
    } else {
      qrHost.appendChild(el('div',{class:'share-qr-msg'},['Proposition trop volumineuse pour un QR fiable. Le lien reste valable : utilise « Copier le lien » ou « Partager ».']));
    }
    panel.appendChild(qrHost);

    var linkIn=el('input',{class:'share-link', type:'text', readonly:'readonly'}); linkIn.value=url;
    linkIn.addEventListener('focus',function(){ linkIn.select(); });
    panel.appendChild(linkIn);

    var status=el('div',{class:'share-status'},['']);
    function flash(msg){ status.textContent=msg; }

    var row=el('div',{class:'share-actions'});
    var copyBtn=el('button',{class:'btn primary'},['📋 Copier le lien']);
    copyBtn.addEventListener('click',function(){
      function ok(){ flash('Lien copié dans le presse-papiers.'); }
      function fb(){ try{ linkIn.focus(); linkIn.select(); document.execCommand('copy'); ok(); }catch(e){ flash('Copie impossible — sélectionne le lien manuellement.'); } }
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(ok, fb); } else { fb(); }
    });
    row.appendChild(copyBtn);
    if(navigator.share){
      var shareBtn=el('button',{class:'btn subtle'},['🔗 Partager…']);
      shareBtn.addEventListener('click',function(){ navigator.share({ title:'Votre proposition climatisation', text:'Votre proposition de '+(snap.co.n||'votre installateur'), url:url }).then(function(){ flash('Partagé.'); }, function(){}); });
      row.appendChild(shareBtn);
    }
    var closeBtn=el('button',{class:'btn ghost'},['Fermer']);
    closeBtn.addEventListener('click',closeShareModal);
    row.appendChild(closeBtn);
    panel.appendChild(row);
    panel.appendChild(status);
    panel.appendChild(el('div',{class:'share-foot'},['Lien autonome : tout est encodé dans l’adresse (après le #). Aucune donnée n’est envoyée à un serveur. '+url.length+' caractères.']));

    back.appendChild(panel);
    back.addEventListener('click',function(e){ if(e.target===back) closeShareModal(); });
    document.body.appendChild(back);
  }
  function closeShareModal(){ var m=document.getElementById('shareModal'); if(m&&m.parentNode) m.parentNode.removeChild(m); }

  // Décodage à l'ouverture d'un lien partagé.
  function decodeShared(){
    try{
      var h=location.hash||'';
      if(h.indexOf('#p=')!==0) return null;
      if(typeof LZString==='undefined') return null;
      var raw=LZString.decompressFromEncodedURIComponent(h.slice(3));
      if(!raw) return null;
      var snap=JSON.parse(raw);
      return (snap && snap.v===1) ? snap : null;
    }catch(e){ return null; }
  }
  function tryRenderShared(){
    var snap=decodeShared(); if(!snap) return false;
    state.ui.shared=true;
    document.body.classList.add('shared-mode');
    if(threeCleanup){ try{threeCleanup();}catch(e){} threeCleanup=null; }
    viewEl.innerHTML=''; viewEl.appendChild(renderSharedProposal(snap));
    return true;
  }

  function renderSharedProposal(snap){
    var box=el('div');
    box.appendChild(el('div',{class:'banner info',style:'margin-bottom:14px'},['Proposition établie par '+(snap.co.n||'votre installateur')+' — document en lecture seule.']));
    var cv=el('div',{class:'cv'});
    var head=el('div',{class:'cv-head'});
    var coInfo=el('div');
    coInfo.appendChild(el('div',{class:'co-name'},[snap.co.n||'Votre société']));
    coInfo.appendChild(el('div',{style:'font-size:12.5px;color:#bcd0d6;margin-top:4px'},[(snap.co.p||'')+(snap.co.e?'  ·  '+snap.co.e:'')]));
    var dateStr = snap.d? new Date(snap.d+'T00:00').toLocaleDateString('fr-BE') : '';
    var meta=el('div',{class:'meta'}); meta.innerHTML='<b style="color:#fff">Votre projet climatisation</b><br>'+(snap.cl.n?escapeHtml(snap.cl.n)+'<br>':'')+(snap.cl.a?escapeHtml(snap.cl.a)+'<br>':'')+dateStr;
    head.appendChild(coInfo); head.appendChild(meta); cv.appendChild(head);

    var body=el('div',{class:'cv-body'});
    var hasPlan = snap.pl && ((snap.pl.rooms&&snap.pl.rooms.length)||(snap.pl.items&&snap.pl.items.length));
    if(hasPlan){ var pw=el('div',{class:'cv-plan'}); pw.innerHTML=planSVGString({plan:sharedPlanObj(snap.pl), resolveItem:sharedItemResolve}); body.appendChild(pw); }
    if(snap.lg && snap.lg.length){ var leg=el('div',{class:'cv-legend'}); snap.lg.forEach(function(cc){ leg.appendChild(el('div',{class:'cv-leg'},[ el('span',{class:'sw',style:'background:'+cc.stroke}), document.createTextNode(cc.text) ])); }); body.appendChild(leg); }
    if(hasPlan && typeof THREE!=='undefined'){
      var wrap=el('div',{style:'position:relative; margin-top:14px; border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; background:#0f1b24; height:52vh; touch-action:none'});
      body.appendChild(wrap);
      body.appendChild(el('div',{class:'plan-hint'},['Maquette 3D — glisse pour pivoter, molette ou pince pour zoomer.']));
      setTimeout(function(){ try{ buildThreeScene(wrap, sharedPlanObj(snap.pl), sharedItemResolve); }catch(e){ wrap.innerHTML='<div style="color:#eef4f5;padding:24px;font-size:13px">3D indisponible sur cet appareil — voir le plan ci-dessus.</div>'; } },0);
    }
    if(snap.pr){
      var offer=el('div',{class:'cv-offer'});
      var hasPrime = snap.f.pe && snap.f.pa>0;
      var headlineLabel = hasPrime? 'Reste à charge estimé après prime' : 'Investissement total TVAC';
      var headlineVal = hasPrime? snap.f.re : snap.t.tvac;
      offer.appendChild(el('div',null,[ el('div',{class:'total-label'},[headlineLabel]), el('div',{class:'big num'},[euro.format(headlineVal)]) ]));
      var rh=el('div',{style:'font-size:12.5px;color:var(--muted);text-align:right'});
      var rhHtml='Total '+euro.format(snap.t.tvac)+' TVAC (TVA '+snap.vat+' %)';
      if(hasPrime) rhHtml+='<br>Prime Région estimée : −'+euro.format(snap.f.pa);
      rhHtml+='<br>Acompte à la commande : '+euro.format(snap.f.ac);
      rh.innerHTML=rhHtml; offer.appendChild(rh); body.appendChild(offer);
      if(snap.r && snap.r.a>0){
        var roiBox=el('div',{style:'margin-top:14px; background:var(--good-wash); border:1px solid #c7e6d3; border-radius:12px; padding:14px 16px; font-size:13px; color:#23603f'});
        roiBox.innerHTML='💡 <b>Économies estimées</b> : environ '+euro.format(snap.r.a)+' / an'+(snap.r.p!=null?', soit un retour sur le reste à charge en ~'+String(snap.r.p).replace('.',',')+' ans.':'.')+' <span style="color:var(--muted)">Estimation indicative.</span>';
        body.appendChild(roiBox);
      }
    }
    body.appendChild(el('div',{class:'cv-note'},['Climatisation réversible (pompe à chaleur air-air). TVA réduite à 6 % appliquée. Estimation sous réserve de visite technique. '+(snap.co.f||'')]));
    cv.appendChild(body); box.appendChild(cv);
    return box;
  }

  /* ============================================================
     TECHNIQUE / POSE — relevé, synthèse matériaux, fiche de pose
     ============================================================ */
  function techRound1(v){ return (Math.round((+v||0)*10)/10).toString().replace('.',','); }
  function techValidationBanner(){
    return el('div',{class:'banner warn',style:'margin-bottom:14px',html:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l7 13H1L8 1z" stroke="#b6810f" stroke-width="1.4" stroke-linejoin="round"/></svg><div><b>Relevé de pose</b> — à valider sur site par l’installateur certifié et l’électricien. Dimensionnement électrique, charge de réfrigérant et perçages sous leur responsabilité.</div>'});
  }
  function drillWarning(){
    return el('div',{class:'banner warn',style:'margin:6px 0',html:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l7 13H1L8 1z" stroke="#b6810f" stroke-width="1.4" stroke-linejoin="round"/></svg><div><b>Avant perçage :</b> vérifier l’absence de câbles électriques, canalisations et éléments de structure. L’app ne certifie pas qu’un perçage est sûr.</div>'});
  }
  function prefillTech(r){
    var tech=ensureRoomTech(r), prod=getProduct(r.productId);
    if(prod){
      if(tech.diamLiquide==='' && prod.diamLiquide) tech.diamLiquide=prod.diamLiquide;
      if(tech.diamGaz==='' && prod.diamGaz) tech.diamGaz=prod.diamGaz;
      if(tech.goulotteSection==='' && prod.goulotteSectionConseillee) tech.goulotteSection=prod.goulotteSectionConseillee;
    }
    if((+tech.goulotteLen||0)===0 && (+tech.liaisonLen||0)>0) tech.goulotteLen=+tech.liaisonLen;
    return tech;
  }

  // Agrégation des fournitures sur toutes les unités. Logique pure → testable.
  function computeTechSynthesis(){
    var rooms=state.quote.rooms||[];
    var liaisonByPair={}, goulotteBySection={}, trousByDiam={};
    var pompes=0, evacTotal=0, elecTotal=0, liaisonTotal=0, goulotteTotal=0;
    var chargeRows=[], chargeTotal=0, chargeUnknown=false, alerts=[];
    rooms.forEach(function(r){
      var tech=ensureRoomTech(r), prod=getProduct(r.productId);
      var dl=tech.diamLiquide||(prod&&prod.diamLiquide)||'', dg=tech.diamGaz||(prod&&prod.diamGaz)||'';
      var pair=(dl||'?')+'–'+(dg||'?');
      var L=+tech.liaisonLen||0; if(L>0){ liaisonByPair[pair]=(liaisonByPair[pair]||0)+L; liaisonTotal+=L; }
      var gs=tech.goulotteSection||(prod&&prod.goulotteSectionConseillee)||'?';
      var GL=+tech.goulotteLen||0; if(GL>0){ goulotteBySection[gs]=(goulotteBySection[gs]||0)+GL; goulotteTotal+=GL; }
      var d=+tech.trouDiam||0, n=+tech.trouNb||0; if(d>0&&n>0) trousByDiam[d]=(trousByDiam[d]||0)+n;
      if(tech.condensats==='pompe') pompes++;
      evacTotal+=+tech.evacLen||0; elecTotal+=+tech.elecAmeneeLen||0;
      var base=(prod && prod.liaisonBaseLen!=='' && prod.liaisonBaseLen!=null)?+prod.liaisonBaseLen:null;
      var gm=(prod && prod.chargeGM!=='' && prod.chargeGM!=null)?+prod.chargeGM:null;
      if(base!=null && gm!=null){ var add=Math.max(0,L-base)*gm; chargeRows.push({room:r.name,grams:add}); chargeTotal+=add; }
      else { chargeRows.push({room:r.name,grams:null}); chargeUnknown=true; }
      var maxL=(prod && prod.liaisonMaxLen!=='' && prod.liaisonMaxLen!=null)?+prod.liaisonMaxLen:null;
      var maxD=(prod && prod.denivMax!=='' && prod.denivMax!=null)?+prod.denivMax:null;
      if(maxL!=null && L>maxL) alerts.push({room:r.name,msg:'liaison '+techRound1(L)+' m dépasse la longueur max du modèle ('+techRound1(maxL)+' m)'});
      if(maxD!=null && (+tech.deniv||0)>maxD) alerts.push({room:r.name,msg:'dénivelé '+techRound1(tech.deniv)+' m dépasse le dénivelé max du modèle ('+techRound1(maxD)+' m)'});
    });
    var trousTotal=0; for(var k in trousByDiam) trousTotal+=trousByDiam[k];
    var supportCount=rooms.length;
    return {liaisonByPair:liaisonByPair, goulotteBySection:goulotteBySection, trousByDiam:trousByDiam, trousTotal:trousTotal, supportCount:supportCount, pompes:pompes, evacTotal:evacTotal, elecTotal:elecTotal, liaisonTotal:liaisonTotal, goulotteTotal:goulotteTotal, chargeRows:chargeRows, chargeTotal:chargeTotal, chargeUnknown:chargeUnknown, alerts:alerts};
  }

  var techSynthHost=null;
  function refreshTechSynth(){ if(techSynthHost){ techSynthHost.innerHTML=''; techSynthHost.appendChild(buildTechSynthesis()); } }
  function techNum(label,obj,key,step){ var i=el('input',{type:'number',step:step||'1',min:'0'}); i.value=obj[key]; i.addEventListener('input',function(){ obj[key]=i.value===''?0:+i.value; save(); refreshTechSynth(); }); return el('label',{class:'field'},[el('span',null,[label]),i]); }
  function techText(label,obj,key,ph){ var i=el('input',{type:'text'}); i.value=obj[key]||''; if(ph)i.placeholder=ph; i.addEventListener('input',function(){ obj[key]=i.value; save(); refreshTechSynth(); }); return el('label',{class:'field'},[el('span',null,[label]),i]); }
  function techTextBadge(label,obj,key,ph,showBadge){ var i=el('input',{type:'text'}); i.value=obj[key]||''; if(ph)i.placeholder=ph; i.addEventListener('input',function(){ obj[key]=i.value; save(); refreshTechSynth(); }); var sp=el('span',null,[label]); if(showBadge) sp.appendChild(el('span',{class:'badge-confirm'},['à confirmer'])); return el('label',{class:'field'},[sp,i]); }
  function techSel(label,obj,key,options){ var s=el('select'); options.forEach(function(o){ s.appendChild(opt(o[0],o[1],o[0]===obj[key])); }); s.addEventListener('change',function(){ obj[key]=s.value; save(); refreshTechSynth(); }); return el('label',{class:'field'},[el('span',null,[label]),s]); }

  function techRoomCard(r){
    var tech=r.tech, prod=getProduct(r.productId);
    var card=el('div',{class:'room',style:'margin-bottom:14px'});
    var head=el('div',{class:'room-head'});
    head.appendChild(el('div',{class:'room-name'},[el('b',null,[r.name||'Pièce'])]));
    head.appendChild(el('span',{style:'font-size:12.5px;color:var(--muted)'},[ prod?(prod.brand+' '+prod.model+' '+fmtKw(prod.kw)):'unité à définir' ]));
    card.appendChild(head);
    var body=el('div',{class:'room-body'});
    var g1=el('div',{class:'room-grid'});
    g1.appendChild(techNum('Longueur liaison (m)',tech,'liaisonLen','0.5'));
    g1.appendChild(techNum('Dénivelé int/ext (m)',tech,'deniv','0.5'));
    g1.appendChild(techTextBadge('Ø liquide',tech,'diamLiquide','1/4', !(prod&&prod.diamLiquide)));
    g1.appendChild(techTextBadge('Ø gaz',tech,'diamGaz','3/8', !(prod&&prod.diamGaz)));
    body.appendChild(g1);
    var g2=el('div',{class:'room-grid'});
    g2.appendChild(techSel('Condensats',tech,'condensats',[['gravite','Gravité'],['pompe','Pompe de relevage']]));
    g2.appendChild(techNum('Évacuation (m)',tech,'evacLen','0.5'));
    g2.appendChild(techNum('Goulotte (m)',tech,'goulotteLen','0.5'));
    g2.appendChild(techTextBadge('Section goulotte',tech,'goulotteSection','60x45', !(prod&&prod.goulotteSectionConseillee)));
    body.appendChild(g2);
    var g3=el('div',{class:'room-grid'});
    g3.appendChild(techNum('Ø trou (mm)',tech,'trouDiam','1'));
    g3.appendChild(techNum('Nb trous',tech,'trouNb','1'));
    g3.appendChild(techText('Position du trou',tech,'trouNote','ex. derrière l’unité, h 2,1 m'));
    g3.appendChild(techSel('Support',tech,'support',[['equerres','Équerres'],['plots','Plots anti-vibration'],['console','Console au sol']]));
    body.appendChild(g3);
    body.appendChild(drillWarning());
    var g4=el('div',{class:'room-grid'});
    g4.appendChild(techText('Note électrique',tech,'elecNote','circuit dédié — à confirmer'));
    g4.appendChild(techNum('Amenée élec (m)',tech,'elecAmeneeLen','0.5'));
    body.appendChild(g4);
    body.appendChild(el('div',{class:'section-sub',style:'font-size:12px'},[ prod&&prod.disjoncteur ? ('Disjoncteur conseillé (modèle) : '+prod.disjoncteur+' — à confirmer par l’électricien.') : 'Disjoncteur : à confirmer par l’électricien (non renseigné au catalogue).' ]));
    card.appendChild(body);
    return card;
  }

  function synthSection(title, lines){
    var d=el('div',{style:'margin-bottom:10px'});
    d.appendChild(el('div',{style:'font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:4px'},[title]));
    if(!lines.length) d.appendChild(el('div',{class:'section-sub',style:'font-size:12px'},['—']));
    else lines.forEach(function(ln){ d.appendChild(el('div',{style:'font-size:13px'},[ln])); });
    return d;
  }
  function mapToLines(obj, suffix){ return Object.keys(obj).map(function(k){ return k+' : '+techRound1(obj[k])+(suffix||''); }); }
  function buildTechSynthesis(){
    var s=computeTechSynthesis();
    var c=el('div',{class:'card summary'}); var p=el('div',{class:'pad'});
    p.appendChild(el('div',{class:'eyebrow'},['Synthèse']));
    p.appendChild(el('h2',{class:'section-title',style:'font-size:15px;margin-bottom:8px'},['Matériaux']));
    if(s.alerts.length){ var ab=el('div',{class:'banner warn',style:'margin-bottom:10px'}); var inner=el('div'); inner.appendChild(el('b',null,['⚠ Dépassements modèle'])); s.alerts.forEach(function(a){ inner.appendChild(el('div',{style:'font-size:12px'},[a.room+' : '+a.msg])); }); ab.appendChild(inner); p.appendChild(ab); }
    p.appendChild(synthSection('Liaisons frigorifiques', mapToLines(s.liaisonByPair, ' m')));
    p.appendChild(synthSection('Goulottes', mapToLines(s.goulotteBySection, ' m')));
    p.appendChild(synthSection('Trous de carottage', Object.keys(s.trousByDiam).map(function(d){ return 'Ø '+d+' mm : '+s.trousByDiam[d]; })));
    p.appendChild(synthSection('Divers', ['Pompes de relevage : '+s.pompes, 'Supports / fixations : '+s.supportCount, 'Évacuation condensats : '+techRound1(s.evacTotal)+' m', 'Amenée électrique : '+techRound1(s.elecTotal)+' m']));
    var chargeLines=s.chargeRows.map(function(cr){ return cr.room+' : '+(cr.grams==null?'à confirmer':Math.round(cr.grams)+' g'); });
    var chSec=synthSection('Charge add. de réfrigérant (estimation)', chargeLines);
    chSec.appendChild(el('div',{style:'font-size:12px;font-weight:700;margin-top:4px'},['Total estimé : '+Math.round(s.chargeTotal)+' g'+(s.chargeUnknown?' (+ à confirmer)':'')]));
    chSec.appendChild(el('div',{class:'section-sub',style:'font-size:11px'},['Estimation — à confirmer et peser par l’installateur certifié.']));
    p.appendChild(chSec);
    p.appendChild(el('div',{class:'banner warn',style:'margin-top:12px',html:'<div>Relevé de pose — à valider sur site par l’installateur certifié et l’électricien. Charge de réfrigérant, dimensionnement électrique et perçages sous leur responsabilité.</div>'}));
    c.appendChild(p); return c;
  }

  // Fournitures techniques dérivées de la synthèse. Prix depuis state.labour.techPrices (Réglages).
  var TECH_SUPPLY_DEFS=[
    {key:'goulotte', label:'Goulotte', unit:'m', priceKey:'goulotteM', qty:function(s){return s.goulotteTotal;}},
    {key:'carottage', label:'Carottage / trou', unit:'u', priceKey:'carottage', qty:function(s){return s.trousTotal;}},
    {key:'pompe', label:'Pompe de relevage des condensats', unit:'u', priceKey:'pompe', qty:function(s){return s.pompes;}},
    {key:'evac', label:'Évacuation condensats', unit:'m', priceKey:'evacM', qty:function(s){return s.evacTotal;}},
    {key:'support', label:'Support / fixation', unit:'u', priceKey:'support', qty:function(s){return s.supportCount;}},
    {key:'elec', label:'Amenée électrique', unit:'m', priceKey:'elecM', qty:function(s){return s.elecTotal;}}
  ];
  // Idempotent : repère les lignes par origin:'tech'+key, met à jour qty/prix au lieu de dupliquer.
  function addTechSuppliesToQuote(){
    var s=computeTechSynthesis(); var tp=ensureTechPrices();
    // Liaisons : on synchronise la longueur relevée dans le mécanisme de liaison existant (pas de doublon).
    state.quote.rooms.forEach(function(r){ var L=+r.tech.liaisonLen||0; if(L>0) r.liaisonM=L; });
    var added=0, untar=false;
    TECH_SUPPLY_DEFS.forEach(function(def){
      var qty=Math.round(def.qty(s)*100)/100, unitPrice=+tp[def.priceKey]||0;
      var existing=state.quote.extraLines.filter(function(l){ return l.origin==='tech' && l.key===def.key; })[0];
      var label=def.label+(def.unit==='m'?' (m)':'');
      if(qty>0){
        if(existing){ existing.qty=qty; existing.unitPrice=unitPrice; existing.label=label; existing.unit=def.unit; }
        else state.quote.extraLines.push({origin:'tech', key:def.key, label:label, unit:def.unit, qty:qty, unitPrice:unitPrice});
        added++; if(unitPrice===0) untar=true;
      } else if(existing){ state.quote.extraLines=state.quote.extraLines.filter(function(l){ return l!==existing; }); }
    });
    save(); render();
    alert(added+' fourniture(s) technique(s) ajoutée(s)/mise(s) à jour dans le devis, et liaisons synchronisées avec le relevé.'+(untar?'\n\nCertaines ne sont pas tarifées (prix 0) — renseigne les tarifs dans Réglages → Main-d’œuvre.':''));
  }
  function techToolbar(){
    var t=el('div',{class:'plan-toolbar', id:'techToolbar'});
    var addB=el('button',{class:'btn primary sm'},['＋ Ajouter les fournitures au devis']);
    addB.addEventListener('click', addTechSuppliesToQuote);
    t.appendChild(addB);
    return t;
  }
  function renderTechnique(){
    var box=el('div');
    box.appendChild(el('div',{class:'eyebrow'},['Pose']));
    box.appendChild(el('h2',{class:'section-title',style:'margin-bottom:10px'},['Relevé technique de pose']));
    box.appendChild(techValidationBanner());
    box.appendChild(techToolbar());
    if(!(state.quote.rooms&&state.quote.rooms.length)){ box.appendChild(el('p',{class:'section-sub'},['Aucune pièce dans le devis. Ajoute des pièces dans l’onglet Devis pour relever la pose.'])); return box; }
    var layout=el('div',{class:'layout'});
    var main=el('div');
    state.quote.rooms.forEach(function(r){ prefillTech(r); main.appendChild(techRoomCard(r)); });
    var aside=el('div');
    techSynthHost=el('div'); techSynthHost.appendChild(buildTechSynthesis());
    aside.appendChild(techSynthHost);
    layout.appendChild(main); layout.appendChild(aside);
    box.appendChild(layout);
    return box;
  }

  /* ============================================================
     TABLEAU DE BORD
     ============================================================ */
  var DASH_STATUS=[['brouillon','Brouillon','#8499a1'],['envoye','Envoyé','#0e9aa8'],['accepte','Accepté','#2f8f5b'],['perdu','Perdu','#bf4631']];
  function renderDash(){
    var box=el('div');
    box.appendChild(el('div',{class:'eyebrow'},['Pilotage']));
    box.appendChild(el('h2',{class:'section-title',style:'margin-bottom:14px'},['Tableau de bord']));
    var totals={}; DASH_STATUS.forEach(function(s){totals[s[0]]=0;}); var totAll=0;
    state.savedQuotes.forEach(function(q){ var s=q.status||'brouillon'; if(totals[s]===undefined)totals[s]=0; totals[s]+=(+q.total||0); totAll+=(+q.total||0); });
    var cards=el('div',{class:'grid g3'});
    cards.appendChild(dashCard('Pipeline total', euro.format(totAll), state.savedQuotes.length+' devis', 'var(--ink)'));
    cards.appendChild(dashCard('Signé (accepté)', euro.format(totals.accepte), 'commandes gagnées', 'var(--good)'));
    cards.appendChild(dashCard('En cours (envoyé)', euro.format(totals.envoye), 'à relancer', 'var(--cool-deep)'));
    box.appendChild(cards);
    if(totAll>0){
      var bar=el('div',{style:'display:flex; height:14px; border-radius:8px; overflow:hidden; margin:18px 0 8px; border:1px solid var(--line)'});
      DASH_STATUS.forEach(function(s){ var w=(totals[s[0]]/totAll*100); if(w>0) bar.appendChild(el('div',{style:'width:'+w+'%; background:'+s[2]})); });
      box.appendChild(bar);
      var leg=el('div',{style:'display:flex; gap:16px; flex-wrap:wrap; font-size:11.5px; color:var(--muted)'});
      DASH_STATUS.forEach(function(s){ leg.appendChild(el('span',null,['■ '+s[1]+' · '+euro.format(totals[s[0]])])); });
      box.appendChild(leg);
    }
    var c=el('div',{class:'card',style:'margin-top:20px'}); var p=el('div',{class:'pad'});
    p.appendChild(el('h2',{class:'section-title',style:'font-size:15px; margin-bottom:6px'},['Devis enregistrés']));
    if(state.savedQuotes.length===0) p.appendChild(el('p',{class:'section-sub'},['Aucun devis mémorisé. Enregistre un devis depuis l\u2019onglet Devis pour le suivre ici.']));
    state.savedQuotes.forEach(function(q){
      var item=el('div',{class:'saved-item'});
      item.appendChild(el('div',{class:'meta'},[el('b',null,[q.name]), el('span',null,[q.date+' · '+euro.format(q.total)])]));
      var sel=el('select',{style:'width:130px'});
      DASH_STATUS.forEach(function(s){ sel.appendChild(opt(s[0],s[1], (q.status||'brouillon')===s[0])); });
      sel.addEventListener('change',function(){ q.status=sel.value; save(); render(); });
      var open=el('button',{class:'btn subtle sm'},['Ouvrir']); open.addEventListener('click',function(){ state.quote=ensureQuoteTech(JSON.parse(JSON.stringify(q.data))); state.ui.tab='devis'; save(); render(); });
      var del=el('button',{class:'btn danger sm'},['✕']); del.addEventListener('click',function(){ state.savedQuotes=state.savedQuotes.filter(function(x){return x.id!==q.id;}); save(); render(); });
      item.appendChild(sel); item.appendChild(open); item.appendChild(del);
      p.appendChild(item);
    });
    c.appendChild(p); box.appendChild(c);
    return box;
  }
  function dashCard(label,val,sub,color){ var c=el('div',{class:'card'}); var p=el('div',{class:'pad'}); p.appendChild(el('div',{class:'total-label'},[label])); p.appendChild(el('div',{class:'num',style:'font-size:26px; font-weight:850; letter-spacing:-.5px; margin-top:4px; color:'+color},[val])); p.appendChild(el('div',{style:'font-size:12px; color:var(--muted); margin-top:2px'},[sub])); return c; }

  /* ============================================================
     VUE 3D (maquette extrudée depuis le plan) + PHOTOS
     ============================================================ */
  var threeCleanup=null;

  function downscaleImage(file, maxSize, quality, cb){
    var rd=new FileReader();
    rd.onload=function(){
      var img=new Image();
      img.onload=function(){
        var w=img.width,h=img.height, sc=Math.min(1, maxSize/Math.max(w,h));
        var cw=Math.max(1,Math.round(w*sc)), ch=Math.max(1,Math.round(h*sc));
        var cv=document.createElement('canvas'); cv.width=cw; cv.height=ch;
        var ctx=cv.getContext('2d'); if(!ctx){ cb(rd.result); return; }
        ctx.drawImage(img,0,0,cw,ch);
        try{ cb(cv.toDataURL('image/jpeg', quality)); }catch(e){ cb(rd.result); }
      };
      img.onerror=function(){ cb(rd.result); };
      img.src=rd.result;
    };
    rd.readAsDataURL(file);
  }

  function roomPhotoField(room){
    var wrap=el('div',{style:'margin-top:14px'});
    wrap.appendChild(el('span',{style:'display:block; font-size:11.5px; font-weight:600; color:var(--muted); margin-bottom:6px'},['Photo de la pièce (référence + texture 3D)']));
    if(room.photo){ wrap.appendChild(el('img',{src:room.photo, style:'width:100%; max-height:140px; object-fit:cover; border-radius:10px; border:1px solid var(--line)'})); }
    var file=el('input',{type:'file', accept:'image/*', capture:'environment', style:'display:none'});
    var btn=el('button',{class:'btn subtle sm', style:'margin-top:8px'},[room.photo?'Remplacer la photo':'📷 Prendre / choisir une photo']);
    btn.addEventListener('click',function(){ file.click(); });
    file.addEventListener('change',function(){ var f=file.files[0]; if(!f) return; downscaleImage(f, 1024, 0.7, function(d){ room.photo=d; save(); renderSide(); }); });
    wrap.appendChild(btn); wrap.appendChild(file);
    if(room.photo){ var rm=el('button',{class:'btn danger sm', style:'margin-top:8px; margin-left:8px'},['Retirer']); rm.addEventListener('click',function(){ room.photo=null; save(); renderSide(); }); wrap.appendChild(rm); }
    return wrap;
  }

  function renderThreeD(){
    var box=el('div');
    var bar=el('div',{class:'plan-toolbar'});
    bar.appendChild(el('div',{class:'eyebrow'},['Maquette 3D']));
    bar.appendChild(el('h2',{class:'section-title',style:'margin:0 10px 0 0'},['Vue 3D du logement']));
    var backPlan=el('button',{class:'btn subtle sm'},['← Modifier le plan']); backPlan.addEventListener('click',function(){ state.ui.tab='plan'; render(); }); bar.appendChild(backPlan);
    box.appendChild(bar);
    if(typeof THREE==='undefined'){
      box.appendChild(el('div',{class:'banner info',html:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#0b6e78" stroke-width="1.3"/><path d="M8 7.2v4M8 4.8h.01" stroke="#0b6e78" stroke-width="1.5" stroke-linecap="round"/></svg><div>La vue 3D charge une librairie depuis internet. Connecte-toi puis recharge la page. <b>Tout le reste de l\u2019application fonctionne hors-ligne.</b></div>'}));
      return box;
    }
    if(!planHasContent()){
      box.appendChild(el('div',{class:'banner warn',html:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l7 13H1L8 1z" stroke="#b6810f" stroke-width="1.4" stroke-linejoin="round"/></svg><div>Aucun plan à afficher. Va dans l\u2019onglet <b>Plan</b> pour dessiner les pièces, ou clique « Reprendre les pièces du devis ».</div>'}));
      return box;
    }
    var wrap=el('div',{style:'position:relative; border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; background:#0f1b24; height:66vh; touch-action:none'});
    box.appendChild(wrap);
    box.appendChild(el('div',{class:'plan-hint'},['Glisse pour pivoter, molette pour zoomer. Maquette générée depuis ton plan et les photos des pièces.']));
    setTimeout(function(){ try{ buildThreeScene(wrap); }catch(e){ wrap.innerHTML='<div style="color:#eef4f5; padding:24px; font-size:13px">Impossible d\u2019initialiser la 3D sur cet appareil ('+escapeHtml(e.message)+').</div>'; } },0);
    return box;
  }

  function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function makeLabelSprite(text){
    var font=26, pad=8;
    var probe=document.createElement('canvas').getContext('2d'); if(!probe) return null;
    probe.font='600 '+font+'px Inter, system-ui, sans-serif';
    var tw=Math.ceil(probe.measureText(text).width);
    var cv=document.createElement('canvas'); cv.width=tw+pad*2; cv.height=font+pad*2;
    var c=cv.getContext('2d'); c.font='600 '+font+'px Inter, system-ui, sans-serif';
    c.fillStyle='rgba(15,27,36,.82)'; roundRect(c,0,0,cv.width,cv.height,10); c.fill();
    c.fillStyle='#eef4f5'; c.textBaseline='middle'; c.fillText(text, pad, cv.height/2+1);
    var tex=new THREE.CanvasTexture(cv); tex.needsUpdate=true;
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false}));
    var s=0.006; sp.scale.set(cv.width*s, cv.height*s, 1);
    return sp;
  }

  function buildThreeScene(container, planOverride, resolveOverride){
    var P=planOverride||state.plan, resolveItem=resolveOverride||defaultItemResolve, W=container.clientWidth||800, H=container.clientHeight||500;
    var cx=P.wcm/200, cz=P.hcm/200, wallH=2.4;
    var renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setSize(W,H); container.appendChild(renderer.domElement);
    var scene=new THREE.Scene(); scene.background=new THREE.Color(0x0f1b24);
    var camera=new THREE.PerspectiveCamera(50, W/H, 0.05, 1000);
    scene.add(new THREE.AmbientLight(0xffffff,0.78));
    var d1=new THREE.DirectionalLight(0xffffff,0.5); d1.position.set(6,12,8); scene.add(d1);
    var d2=new THREE.DirectionalLight(0xffffff,0.25); d2.position.set(-6,9,-6); scene.add(d2);

    var ground=new THREE.Mesh(new THREE.PlaneGeometry((P.wcm/100)*1.6,(P.hcm/100)*1.6), new THREE.MeshLambertMaterial({color:0x16242e}));
    ground.rotation.x=-Math.PI/2; ground.position.y=-0.01; scene.add(ground);

    function mx(px){ return px/100 - cx; } function mz(py){ return py/100 - cz; }

    P.rooms.forEach(function(r){
      var rw=r.w/100, rh=r.h/100, rcx=mx(r.x+r.w/2), rcz=mz(r.y+r.h/2);
      var floorMat=new THREE.MeshLambertMaterial({color:0xf3f7f8});
      var floor=new THREE.Mesh(new THREE.BoxGeometry(rw,0.05,rh), floorMat);
      floor.position.set(rcx,0.025,rcz); scene.add(floor);
      if(r.photo){ try{ new THREE.TextureLoader().load(r.photo, function(tex){ floorMat.map=tex; floorMat.color.set(0xffffff); floorMat.needsUpdate=true; renderOnce(); }); }catch(e){} }
      var wallMat=new THREE.MeshLambertMaterial({color:0x9fb6bd, transparent:true, opacity:0.22, side:THREE.DoubleSide});
      var t=0.06;
      [rcz-rh/2, rcz+rh/2].forEach(function(z){ var m=new THREE.Mesh(new THREE.BoxGeometry(rw+t,wallH,t), wallMat); m.position.set(rcx, wallH/2, z); scene.add(m); });
      [rcx-rw/2, rcx+rw/2].forEach(function(x){ var m=new THREE.Mesh(new THREE.BoxGeometry(t,wallH,rh+t), wallMat); m.position.set(x, wallH/2, rcz); scene.add(m); });
      var lab=makeLabelSprite(r.name); if(lab){ lab.position.set(rcx, wallH+0.28, rcz); scene.add(lab); }
    });

    P.items.forEach(function(it){
      var meta=PLAN_ITEMS[it.type]; var icx=mx(it.x+meta.w/2), icz=mz(it.y+meta.h/2);
      var color=parseInt(meta.stroke.slice(1),16), dims, y;
      if(it.type==='mural'){ dims=[0.9,0.28,0.18]; y=wallH-0.3; }
      else if(it.type==='console'){ dims=[0.8,0.55,0.22]; y=0.35; }
      else if(it.type==='cassette'){ dims=[0.6,0.1,0.6]; y=wallH-0.06; }
      else if(it.type==='gainable'){ dims=[0.6,0.1,0.6]; y=wallH-0.06; }
      else { dims=[0.84,0.56,0.34]; y=0.32; }
      var mesh=new THREE.Mesh(new THREE.BoxGeometry(dims[0],dims[1],dims[2]), new THREE.MeshLambertMaterial({color:color}));
      mesh.position.set(icx,y,icz); mesh.rotation.y=-(it.rot||0)*Math.PI/180; scene.add(mesh);
      var prod=resolveItem(it);
      var lab=makeLabelSprite(prod? (prod.brand+' '+fmtKw(prod.kw)) : meta.label); if(lab){ lab.position.set(icx, y+0.34, icz); scene.add(lab); }
    });

    var maxDim=Math.max(P.wcm,P.hcm)/100;
    var target=new THREE.Vector3(0, wallH*0.35, 0);
    var az=Math.PI*0.25, elev=Math.PI*0.32, rad=maxDim*1.5, minR=maxDim*0.5, maxR=maxDim*4;
    function renderOnce(){ renderer.render(scene,camera); }
    function updateCam(){ camera.position.set(target.x+rad*Math.cos(elev)*Math.sin(az), target.y+rad*Math.sin(elev), target.z+rad*Math.cos(elev)*Math.cos(az)); camera.lookAt(target); renderOnce(); }
    updateCam();

    var dom=renderer.domElement, dragging=false, lx=0, ly=0;
    function down(e){ dragging=true; lx=(e.touches?e.touches[0].clientX:e.clientX); ly=(e.touches?e.touches[0].clientY:e.clientY); try{dom.setPointerCapture(e.pointerId);}catch(err){} }
    function move(e){ if(!dragging) return; var x=(e.touches?e.touches[0].clientX:e.clientX), y=(e.touches?e.touches[0].clientY:e.clientY); az-=(x-lx)*0.006; elev=Math.max(0.12,Math.min(1.45, elev-(y-ly)*0.006)); lx=x; ly=y; updateCam(); }
    function up(e){ dragging=false; try{dom.releasePointerCapture(e.pointerId);}catch(err){} }
    function wheel(e){ e.preventDefault(); rad=Math.max(minR,Math.min(maxR, rad*(e.deltaY>0?1.1:0.9))); updateCam(); }
    dom.addEventListener('pointerdown',down); dom.addEventListener('pointermove',move); dom.addEventListener('pointerup',up); dom.addEventListener('pointercancel',up); dom.addEventListener('wheel',wheel,{passive:false});
    function onResize(){ var w2=container.clientWidth, h2=container.clientHeight; if(!w2||!h2) return; camera.aspect=w2/h2; camera.updateProjectionMatrix(); renderer.setSize(w2,h2); renderOnce(); }
    window.addEventListener('resize',onResize);

    threeCleanup=function(){
      window.removeEventListener('resize',onResize);
      dom.removeEventListener('pointerdown',down); dom.removeEventListener('pointermove',move); dom.removeEventListener('pointerup',up); dom.removeEventListener('pointercancel',up); dom.removeEventListener('wheel',wheel);
      try{ renderer.dispose(); }catch(e){}
      if(dom.parentNode) dom.parentNode.removeChild(dom);
    };
  }

  /* ============================================================
     MESURE AR (WebXR hit-test) — Android Chrome, https requis
     ============================================================ */
  function arSupportMessage(){
    if(typeof THREE==='undefined') return 'La librairie 3D n\u2019est pas chargée. Une connexion internet est nécessaire pour la mesure AR.';
    if(!window.isSecureContext) return 'La mesure AR exige une connexion sécurisée (https). Ouvre l\u2019application via son adresse https (ex. GitHub Pages), pas en fichier local.';
    if(!navigator.xr) return 'Ton navigateur ne propose pas la réalité augmentée (WebXR). Sur Android, utilise Google Chrome à jour ; sur iPhone, ce n\u2019est pas supporté.';
    return null;
  }
  function startARMeasure(){
    var msg=arSupportMessage(); if(msg){ alert(msg); return; }
    launchAR();
  }
  // Flux intégré : mesure → dimensionnement (computeRoom) → suggestion modèle → pose de l'unité.
  function startARScanEquip(){
    var msg=arSupportMessage(); if(msg){ alert(msg); return; }
    launchAR({ title:'Scanner & équiper', onMeasured:arScanEquipMeasured });
  }
  function buildAROverlay(){
    var o=el('div',{class:'ar-overlay', id:'arOverlay'});
    o.innerHTML =
      '<div class="ar-top"><b>Mesure de la pièce</b><br><span>Vise le sol, avance vers chaque coin et tape l\u2019écran pour poser un point. Referme la boucle, puis « Terminer ».</span></div>'+
      '<div class="ar-stats" id="arStats">Recherche du sol…</div>'+
      '<div class="ar-cross"></div>'+
      '<div class="ar-bottom"><button class="ar-btn ghost" id="arUndo">↶ Annuler</button><button class="ar-btn primary" id="arFinish">✓ Terminer</button><button class="ar-btn danger" id="arQuit">✕ Quitter</button></div>';
    return o;
  }

  function launchAR(opts){
    opts=opts||{};
    var overlay=document.getElementById('arOverlay');
    if(!overlay){ overlay=buildAROverlay(); document.body.appendChild(overlay); }
    var topB=overlay.querySelector('.ar-top b'); if(topB) topB.textContent=opts.title||'Mesure de la pièce';
    var stats=overlay.querySelector('#arStats');
    overlay.classList.add('on');

    var renderer, scene, camera, reticle, session=null, hitTestSource=null, refSpace=null;
    var points=[], markers=[], lineObj=null, pendingAfter=null;

    try{
      renderer=new THREE.WebGLRenderer({antialias:true, alpha:true});
      renderer.setPixelRatio(window.devicePixelRatio||1);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled=true;
      renderer.domElement.style.display='none'; document.body.appendChild(renderer.domElement);
      scene=new THREE.Scene();
      camera=new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 50);
      scene.add(new THREE.HemisphereLight(0xffffff,0x889099,1.0));
      reticle=new THREE.Mesh(new THREE.RingGeometry(0.07,0.1,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x0e9aa8}));
      reticle.matrixAutoUpdate=false; reticle.visible=false; scene.add(reticle);
    }catch(e){ cleanup(); alert('Initialisation 3D impossible : '+(e&&e.message||e)); return; }

    function dist(a,b){ var dx=a.x-b.x, dz=a.z-b.z; return Math.sqrt(dx*dx+dz*dz); }
    function polyArea(p){ var s=0; for(var i=0;i<p.length;i++){ var j=(i+1)%p.length; s+=p[i].x*p[j].z - p[j].x*p[i].z; } return Math.abs(s/2); }
    function fmtM(v){ return v.toFixed(2).replace('.',',')+' m'; }
    function updateStats(){
      if(!stats) return;
      var per=0; for(var i=1;i<points.length;i++) per+=dist(points[i-1],points[i]);
      if(points.length>2) per+=dist(points[points.length-1],points[0]);
      var area=points.length>2?polyArea(points):0;
      stats.textContent = points.length===0 ? 'Vise le sol et tape pour poser le 1er coin' : (points.length+' point(s) · périmètre '+fmtM(per)+(area>0?' · surface '+area.toFixed(2).replace('.',',')+' m²':''));
    }
    function rebuildLine(){
      if(lineObj){ scene.remove(lineObj); try{lineObj.geometry.dispose();}catch(e){} lineObj=null; }
      if(points.length<2) return;
      var v=[]; points.forEach(function(p){ v.push(p.x,0.006,p.z); });
      if(points.length>2) v.push(points[0].x,0.006,points[0].z);
      var g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
      lineObj=new THREE.Line(g, new THREE.LineBasicMaterial({color:0x0e9aa8})); scene.add(lineObj);
    }
    function addPoint(){
      if(!reticle.visible) return;
      var pos=new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
      points.push({x:pos.x, z:pos.z});
      var m=new THREE.Mesh(new THREE.SphereGeometry(0.03,16,12), new THREE.MeshBasicMaterial({color:0xffffff}));
      m.position.copy(pos); scene.add(m); markers.push(m);
      rebuildLine(); updateStats();
    }
    function undo(){ if(!points.length) return; points.pop(); var m=markers.pop(); if(m) scene.remove(m); rebuildLine(); updateStats(); }
    function finish(){
      if(points.length<3){ alert('Place au moins 3 coins pour définir une pièce.'); return; }
      var xs=points.map(function(p){return p.x;}), zs=points.map(function(p){return p.z;});
      var w=Math.max.apply(null,xs)-Math.min.apply(null,xs);
      var d=Math.max.apply(null,zs)-Math.min.apply(null,zs);
      var area=polyArea(points);
      var onMeasured = opts.onMeasured || function(w,d,area){ createRoomFromMeasure(w,d,area); };
      pendingAfter=function(){ onMeasured(w,d,area); };
      try{ if(session) session.end(); }catch(e){ cleanup(); if(pendingAfter) pendingAfter(); }
    }

    navigator.xr.requestSession('immersive-ar', { requiredFeatures:['hit-test'], optionalFeatures:['dom-overlay'], domOverlay:{ root: overlay } })
      .then(function(s){ session=s; renderer.xr.setReferenceSpaceType('local'); return renderer.xr.setSession(s); })
      .then(function(){
        session.addEventListener('select', addPoint);
        session.addEventListener('end', onEnd);
        session.requestReferenceSpace('viewer').then(function(v){
          if(session.requestHitTestSource) session.requestHitTestSource({space:v}).then(function(src){ hitTestSource=src; });
        });
        refSpace=renderer.xr.getReferenceSpace();
        var undoB=overlay.querySelector('#arUndo'), finB=overlay.querySelector('#arFinish'), quitB=overlay.querySelector('#arQuit');
        if(undoB) undoB.onclick=undo;
        if(finB) finB.onclick=finish;
        if(quitB) quitB.onclick=function(){ pendingAfter=null; try{ if(session) session.end(); }catch(e){ cleanup(); } };
        renderer.setAnimationLoop(loop);
        updateStats();
      })
      .catch(function(err){
        cleanup();
        alert('Impossible de démarrer l\u2019AR : '+(err&&err.message||err)+'\n\nVérifie : Chrome à jour, « Google Play Services for AR » installé, et accès via une adresse https.');
      });

    function loop(t, frame){
      if(frame && hitTestSource){
        if(!refSpace) refSpace=renderer.xr.getReferenceSpace();
        var res=frame.getHitTestResults(hitTestSource);
        if(res.length){ var pose=res[0].getPose(refSpace); if(pose){ reticle.visible=true; reticle.matrix.fromArray(pose.transform.matrix); } }
        else reticle.visible=false;
      }
      try{ renderer.render(scene,camera); }catch(e){}
    }
    function onEnd(){ var after=pendingAfter; cleanup(); if(after) after(); }
    function cleanup(){
      try{ if(renderer) renderer.setAnimationLoop(null); }catch(e){}
      try{ if(hitTestSource && hitTestSource.cancel) hitTestSource.cancel(); }catch(e){}
      if(overlay) overlay.classList.remove('on');
      try{ if(renderer && renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); }catch(e){}
      try{ if(renderer) renderer.dispose(); }catch(e){}
    }
  }

  function addRoomGeometryFromMeasure(wMeters, dMeters, areaM2){
    var wcm=Math.max(50, Math.round(wMeters*100)), hcm=Math.max(50, Math.round(dMeters*100));
    var x=40, y=40; state.plan.rooms.forEach(function(r){ y=Math.max(y, r.y+r.h+40); });
    var room={ id:UID(), x:snap(x), y:snap(y), w:snap(wcm), h:snap(hcm), name:'Pièce AR ('+areaM2.toFixed(1).replace('.',',')+' m²)' };
    if(room.x+room.w > state.plan.wcm) state.plan.wcm=Math.ceil((room.x+room.w+40)/50)*50;
    if(room.y+room.h > state.plan.hcm) state.plan.hcm=Math.ceil((room.y+room.h+40)/50)*50;
    state.plan.rooms.push(room);
    return room;
  }
  function createRoomFromMeasure(wMeters, dMeters, areaM2){
    var room=addRoomGeometryFromMeasure(wMeters, dMeters, areaM2);
    state.ui.planSel={kind:'room', id:room.id}; state.ui.tab='plan'; save(); render();
    setTimeout(function(){ alert('Pièce mesurée ajoutée au plan : '+wMeters.toFixed(2).replace('.',',')+' × '+dMeters.toFixed(2).replace('.',',')+' m, surface ≈ '+areaM2.toFixed(1).replace('.',',')+' m².\n\nLa pièce est approximée en rectangle — ajuste-la si elle est en L. Reporte la surface dans le devis pour le dimensionnement.'); },250);
  }

  // Fin de la phase mesure du flux « Scanner & équiper » : dimensionne, suggère un modèle,
  // ajoute pièce + unité au plan, puis propose de poser l'unité sur le mur en AR.
  function arScanEquipMeasured(wMeters, dMeters, areaM2){
    var tmp=newRoom('AR'); tmp.surface=areaM2;        // mêmes hypothèses par défaut que le devis
    var rc=computeRoom(tmp);                            // un seul moteur de charge
    var sug=suggestIndoorForAR(rc.reco);
    var room=addRoomGeometryFromMeasure(wMeters, dMeters, areaM2);
    var type=(sug.product && PLAN_ITEMS[sug.product.type]) ? sug.product.type : 'mural';
    var mm=PLAN_ITEMS[type];
    var ix=clamp(snap(room.x+room.w/2-mm.w/2),0,maxX({type:type},'item'));
    var iy=clamp(snap(room.y+room.h/2-mm.h/2),0,maxY({type:type},'item'));
    state.plan.items.push({ id:UID(), type:type, x:ix, y:iy, rot:0, productId: sug.product?sug.product.id:null });
    state.ui.planSel={kind:'room', id:room.id}; state.ui.tab='plan'; save(); render();
    showARScanResult(areaM2, rc, sug, type);
  }
  function showARScanResult(areaM2, rc, sug, type){
    var modelTxt = sug.product ? (sug.product.brand+' '+sug.product.model+' — '+fmtKw(sug.product.kw)) : 'aucun modèle au catalogue';
    var back=el('div',{class:'share-modal', id:'arResultModal'});
    var panel=el('div',{class:'share-panel'});
    panel.appendChild(el('div',{class:'eyebrow'},['Scanner & équiper']));
    panel.appendChild(el('h2',{class:'section-title',style:'margin:2px 0 8px'},['Pièce scannée']));
    panel.appendChild(el('div',{style:'font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px'},
      ['≈ '+areaM2.toFixed(1).replace('.',',')+' m² → ~'+rc.kW.toFixed(1).replace('.',',')+' kW → '+modelTxt]));
    if(sug.product && !sug.enough) panel.appendChild(el('p',{class:'section-sub',style:'color:#8a5a00'},['⚠ Aucun modèle assez puissant au catalogue : le plus grand est proposé. Un multi-split ou une 2ᵉ unité peut être nécessaire (hors périmètre de l’estimation).']));
    if(!sug.product) panel.appendChild(el('p',{class:'section-sub'},['Catalogue vide : aucune unité à suggérer. La pièce a été ajoutée au plan.']));
    panel.appendChild(el('p',{class:'section-sub',style:'margin:8px 0 4px'},['La pièce et l’unité ont été ajoutées au plan et reportées dans ton chiffrage.']));
    var row=el('div',{class:'share-actions'});
    if(typeof THREE!=='undefined' && arSupportMessage()===null){
      var poseBtn=el('button',{class:'btn primary'},['🛋 Poser l’unité suggérée']);
      poseBtn.addEventListener('click',function(){
        closeARScanResult();
        launchARPlace({ label: sug.product?(sug.product.brand+' '+sug.product.model):'Unité', kw: sug.product?(+sug.product.kw||0):null, type:type });
      });
      row.appendChild(poseBtn);
    }
    var laterBtn=el('button',{class:'btn ghost'},['Plus tard']); laterBtn.addEventListener('click', closeARScanResult);
    row.appendChild(laterBtn);
    panel.appendChild(row);
    back.appendChild(panel);
    back.addEventListener('click',function(e){ if(e.target===back) closeARScanResult(); });
    document.body.appendChild(back);
  }
  function closeARScanResult(){ var m=document.getElementById('arResultModal'); if(m&&m.parentNode) m.parentNode.removeChild(m); }

  /* ---------------- AR : poser la clim sur le mur ---------------- */
  function startARPlace(){
    var msg=arSupportMessage(); if(msg){ alert(msg); return; }
    launchARPlace();
  }
  var AR_PLACE_TYPES = [['mural','Mural'],['cassette','Cassette'],['console','Console'],['outdoor','Groupe ext.']];
  var AR_TARGET_HINT = { mural:'Vise un mur', cassette:'Vise le plafond', console:'Vise le bas du mur ou le sol', outdoor:'Vise le sol' };
  function buildARPlaceOverlay(opts){
    opts=opts||{};
    var modelLine = opts.label ? ('<span class="ar-model">Modèle : '+escapeHtml(opts.label)+(opts.kw?(' · '+fmtKw(opts.kw)):'')+'</span><br>') : '';
    var seg = '<div class="ar-seg" id="arpSeg">'+AR_PLACE_TYPES.map(function(t){ return '<button class="ar-seg-btn" data-type="'+t[0]+'">'+t[1]+'</button>'; }).join('')+'</div>';
    var o=el('div',{class:'ar-overlay', id:'arPlaceOverlay'});
    o.innerHTML =
      '<div class="ar-top"><b>Voir la clim sur le mur</b><br>'+modelLine+'<span>Vise un mur, balaie-le lentement pour qu\u2019il soit détecté, puis tape l\u2019écran pour poser l\u2019unité à l\u2019échelle réelle. Recule pour la voir en entier.</span></div>'+
      '<div class="ar-stats" id="arPlaceStats">Recherche d\u2019un mur…</div>'+
      seg+
      '<div class="ar-cross"></div>'+
      '<div class="ar-bottom"><button class="ar-btn ghost" id="arpUndo">↶ Retirer</button><button class="ar-btn ghost" id="arpClear">Tout effacer</button><button class="ar-btn danger" id="arpQuit">✕ Quitter</button></div>';
    return o;
  }
  // Convention commune : face de montage à z=0, extrusion vers +Z. La pose aligne +Z sur la normale
  // de la surface visée → mur (dos au mur), plafond (cassette débordant vers le bas), sol (posé).
  function makeUnit(type){
    var g=new THREE.Group();
    var white=function(){ return new THREE.MeshLambertMaterial({color:0xf4f7f8}); };
    var dark =function(){ return new THREE.MeshLambertMaterial({color:0x2a3942}); };
    if(type==='cassette'){
      // Cassette de plafond : carré plat ~0,6 × 0,6 × 0,06 m, grille encastrée
      var cb=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.6,0.06), white()); cb.position.set(0,0,0.03); g.add(cb);
      var cgr=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.42,0.012), dark()); cgr.position.set(0,0,0.066); g.add(cgr);
      return g;
    }
    if(type==='console'){
      // Console : unité basse ~0,8 × 0,6 × 0,22 m
      var kb=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.6,0.22), white()); kb.position.set(0,0,0.11); g.add(kb);
      var kout=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.05,0.012), dark()); kout.position.set(0,0.24,0.227); g.add(kout);
      return g;
    }
    if(type==='outdoor'){
      // Groupe extérieur : ~0,85 × 0,56 × 0,30 m, gris, disque de ventilateur sur la face avant (+Y)
      var ob=new THREE.Mesh(new THREE.BoxGeometry(0.85,0.56,0.30), new THREE.MeshLambertMaterial({color:0x9aa3aa})); ob.position.set(0,0,0.15); g.add(ob);
      var fan=new THREE.Mesh(new THREE.CircleGeometry(0.21,28), new THREE.MeshLambertMaterial({color:0x3a4248, side:THREE.DoubleSide}));
      fan.rotation.x=-Math.PI/2; fan.position.set(0,0.281,0.15); g.add(fan); // face avant verticale (+Y)
      return g;
    }
    // Split mural (défaut) : ~0,9 × 0,29 × 0,20 m, bandeau de soufflage + LED
    var body=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.29,0.20), white()); body.position.set(0,0,0.10); g.add(body);
    var outlet=new THREE.Mesh(new THREE.BoxGeometry(0.84,0.05,0.012), dark()); outlet.position.set(0,-0.10,0.207); g.add(outlet);
    var led=new THREE.Mesh(new THREE.SphereGeometry(0.006,10,10), new THREE.MeshBasicMaterial({color:0x37c6d0})); led.position.set(0.36,-0.03,0.207); g.add(led);
    return g;
  }
  function launchARPlace(opts){
    opts=opts||{};
    var existing=document.getElementById('arPlaceOverlay'); if(existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var overlay=buildARPlaceOverlay(opts); document.body.appendChild(overlay);
    var stats=overlay.querySelector('#arPlaceStats');
    overlay.classList.add('on');

    var renderer, scene, camera, reticle, session=null, hitTestSource=null, refSpace=null;
    var placed=[], lastStats='';
    var validTypes={mural:1,cassette:1,console:1,outdoor:1};
    var currentType=(opts.type && validTypes[opts.type]) ? opts.type : 'mural';

    // Empêche un tap sur le sélecteur (DOM) de déclencher une pose (select) : standard beforexrselect.
    overlay.addEventListener('beforexrselect', function(ev){ ev.preventDefault(); });
    var segBtns=overlay.querySelectorAll('.ar-seg-btn');
    function setType(tp){ if(!validTypes[tp]) return; currentType=tp; for(var i=0;i<segBtns.length;i++){ segBtns[i].classList.toggle('on', segBtns[i].getAttribute('data-type')===tp); } lastStats=''; updateStats(); }
    for(var si=0; si<segBtns.length; si++){ (function(b){ b.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); setType(b.getAttribute('data-type')); }); })(segBtns[si]); }

    try{
      renderer=new THREE.WebGLRenderer({antialias:true, alpha:true});
      renderer.setPixelRatio(window.devicePixelRatio||1);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled=true;
      renderer.domElement.style.display='none'; document.body.appendChild(renderer.domElement);
      scene=new THREE.Scene();
      camera=new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 50);
      scene.add(new THREE.HemisphereLight(0xffffff,0x8a9099,1.0));
      var dl=new THREE.DirectionalLight(0xffffff,0.55); dl.position.set(1,3,2); scene.add(dl);
      reticle=new THREE.Mesh(new THREE.RingGeometry(0.06,0.085,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x0e9aa8}));
      reticle.matrixAutoUpdate=false; reticle.visible=false; scene.add(reticle);
    }catch(e){ cleanup(); alert('Initialisation 3D impossible : '+(e&&e.message||e)); return; }
    setType(currentType);

    function updateStats(){
      if(!stats) return;
      var s = placed.length ? (placed.length+' unité(s) posée(s) · tape pour en ajouter')
                            : (reticle.visible ? 'Tape pour poser l\u2019unité' : 'Recherche d\u2019une surface…');
      var hint = AR_TARGET_HINT[currentType]||''; var s2 = hint? (hint+' · '+s) : s;
      if(s2!==lastStats){ stats.textContent=s2; lastStats=s2; }
    }
    function placeUnit(){
      if(!reticle.visible) return;
      var m=reticle.matrix;
      var pos=new THREE.Vector3().setFromMatrixPosition(m);
      var normal=new THREE.Vector3(0,1,0).applyMatrix4(new THREE.Matrix4().extractRotation(m)).normalize();
      var worldUp=new THREE.Vector3(0,1,0), localUp;
      if(Math.abs(normal.dot(worldUp))>0.95){
        // surface ~horizontale (sol/plafond) : « haut » de secours dans le plan
        var ref=new THREE.Vector3(0,0,-1);
        localUp=ref.sub(normal.clone().multiplyScalar(ref.dot(normal))).normalize();
      } else {
        // mur : on remet l\u2019unité d\u2019aplomb (vertical = haut du monde projeté sur le mur)
        localUp=worldUp.clone().sub(normal.clone().multiplyScalar(worldUp.dot(normal))).normalize();
      }
      var right=new THREE.Vector3().crossVectors(localUp, normal).normalize();
      var basis=new THREE.Matrix4().makeBasis(right, localUp, normal);
      var quat=new THREE.Quaternion().setFromRotationMatrix(basis);
      var unit=makeUnit(currentType); unit.position.copy(pos); unit.quaternion.copy(quat);
      scene.add(unit); placed.push(unit); updateStats();
    }
    function undo(){ var u=placed.pop(); if(u) scene.remove(u); updateStats(); }
    function clearAll(){ placed.forEach(function(u){ scene.remove(u); }); placed=[]; updateStats(); }

    navigator.xr.requestSession('immersive-ar', { requiredFeatures:['hit-test'], optionalFeatures:['dom-overlay'], domOverlay:{ root: overlay } })
      .then(function(s){ session=s; renderer.xr.setReferenceSpaceType('local'); return renderer.xr.setSession(s); })
      .then(function(){
        session.addEventListener('select', placeUnit);
        session.addEventListener('end', cleanup);
        session.requestReferenceSpace('viewer').then(function(v){
          if(session.requestHitTestSource) session.requestHitTestSource({space:v}).then(function(src){ hitTestSource=src; });
        });
        refSpace=renderer.xr.getReferenceSpace();
        var ub=overlay.querySelector('#arpUndo'), cb=overlay.querySelector('#arpClear'), qb=overlay.querySelector('#arpQuit');
        if(ub) ub.onclick=undo;
        if(cb) cb.onclick=clearAll;
        if(qb) qb.onclick=function(){ try{ if(session) session.end(); }catch(e){ cleanup(); } };
        renderer.setAnimationLoop(loop); updateStats();
      })
      .catch(function(err){
        cleanup();
        alert('Impossible de démarrer l\u2019AR : '+(err&&err.message||err)+'\n\nVérifie : Chrome à jour, « Google Play Services for AR » installé, et accès via une adresse https.');
      });

    function loop(t, frame){
      if(frame && hitTestSource){
        if(!refSpace) refSpace=renderer.xr.getReferenceSpace();
        var res=frame.getHitTestResults(hitTestSource);
        if(res.length){ var pose=res[0].getPose(refSpace); if(pose){ reticle.visible=true; reticle.matrix.fromArray(pose.transform.matrix); } }
        else reticle.visible=false;
        updateStats();
      }
      try{ renderer.render(scene,camera); }catch(e){}
    }
    function cleanup(){
      try{ if(renderer) renderer.setAnimationLoop(null); }catch(e){}
      try{ if(hitTestSource && hitTestSource.cancel) hitTestSource.cancel(); }catch(e){}
      if(overlay) overlay.classList.remove('on');
      try{ if(renderer && renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); }catch(e){}
      try{ if(renderer) renderer.dispose(); }catch(e){}
    }
  }

  /* ---------------- init ---------------- */
  load();
  state.ui = Object.assign({tab:'devis',adminSection:'societe',clientPrices:true,clientView:false,planSel:null,shared:false}, state.ui||{});
  if(!tryRenderShared()){
    state.quote.rooms.forEach(function(r){ if(!r.productId) autoSelectProduct(r); });
    render();
  }
  if(storageOK===false) setSaveState(false,'Session uniquement');
})();
