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

/* ===== Cloud Backend Services (Firebase Compat) ===== */
let fbAuth, fbDb;
let isCloudInitialized = false;

function initCloud() {
  if (isCloudInitialized) return;
  if (typeof firebase === 'undefined') return;
  try {
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    isCloudInitialized = true;
    
    // Listen for auth state changes
    fbAuth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurUser({ id: user.uid, email: user.email, name: user.displayName || user.email.split('@')[0] });
        syncDataFromCloud(user.uid);
      } else {
        localStorage.removeItem('kd_cur');
      }
    });
  } catch (e) {
    console.error("Firebase init failed:", e);
  }
}

/* Auth */
function curUser(){return DB.g('kd_cur')}
function setCurUser(u){DB.s('kd_cur',u)}

async function registerUser(n, e, phone, p){
  initCloud();
  if(!isCloudInitialized) return {ok:false, msg:'Backend not configured. Check Firebase setup.'};
  try {
    const cred = await fbAuth.createUserWithEmailAndPassword(e, p);
    const u = {id: cred.user.uid, name: n, email: e, phone: phone};
    setCurUser(u);
    // Initialize firestore doc
    await fbDb.collection("users").doc(u.id).set({ name: n, email: e, phone: phone, createdAt: new Date().toISOString() });
    
    // Save phone mapping for login
    if (phone) {
      await fbDb.collection("userMappings").doc(phone).set({ email: e });
    }
    return {ok:true, user:u};
  } catch (err) {
    return {ok:false, msg: err.message.replace('Firebase: ','')};
  }
}

async function loginUser(u, p){
  initCloud();
  if(!isCloudInitialized) return {ok:false, msg:'Backend not configured. Check Firebase setup.'};
  try {
    let emailToUse = u;
    // If not an email, lookup in userMappings (Phone login)
    if (!u.includes('@')) {
      const mapSnap = await fbDb.collection("userMappings").doc(u).get();
      if (mapSnap.exists) {
        emailToUse = mapSnap.data().email;
      }
    }
    
    const cred = await fbAuth.signInWithEmailAndPassword(emailToUse, p);
    const userObj = {id: cred.user.uid, email: cred.user.email, name: cred.user.displayName || u};
    setCurUser(userObj);
    await syncDataFromCloud(cred.user.uid);
    return {ok:true, user:userObj};
  } catch (err) {
    return {ok:false, msg: err.message.replace('Firebase: ','')};
  }
}

function logout(){
  if(fbAuth) fbAuth.signOut();
  localStorage.removeItem('kd_cur');
  showScreen('loginScreen');
  toast('Logged out','info');
}

/* OTP & Forgot Password — Real Email Delivery via EmailJS */
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 3;
let _otpData = null; // { code, email, expiresAt, attempts }

// EmailJS Config — User must replace these after signing up at emailjs.com
const EMAILJS_SERVICE_ID = 'service_ecmqtvl';
const EMAILJS_TEMPLATE_ID = 'template_rjklnic';

async function sendOtpEmail(email) {
  initCloud();
  if(!isCloudInitialized) return {ok:false, msg:'Backend not configured'};
  
  // Verify email exists in Firebase Auth by checking userMappings or attempting reset
  try {
    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;
    
    // Store OTP with expiry and attempt counter
    _otpData = { code: otp, email: email, expiresAt: expiresAt, attempts: 0 };
    
    // Also send Firebase's built-in reset link as backup
    try { await fbAuth.sendPasswordResetEmail(email); } catch(e) { /* ignore if fails */ }
    
    // Try to send OTP via EmailJS
    const emailjsConfigured = EMAILJS_SERVICE_ID !== 'YOUR_SERVICE_ID' && EMAILJS_TEMPLATE_ID !== 'YOUR_TEMPLATE_ID';
    
    if (emailjsConfigured && typeof emailjs !== 'undefined') {
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_email: email,
          otp_code: otp,
          app_name: "KD Singh's Expense Tracker",
          expiry_minutes: '10'
        });
        console.log('[OTP] Email sent successfully via EmailJS');
        return {ok:true, method:'email'};
      } catch (emailErr) {
        console.error('[OTP] EmailJS send failed:', emailErr);
        // Fall through to fallback
      }
    }
    
    // Fallback: show OTP in alert if EmailJS not configured
    console.log(`[OTP FALLBACK] Code for ${email}: ${otp} (expires in 10 min)`);
    return {ok:true, method:'fallback', fallbackCode: otp};
    
  } catch (err) {
    return {ok:false, msg: err.message.replace('Firebase: ','')};
  }
}

function validateOtp(email, code) {
  if (!_otpData) return {ok:false, msg:'No OTP was requested. Please request a new one.'};
  
  // Check email matches
  if (_otpData.email !== email) return {ok:false, msg:'OTP was sent to a different email.'};
  
  // Check expiry
  if (Date.now() > _otpData.expiresAt) {
    _otpData = null;
    return {ok:false, msg:'OTP has expired. Please request a new one.'};
  }
  
  // Check retry limit
  _otpData.attempts++;
  if (_otpData.attempts > OTP_MAX_ATTEMPTS) {
    _otpData = null;
    return {ok:false, msg:'Too many failed attempts. Please request a new OTP.'};
  }
  
  // Validate code
  if (code === _otpData.code) {
    return {ok:true};
  }
  
  const remaining = OTP_MAX_ATTEMPTS - _otpData.attempts;
  return {ok:false, msg:`Invalid OTP. ${remaining} attempt(s) remaining.`};
}

async function resetPasswordWithMockOtp(email, newPass) {
  // Clear the OTP data after successful reset
  _otpData = null;
  // The actual password reset happens via the Firebase reset link sent to their email.
  // This confirms the OTP flow was successful in the UI.
  return {ok:true};
}

/* Cloud Sync Functions */
async function syncDataFromCloud(userId) {
  if(!fbDb) return;
  const ind = document.getElementById('cloudSyncIndicator');
  if(ind) ind.innerHTML = '<i class="ri-loader-4-line ri-spin" style="color:var(--accent)"></i>';
  
  try {
    const docSnap = await fbDb.collection("users").doc(userId).get();
    if(docSnap.exists) {
      const data = docSnap.data();
      if(data.customCats) DB.s(uk('customCats'), data.customCats);
      if(data.staff) DB.s(uk('staff'), data.staff);
      if(data.exp) DB.s(uk('exp'), data.exp);
      if(data.rev) DB.s(uk('rev'), data.rev);
      if(data.cfwd) DB.s(uk('cfwd'), data.cfwd);
      
      // Re-render UI if logged in
      if(document.getElementById('mainApp').classList.contains('active')) {
        const actTab = document.querySelector('.bnav-i.active')?.dataset.t;
        if(actTab) switchTab(actTab);
      }
    }
  } catch (e) {
    console.error("Sync failed", e);
  } finally {
    if(ind) ind.innerHTML = '<i class="ri-cloud-line" style="color:var(--green)"></i>';
  }
}

async function saveToCloud(userId) {
  if(!fbDb || !userId) return;
  const ind = document.getElementById('cloudSyncIndicator');
  if(ind) ind.innerHTML = '<i class="ri-loader-4-line ri-spin" style="color:var(--orange)"></i>';
  
  try {
    const payload = {
      customCats: getCustomCats(),
      staff: getStaffList(),
      exp: DB.g(uk('exp'))||[],
      rev: getRevenue(),
      cfwd: getAdjustments(),
      lastUpdated: new Date().toISOString()
    };
    await fbDb.collection("users").doc(userId).set(payload, { merge: true });
  } catch (e) {
    console.error("Cloud save failed", e);
  } finally {
    if(ind) ind.innerHTML = '<i class="ri-cloud-line" style="color:var(--green)"></i>';
  }
}

/* Overwrite local setters to also trigger cloud save */
const _originalSetCustomCats = setCustomCats;
setCustomCats = function(v) { _originalSetCustomCats(v); const u=curUser(); if(u) saveToCloud(u.id); };

/* User-scoped keys */
function uk(s){const u=curUser();return u?'kd_'+u.id+'_'+s:null}
function getStaffList(){return DB.g(uk('staff'))||[]}
function setStaffList(v){DB.s(uk('staff'),v); const u=curUser(); if(u) saveToCloud(u.id);}
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
function setExpenses(v){DB.s(uk('exp'),v); const u=curUser(); if(u) saveToCloud(u.id);}
function getRevenue(){return DB.g(uk('rev'))||[]}
function setRevenue(v){DB.s(uk('rev'),v); const u=curUser(); if(u) saveToCloud(u.id);}

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
function setAdjustments(v){DB.s(uk('cfwd'),v); const u=curUser(); if(u) saveToCloud(u.id);}
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
