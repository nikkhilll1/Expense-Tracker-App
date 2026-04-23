/* ===== KD Singh — Data Layer ===== */
const DB={
  g(k){try{return JSON.parse(localStorage.getItem(k))||null}catch{return null}},
  s(k,v){localStorage.setItem(k,JSON.stringify(v))},
  id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
};

/* Default categories */
const DEF_CATS=['Rent & Electricity','Investment & Maintenance','Garbage','Disposable','Gas Cylinder','Koyla','Delivery Charges','Grocery','Milk Products','Vegetables','Oils','Chicken','Chaap','Rumali'];
const DEF_IC={'Rent & Electricity':'ri-home-4-fill','Investment & Maintenance':'ri-tools-fill','Garbage':'ri-delete-bin-fill','Disposable':'ri-drop-fill','Gas Cylinder':'ri-fire-fill','Koyla':'ri-fire-line','Delivery Charges':'ri-truck-fill','Grocery':'ri-store-2-fill','Milk Products':'ri-cup-fill','Vegetables':'ri-leaf-fill','Oils':'ri-drop-line','Chicken':'ri-restaurant-fill','Chaap':'ri-restaurant-2-fill','Rumali':'ri-cake-2-fill'};
const DEF_CLR={'Rent & Electricity':'#ef5350','Investment & Maintenance':'#ffd740','Garbage':'#66bb6a','Disposable':'#26c6da','Gas Cylinder':'#42a5f5','Koyla':'#f06292','Delivery Charges':'#26a69a','Grocery':'#66bb6a','Milk Products':'#42a5f5','Vegetables':'#00e676','Oils':'#ffd740','Chicken':'#ef5350','Chaap':'#ab47bc','Rumali':'#26c6da'};

/* Categories hidden from Expense UI (managed via Staff module only) */
const STAFF_CATS=['Staff Salary','Staff Advances','Staff Expense'];
/* Obsolete categories to auto-remove from custom cats on load */
const OBSOLETE_CATS=['INTERNET','Internet','Staff Advance','STAFF ADVANCE','Staff Expense'];

/* Icon & color presets for custom categories */
const ICON_LIST=['ri-price-tag-3-fill','ri-store-fill','ri-shopping-basket-fill','ri-box-3-fill','ri-truck-fill','ri-tools-fill','ri-water-flash-fill','ri-gas-station-fill','ri-leaf-fill','ri-cake-fill','ri-cup-fill','ri-bowl-fill','ri-knife-fill','ri-building-2-fill','ri-hand-coin-fill','ri-gift-fill','ri-recycle-fill','ri-paint-brush-fill','ri-phone-fill','ri-car-fill'];
const COLOR_LIST=['#ef5350','#f06292','#ab47bc','#7e57c2','#5c6bc0','#42a5f5','#26c6da','#26a69a','#66bb6a','#00e676','#ffd740','#ffab40','#ff7043','#8d6e63','#78909c'];

/* Dynamic category getters — merge defaults + custom */
function getCustomCats(){return DB.g(uk('customCats'))||[]}
function setCustomCats(v){DB.s(uk('customCats'),v)}
function getAllCats(){return [...DEF_CATS,...getCustomCats().map(c=>c.name)]}
function getVisibleCats(){return getAllCats().filter(c=>!STAFF_CATS.includes(c))}

/* Auto-migrate: purge obsolete categories from custom list */
function migrateObsoleteCats(){
  if(!uk('customCats'))return;
  const cc=getCustomCats();
  const cleaned=cc.filter(c=>!OBSOLETE_CATS.some(o=>o.toLowerCase()===c.name.toLowerCase()));
  if(cleaned.length!==cc.length)setCustomCats(cleaned);
}
function getCatIcon(cat){const cc=getCustomCats().find(c=>c.name===cat);return cc?cc.icon:(DEF_IC[cat]||'ri-price-tag-3-fill')}
function getCatColor(cat){const cc=getCustomCats().find(c=>c.name===cat);return cc?cc.color:(DEF_CLR[cat]||'#6366f1')}
function removeCustomCat(name){
  const cc=getCustomCats().filter(c=>c.name!==name);
  setCustomCats(cc);
}

/* Auth */
function getUsers(){return DB.g('kd_users')||[]}
function saveUsers(u){DB.s('kd_users',u)}
function curUser(){return DB.g('kd_cur')}
function setCurUser(u){DB.s('kd_cur',u)}

function registerUser(n,e,p){
  const us=getUsers();
  if(us.find(u=>u.email===e))return{ok:false,msg:'Email already exists'};
  const u={id:DB.id(),name:n,email:e,password:p};
  us.push(u);saveUsers(us);setCurUser(u);return{ok:true,user:u};
}
function loginUser(u,p){
  const found=getUsers().find(x=>(x.email===u||x.name===u)&&x.password===p);
  if(!found)return{ok:false,msg:'Invalid credentials'};
  setCurUser(found);return{ok:true,user:found};
}
function logout(){localStorage.removeItem('kd_cur');showScreen('loginScreen');toast('Logged out','info')}

/* User-scoped keys */
function uk(s){const u=curUser();return u?'kd_'+u.id+'_'+s:null}
function getStaffList(){return DB.g(uk('staff'))||[]}
function setStaffList(v){DB.s(uk('staff'),v)}
function getExpenses(){
  let exp = DB.g(uk('exp'))||[];
  let stx = DB.g(uk('stx'));
  if(stx && stx.length){
    exp = [...exp, ...stx];
    DB.s(uk('exp'), exp);
    localStorage.removeItem(uk('stx'));
  }
  return exp;
}
function setExpenses(v){DB.s(uk('exp'),v)}
function getRevenue(){return DB.g(uk('rev'))||[]}
function setRevenue(v){DB.s(uk('rev'),v)}

/* Monthly archive */
function getArchive(){return DB.g(uk('archive'))||{}}
function setArchive(v){DB.s(uk('archive'),v)}
function archiveMonth(m){
  const arc=getArchive();
  arc[m]={expenses:getExpenses().filter(e=>e.date.startsWith(m)),revenue:getRevenue().filter(r=>r.date.startsWith(m)),staff:JSON.parse(JSON.stringify(getStaffList()))};
  setArchive(arc);
}

/* Helpers */
function curMonth(){return new Date().toISOString().slice(0,7)}
function todayStr(){return new Date().toISOString().slice(0,10)}
function fmt(n){return '₹'+Number(n).toLocaleString('en-IN')}
function fmtD(d){return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
function monthLabel(m){const[y,mo]=m.split('-');return new Date(y,mo-1).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}

function getMonthExpenses(m){return getExpenses().filter(e=>e.date.startsWith(m))}
function getMonthRevenue(m){return getRevenue().filter(r=>r.date.startsWith(m))}
function getVisibleMonthExpenses(m){return getMonthExpenses(m).filter(e=>!STAFF_CATS.includes(e.category))}

function catTotal(cat,m){
  return getMonthExpenses(m).filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.amount),0);
}
function staffAdvTotal(sid,m){
  return getMonthExpenses(m).filter(e=>e.category==='Staff Advances' && e.staffId===sid).reduce((s,e)=>s+Number(e.amount),0);
}

/* Total cash outflow = expenses */
function totalMonthExpenses(m){
  return getMonthExpenses(m).reduce((s,e)=>s+Number(e.amount),0);
}

/* Cash Carry Forward Module */
function getAdjustments(){return DB.g(uk('cfwd'))||{}}
function setAdjustments(v){DB.s(uk('cfwd'),v)}
function saveAdjustment(m,amt,note){const a=getAdjustments();a[m]={amount:Number(amt),note};setAdjustments(a)}
function clearAdjustment(m){const a=getAdjustments();delete a[m];setAdjustments(a)}

function getAllMonths(){
  const s=new Set([...getExpenses().map(x=>x.date.slice(0,7)),...getRevenue().map(x=>x.date.slice(0,7)),...Object.keys(getAdjustments())]);
  return Array.from(s).sort();
}
function getLedger(){
  const ms=getAllMonths();
  const adjs=getAdjustments();
  let ledger=[];
  let prevClose=0;
  for(let m of ms){
    let autoOpen=prevClose;
    let hasAdj=adjs[m]!==undefined;
    let openBal=hasAdj?adjs[m].amount:autoOpen;
    let rev=getMonthRevenue(m).reduce((s,r)=>s+Number(r.amount),0);
    let exp=totalMonthExpenses(m);
    let pl=rev-exp;
    let closeBal=openBal+pl;
    ledger.push({month:m,autoOpen,manualAdj:hasAdj?adjs[m].amount:null,note:hasAdj?adjs[m].note:'',revenue:rev,expenses:exp,profit:pl,closing:closeBal});
    prevClose=closeBal;
  }
  return ledger;
}
function getMonthLedger(m){
  const led=getLedger();
  return led.find(x=>x.month===m)||{month:m,autoOpen:0,manualAdj:null,note:'',revenue:0,expenses:0,profit:0,closing:0};
}
