/* ===== KD Singh — App UI ===== */
let CM=curMonth();let activeExpCat='';

function changeMonth(delta){
  const d=new Date(CM+'-01');d.setMonth(d.getMonth()+delta);CM=d.toISOString().slice(0,7);
  document.getElementById('curMonthBadge').textContent=monthLabel(CM);
  const actTab=document.querySelector('.bnav-i.active').dataset.t;
  switchTab(actTab);
}

function toggleTheme(){
  const isL=document.body.classList.toggle('light-theme');
  localStorage.setItem('kd_theme',isL?'light':'dark');
}

/* Screen/View */
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active')}
function switchTab(t){
  const map={dashboard:'vDash',staff:'vStaff',expenses:'vExp',sales:'vSales',ledger:'vLedger'};
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(map[t]).classList.add('active');
  document.querySelectorAll('.bnav-i').forEach(n=>n.classList.toggle('active',n.dataset.t===t));
  if(t==='dashboard')refreshDash();if(t==='staff')renderStaff();if(t==='expenses')renderCatGrid();if(t==='sales')renderSales();if(t==='ledger')renderLedger();
}
function togglePw(id,b){const i=document.getElementById(id);const p=i.type==='password';i.type=p?'text':'password';b.innerHTML=p?'<i class="ri-eye-line"></i>':'<i class="ri-eye-off-line"></i>'}
function toast(m,t='info'){const e=document.getElementById('toast');e.textContent=m;e.className='toast show '+t;setTimeout(()=>e.className='toast',2500)}
function openMod(id){document.getElementById('overlay').classList.add('on');document.getElementById(id).classList.add('on')}
function closeMod(){document.getElementById('overlay').classList.remove('on');document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'))}
function setGreeting(){const h=new Date().getHours();document.getElementById('greet').textContent=h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening';const u=curUser();if(u){document.getElementById('uName').textContent=u.name;}}

/* Auth */
document.getElementById('loginForm').onsubmit = async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const ogText = btn.innerHTML;
  btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Authenticating...';
  btn.disabled = true;
  const r = await loginUser(document.getElementById('loginUser').value.trim(), document.getElementById('loginPass').value);
  btn.innerHTML = ogText;
  btn.disabled = false;
  if(r.ok) {
    showScreen('mainApp');
    initApp();
    toast('Welcome back!', 'ok');
  } else {
    toast(r.msg, 'err');
  }
};

document.getElementById('regForm').onsubmit = async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const ogText = btn.innerHTML;
  btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Registering...';
  btn.disabled = true;
  const r = await registerUser(
    document.getElementById('regName').value.trim(), 
    document.getElementById('regEmail').value.trim(), 
    document.getElementById('regPhone').value.trim(), 
    document.getElementById('regPass').value
  );
  btn.innerHTML = ogText;
  btn.disabled = false;
  if(r.ok) {
    showScreen('mainApp');
    initApp();
    toast('Account created!', 'ok');
  } else {
    toast(r.msg, 'err');
  }
};

/* OTP & Password Reset Flow */
let pendingOtpEmail = '';
let otpTimerInterval = null;

document.getElementById('forgotPwForm').onsubmit = async e => {
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim();
  if(!email) return;
  const btn = e.target.querySelector('button[type="submit"]');
  const ogText = btn.innerHTML;
  btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Sending OTP...';
  btn.disabled = true;
  
  const r = await sendOtpEmail(email);
  btn.innerHTML = ogText;
  btn.disabled = false;
  
  if(r.ok) {
    pendingOtpEmail = email;
    resetOtpScreen();
    showScreen('otpScreen');
    document.getElementById('otpSubtext').textContent = 'Code sent to ' + email;
    startOtpTimer();
    if(r.method === 'email') {
      toast('OTP sent to ' + email + '! Check your inbox.', 'ok');
    } else {
      toast('⚠️ EmailJS not configured. OTP: ' + r.fallbackCode, 'info');
    }
  } else {
    toast(r.msg || 'Failed to send OTP. Try again.', 'err');
  }
};

function resetOtpScreen() {
  document.getElementById('otpCode').value = '';
  document.getElementById('otpCode').disabled = false;
  document.getElementById('otpStep1').style.display = 'flex';
  document.getElementById('otpForm').style.display = 'none';
  document.getElementById('btnVerifyOtp').disabled = false;
  document.getElementById('btnVerifyOtp').innerHTML = '<i class="ri-check-double-line"></i> Verify OTP';
}

function startOtpTimer() {
  if(otpTimerInterval) clearInterval(otpTimerInterval);
  let seconds = 600; // 10 minutes
  const el = document.getElementById('otpCountdown');
  const timerDiv = document.getElementById('otpTimer');
  timerDiv.classList.remove('expired');
  
  otpTimerInterval = setInterval(() => {
    seconds--;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    el.textContent = 'Code expires in ' + m + ':' + (s < 10 ? '0' : '') + s;
    if(seconds <= 0) {
      clearInterval(otpTimerInterval);
      el.textContent = 'Code expired! Request a new one.';
      timerDiv.classList.add('expired');
    }
  }, 1000);
}

function verifyOTP() {
  const code = document.getElementById('otpCode').value.trim();
  if(code.length !== 6 || !/^\d{6}$/.test(code)) {
    toast('Enter a valid 6-digit code', 'err');
    return;
  }
  const btn = document.getElementById('btnVerifyOtp');
  btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Verifying...';
  btn.disabled = true;
  
  const r = validateOtp(pendingOtpEmail, code);
  if(r.ok) {
    if(otpTimerInterval) clearInterval(otpTimerInterval);
    toast('Email verified! Set your new password.', 'ok');
    // Hide step 1, show step 2
    document.getElementById('otpStep1').style.display = 'none';
    document.getElementById('otpForm').style.display = 'flex';
  } else {
    btn.innerHTML = '<i class="ri-check-double-line"></i> Verify OTP';
    btn.disabled = false;
    toast(r.msg, 'err');
  }
}

async function resendOTP() {
  if(!pendingOtpEmail) { toast('No email set. Go back and try again.', 'err'); return; }
  const btn = document.getElementById('btnResendOtp');
  btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Resending...';
  btn.disabled = true;
  
  const r = await sendOtpEmail(pendingOtpEmail);
  btn.innerHTML = '<i class="ri-refresh-line"></i> Resend Code';
  btn.disabled = false;
  
  if(r.ok) {
    document.getElementById('otpCode').value = '';
    startOtpTimer();
    if(r.method === 'email') {
      toast('New OTP sent to ' + pendingOtpEmail, 'ok');
    } else {
      toast('New OTP: ' + r.fallbackCode, 'info');
    }
  } else {
    toast(r.msg || 'Failed to resend. Try again.', 'err');
  }
}

document.getElementById('otpForm').onsubmit = async e => {
  e.preventDefault();
  const newPass = document.getElementById('resetNewPass').value;
  const confirmPass = document.getElementById('resetConfirmPass').value;
  
  if(newPass.length < 6) { toast('Password must be at least 6 characters', 'err'); return; }
  if(newPass !== confirmPass) { toast('Passwords do not match!', 'err'); return; }
  
  const btn = document.getElementById('btnResetPw');
  const ogText = btn.innerHTML;
  btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Saving...';
  btn.disabled = true;
  
  const r = await resetPasswordWithMockOtp(pendingOtpEmail, newPass);
  btn.innerHTML = ogText;
  btn.disabled = false;
  
  if(r.ok) {
    toast('Password updated! Check your email for the reset link to finalize.', 'ok');
    showScreen('loginScreen');
  } else {
    toast(r.msg, 'err');
  }
};

/* ===== STAFF ===== */
function renderStaff(){
  const list=getStaffList(),el=document.getElementById('staffGrid');
  /* Monthly context indicator */
  const ctxEl=document.getElementById('staffMonthCtx');
  if(ctxEl){
    const totalSalPaid=getMonthExpenses(CM).filter(e=>e.category==='Staff Salary').reduce((s,e)=>s+Number(e.amount),0);
    const totalAdv=getMonthExpenses(CM).filter(e=>e.category==='Staff Advances').reduce((s,e)=>s+Number(e.amount),0);
    const totalBase=list.reduce((s,st)=>s+Number(st.salary||0),0);
    ctxEl.innerHTML=`<div class="month-ctx-bar">
      <div class="month-ctx-label"><i class="ri-calendar-check-line"></i> ${monthLabel(CM)}</div>
      <div class="month-ctx-chips">
        <span class="ctx-chip"><small>Total Base</small><b>${fmt(totalBase)}</b></span>
        <span class="ctx-chip ctx-paid"><small>Salary Paid</small><b>${fmt(totalSalPaid)}</b></span>
        <span class="ctx-chip ctx-adv"><small>Advances</small><b>${fmt(totalAdv)}</b></span>
        <span class="ctx-chip ctx-rem"><small>Remaining</small><b>${fmt(totalBase - totalSalPaid - totalAdv)}</b></span>
      </div>
    </div>`;
  }
  if(!list.length){el.innerHTML='<div class="empty"><i class="ri-team-line"></i><p>No staff added</p></div>';return}
  el.innerHTML=list.map(s=>{
    const adv=staffAdvTotal(s.id,CM);
    const salPaid=getMonthExpenses(CM).filter(e=>e.category==='Staff Salary'&&e.staffId===s.id).reduce((sum,e)=>sum+Number(e.amount),0);
    const otherExp=getMonthExpenses(CM).filter(e=>e.category==='Staff Expense'&&e.staffId===s.id).reduce((sum,e)=>sum+Number(e.amount),0);
    const remaining=s.salary - salPaid - adv;
    return`<div class="stf" onclick="openStaffDet('${s.id}')">
      <div class="stf-av">${s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
      <div class="stf-info">
        <div class="stf-name">${s.name}</div>
        <div class="stf-role">${s.role||'Staff'}</div>
        <div class="stf-sal" style="font-size:0.8rem;color:var(--text2);margin-top:4px">Base: ${fmt(s.salary)}${salPaid?' • Paid: '+fmt(salPaid):''}${adv?' • Adv: '+fmt(adv):''}${otherExp?' • Other: '+fmt(otherExp):''}</div>
        <div style="font-size:0.75rem;margin-top:2px;color:${remaining>0?'var(--orange)':'var(--green)'};font-weight:600">${remaining>0?'Remaining: '+fmt(remaining):'✓ Fully Paid'}</div>
      </div>
      <div class="li-acts" onclick="event.stopPropagation()">
        <button class="btn-adv" style="background:var(--blue-bg);color:var(--blue)" onclick="openSalMod('${s.id}')" title="Pay Salary"><i class="ri-wallet-3-line"></i></button>
        <button class="btn-adv" onclick="openAdvMod('${s.id}')" title="Give Advance"><i class="ri-hand-coin-line"></i></button>
        <button class="btn-adv" style="background:var(--purple-bg);color:var(--purple)" onclick="openStaffExpMod('${s.id}')" title="Other Expense"><i class="ri-money-dollar-circle-line"></i></button>
        <button class="be" onclick="editStaff('${s.id}')"><i class="ri-pencil-line"></i></button>
        <button class="bd" onclick="delStaff('${s.id}')"><i class="ri-delete-bin-line"></i></button>
      </div>
    </div>`}).join('');
}
function saveStaffForm(e){
  e.preventDefault();const list=getStaffList(),eid=document.getElementById('sEditId').value;
  const d={name:document.getElementById('sName').value.trim(),phone:document.getElementById('sPhone').value.trim(),role:document.getElementById('sRole').value.trim(),salary:Number(document.getElementById('sSalary').value)};
  if(eid){const i=list.findIndex(s=>s.id===eid);if(i>=0)Object.assign(list[i],d);toast('Updated','ok')}
  else{d.id=DB.id();list.push(d);toast('Staff added','ok')}
  setStaffList(list);closeMod();document.getElementById('fStaff').reset();document.getElementById('sEditId').value='';renderStaff();
}
function editStaff(id){
  const s=getStaffList().find(x=>x.id===id);if(!s)return;
  document.getElementById('sEditId').value=s.id;document.getElementById('sName').value=s.name;document.getElementById('sPhone').value=s.phone||'';document.getElementById('sRole').value=s.role||'';document.getElementById('sSalary').value=s.salary;
  document.getElementById('mStaffT').textContent='Edit Staff';openMod('mStaff');
}
function delStaff(id){if(!confirm('Delete staff?'))return;setStaffList(getStaffList().filter(s=>s.id!==id));setExpenses(getExpenses().filter(a=>a.staffId!==id));toast('Deleted','ok');renderStaff()}

function openStaffDet(id){
  const s=getStaffList().find(x=>x.id===id);if(!s)return;
  const advs=getMonthExpenses(CM).filter(e=>e.category==='Staff Advances'&&e.staffId===id);
  const tAdv=advs.reduce((sum,a)=>sum+Number(a.amount),0);
  const sals=getMonthExpenses(CM).filter(e=>e.category==='Staff Salary'&&e.staffId===id);
  const tSal=sals.reduce((sum,a)=>sum+Number(a.amount),0);
  document.getElementById('mStaffDetN').textContent=s.name;
  document.getElementById('mStaffDetBody').innerHTML=`
    <div class="sd-grid">
      <div class="sd-chip"><small>Base Salary</small><b class="g">${fmt(s.salary)}</b></div>
      <div class="sd-chip"><small>Salary Paid</small><b class="p">${fmt(tSal)}</b></div>
      <div class="sd-chip"><small>Advances Taken</small><b class="o">${fmt(tAdv)}</b></div>
      <div class="sd-chip" style="background:var(--blue-bg);border-color:var(--blue)"><small>Remaining Payable</small><b style="color:var(--blue);font-size:1.1rem">${fmt(s.salary - tAdv - tSal)}</b></div>
    </div>
    <div class="sd-actions" style="display:flex;gap:10px;margin-bottom:16px;">
      <button class="btn btn-sm" onclick="openSalMod('${s.id}')" style="flex:1"><i class="ri-wallet-3-line"></i> Pay Salary</button>
      <button class="btn btn-sm" onclick="openAdvMod('${s.id}')" style="flex:1"><i class="ri-hand-coin-line"></i> Give Advance</button>
    </div>
    <div class="adv-sec">
      <h4 style="margin-bottom:12px;font-size:.9rem"><i class="ri-history-line"></i> Transactions (${monthLabel(CM)})</h4>
      <div class="adv-list">${[...advs,...sals].length?[...advs,...sals].sort((a,b)=>b.date.localeCompare(a.date)).map(a=>`<div class="adv-it"><div style="flex:1"><span class="ad">${fmtD(a.date)} <span style="font-size:0.7rem;color:var(--text2);background:var(--surface2);padding:2px 4px;border-radius:4px">${a.category==='Staff Salary'?'Salary':'Advance'}</span></span><br><small style="color:var(--text3)">${a.note||''}</small></div><span class="aa ${a.category==='Staff Salary'?'p':'o'}">${fmt(a.amount)}</span><button class="bd" style="width:26px;height:26px;font-size:.8rem" onclick="delAdv('${a.id}','${s.id}')"><i class="ri-delete-bin-line"></i></button></div>`).join(''):'<div class="empty"><p>No transactions this month</p></div>'}</div>
    </div>`;
  openMod('mStaffDet');
}

function openAdvMod(sid){
  const s=getStaffList().find(x=>x.id===sid);if(!s)return;
  document.getElementById('aStaffId').value=sid;
  document.getElementById('mAdvT').textContent='Advance: '+s.name;
  document.getElementById('fAdv').reset();
  document.getElementById('aDate').value=todayStr();
  openMod('mAdv');
}
function giveAdvForm(e){
  e.preventDefault();
  const sid=document.getElementById('aStaffId').value;
  const amt=Number(document.getElementById('aAmt').value),dt=document.getElementById('aDate').value;
  if(!amt||amt<=0){toast('Enter amount','err');return}if(!dt){toast('Select date','err');return}
  const staff=getStaffList().find(s=>s.id===sid);
  const list=getExpenses();
  const userNote = document.getElementById('aNote').value.trim();
  list.push({id:DB.id(), category:'Staff Advances', amount:amt, date:dt, note:userNote?`Advance - ${userNote}`:`Advance: ${staff.name}`, staffId:sid});
  setExpenses(list);
  toast('Advance of '+fmt(amt)+' recorded','ok');
  closeMod();renderStaff();if(document.getElementById('mStaffDet').classList.contains('on'))openStaffDet(sid);
}
function openSalMod(sid){
  const s=getStaffList().find(x=>x.id===sid);if(!s)return;
  document.getElementById('salStaffId').value=sid;
  document.getElementById('mSalT').textContent='Pay Salary: '+s.name;
  document.getElementById('fSal').reset();
  document.getElementById('salDate').value=todayStr();
  openMod('mSal');
}
function paySalForm(e){
  e.preventDefault();
  const sid=document.getElementById('salStaffId').value;
  const amt=Number(document.getElementById('salAmt').value),dt=document.getElementById('salDate').value;
  if(!amt||amt<=0){toast('Enter amount','err');return}if(!dt){toast('Select date','err');return}
  const staff=getStaffList().find(s=>s.id===sid);
  const list=getExpenses();
  const userNote = document.getElementById('salNote').value.trim();
  list.push({id:DB.id(), category:'Staff Salary', amount:amt, date:dt, note:userNote?`Salary - ${userNote}`:`Salary: ${staff.name}`, staffId:sid});
  setExpenses(list);
  toast('Salary of '+fmt(amt)+' recorded','ok');
  closeMod();renderStaff();if(document.getElementById('mStaffDet').classList.contains('on'))openStaffDet(sid);
}
function delAdv(aid,sid){
  if(!confirm('Delete transaction?'))return;
  setExpenses(getExpenses().filter(e=>e.id!==aid));
  toast('Deleted','ok');openStaffDet(sid);renderStaff();
}

/* Other Staff Expense */
function openStaffExpMod(sid){
  const s=getStaffList().find(x=>x.id===sid);if(!s)return;
  document.getElementById('seStaffId').value=sid;
  document.getElementById('mStaffExpT').textContent='Other Expense: '+s.name;
  document.getElementById('fStaffExp').reset();
  document.getElementById('seDate').value=todayStr();
  openMod('mStaffExp');
}
function staffExpForm(e){
  e.preventDefault();
  const sid=document.getElementById('seStaffId').value;
  const amt=Number(document.getElementById('seAmt').value),dt=document.getElementById('seDate').value;
  if(!amt||amt<=0){toast('Enter amount','err');return}if(!dt){toast('Select date','err');return}
  const staff=getStaffList().find(s=>s.id===sid);
  const list=getExpenses();
  const userNote = document.getElementById('seNote').value.trim();
  list.push({id:DB.id(), category:'Staff Expense', amount:amt, date:dt, note:userNote?`Other Expense - ${userNote}`:`Other Expense: ${staff.name}`, staffId:sid});
  setExpenses(list);
  toast('Other expense of '+fmt(amt)+' recorded','ok');
  closeMod();renderStaff();if(document.getElementById('mStaffDet').classList.contains('on'))openStaffDet(sid);
}

/* ===== EXPENSES — CATEGORY GRID ===== */
function renderCatGrid(){
  const el=document.getElementById('catGrid');
  const cats=getVisibleCats();
  const customs=getCustomCats().map(c=>c.name);
  el.innerHTML=cats.map(c=>{
    const t=catTotal(c,CM),clr=getCatColor(c);
    const isCustom=customs.includes(c);
    return`<div class="cat-card">
      <div onclick="openCatDetail('${c}')" style="cursor:pointer">
        <div class="cat-icon" style="background:${clr}22;color:${clr}"><i class="${getCatIcon(c)}"></i></div>
        <div class="cat-name">${c}</div>
        <div class="cat-total" style="color:${clr}">${fmt(t)}</div>
      </div>
      ${isCustom?`<button class="cat-del-btn" onclick="event.stopPropagation();delCatHandler('${c}')" title="Remove Category"><i class="ri-close-circle-line"></i></button>`:''}
    </div>`}).join('');
}
function openCatDetail(cat){
  activeExpCat=cat;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('vExpDetail').classList.add('active');
  document.getElementById('expDetTitle').textContent=cat;
  renderCatDetail();
}
function renderCatDetail(){
  const cat=activeExpCat,clr=getCatColor(cat);
  const list=getMonthExpenses(CM).filter(e=>e.category===cat).sort((a,b)=>b.date.localeCompare(a.date));
  const total=catTotal(cat,CM);
  document.getElementById('expDetSummary').innerHTML=`<div class="sum-chip"><small>Total (${monthLabel(CM).split(' ')[0]})</small><b style="color:${clr}">${fmt(total)}</b></div><div class="sum-chip"><small>Entries</small><b>${list.length}</b></div>`;
  const el=document.getElementById('expDetList');
  let html='';
  // Manual entries
  html+=list.map(e=>`<div class="li">
    <div class="li-ic" style="background:${clr}22;color:${clr}"><i class="${getCatIcon(cat)}"></i></div>
    <div class="li-info"><div class="li-t">${e.note||cat}</div><div class="li-s">${fmtD(e.date)}</div></div>
    <div class="li-amt" style="color:var(--red)">${fmt(e.amount)}</div>
    <div class="li-acts">
      <button class="be" onclick="editExp('${e.id}')"><i class="ri-pencil-line"></i></button>
      <button class="bd" onclick="delExp('${e.id}')"><i class="ri-delete-bin-line"></i></button>
    </div></div>`).join('');
  if(!html)html='<div class="empty"><i class="ri-inbox-line"></i><p>No expenses in this category</p></div>';
  el.innerHTML=html;
}
function openAddExpInCat(){
  document.getElementById('eEditId').value='';document.getElementById('eCatHidden').value=activeExpCat;
  document.getElementById('eCatField').style.display='none';
  document.getElementById('eCat').removeAttribute('required');
  document.getElementById('mExpT').textContent='Add '+activeExpCat;
  document.getElementById('eDate').value=todayStr();
  document.getElementById('fExp').reset();
  document.getElementById('eDate').value=todayStr();
  openMod('mExp');
}
function saveExpForm(e){
  e.preventDefault();const list=getExpenses(),eid=document.getElementById('eEditId').value;
  const hidCat=document.getElementById('eCatHidden').value;
  const d={category:hidCat||document.getElementById('eCat').value,amount:Number(document.getElementById('eAmt').value),date:document.getElementById('eDate').value,note:document.getElementById('eNote').value.trim()};
  if(eid){const i=list.findIndex(x=>x.id===eid);if(i>=0)Object.assign(list[i],d);toast('Updated','ok')}
  else{d.id=DB.id();list.push(d);toast('Added','ok')}
  setExpenses(list);closeMod();document.getElementById('fExp').reset();document.getElementById('eEditId').value='';document.getElementById('eCatHidden').value='';document.getElementById('eCatField').style.display='flex';document.getElementById('eCat').setAttribute('required','');
  if(activeExpCat)renderCatDetail();renderCatGrid();
}
function editExp(id){
  const e=getExpenses().find(x=>x.id===id);if(!e)return;
  document.getElementById('eEditId').value=e.id;document.getElementById('eCatHidden').value=e.category;
  document.getElementById('eCatField').style.display='none';document.getElementById('eCat').removeAttribute('required');
  document.getElementById('eAmt').value=e.amount;
  document.getElementById('eDate').value=e.date;document.getElementById('eNote').value=e.note||'';
  document.getElementById('mExpT').textContent='Edit Expense';openMod('mExp');
}
function delExp(id){if(!confirm('Delete?'))return;setExpenses(getExpenses().filter(e=>e.id!==id));toast('Deleted','ok');if(activeExpCat)renderCatDetail();renderCatGrid()}

/* Custom Category Form Logic */
function selCol(el,c){document.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('active'));el.classList.add('active');document.getElementById('cColorVal').value=c;}
function selIc(el,i){document.querySelectorAll('.icon-swatch').forEach(x=>x.classList.remove('active'));el.classList.add('active');document.getElementById('cIconVal').value=i;}
function saveCatForm(e){
  e.preventDefault();
  const n=document.getElementById('cName').value.trim(), c=document.getElementById('cColorVal').value, i=document.getElementById('cIconVal').value;
  if(!c){toast('Select color','err');return} if(!i){toast('Select icon','err');return}
  const all=getAllCats(); if(all.map(x=>x.toLowerCase()).includes(n.toLowerCase())){toast('Category exists','err');return}
  if(STAFF_CATS.map(x=>x.toLowerCase()).includes(n.toLowerCase())){toast('Reserved name','err');return}
  const cs=getCustomCats(); cs.push({name:n,color:c,icon:i}); setCustomCats(cs);
  toast('Category added','ok'); closeMod(); document.getElementById('fCat').reset();
  document.querySelectorAll('.color-swatch,.icon-swatch').forEach(x=>x.classList.remove('active'));
  document.getElementById('cColorVal').value='';document.getElementById('cIconVal').value='';
  refreshCatSelect();
  if(document.getElementById('vExp').classList.contains('active')) renderCatGrid();
}

function delCatHandler(name){
  const inUse=getExpenses().filter(e=>e.category===name);
  if(inUse.length){
    /* Has expenses — open reassign modal */
    document.getElementById('reassignCatName').textContent=name;
    document.getElementById('reassignCatCount').textContent=inUse.length;
    document.getElementById('reassignFrom').value=name;
    const sel=document.getElementById('reassignTo');
    sel.innerHTML='<option value="">Select target category</option>'+getVisibleCats().filter(c=>c!==name).map(x=>'<option>'+x+'</option>').join('');
    openMod('mReassign');
  } else {
    if(!confirm(`Delete category "${name}"?`))return;
    removeCustomCat(name);
    toast('Category removed','ok');
    refreshCatSelect();
    renderCatGrid();
  }
}
function reassignAndDelete(){
  const from=document.getElementById('reassignFrom').value;
  const to=document.getElementById('reassignTo').value;
  if(!to){toast('Select a target category','err');return}
  const exps=getExpenses();
  exps.forEach(e=>{if(e.category===from)e.category=to});
  setExpenses(exps);
  removeCustomCat(from);
  toast('Expenses reassigned & category removed','ok');
  closeMod();
  refreshCatSelect();
  renderCatGrid();
}
function deleteWithExpenses(){
  const from=document.getElementById('reassignFrom').value;
  if(!confirm(`This will permanently delete ALL expenses in "${from}". Continue?`))return;
  setExpenses(getExpenses().filter(e=>e.category!==from));
  removeCustomCat(from);
  toast('Category & expenses deleted','ok');
  closeMod();
  refreshCatSelect();
  renderCatGrid();
}
function refreshCatSelect(){
  const sel=document.getElementById('eCat');
  sel.innerHTML='<option value="">Select Category</option>'+getVisibleCats().map(x=>'<option>'+x+'</option>').join('');
}

/* ===== SALES ===== */
function renderSales(){
  const list=getMonthRevenue(CM).sort((a,b)=>b.date.localeCompare(a.date));
  const total=list.reduce((s,r)=>s+Number(r.amount),0),avg=list.length?Math.round(total/list.length):0;
  document.getElementById('saleSummary').innerHTML=`<div class="sum-chip"><small>Total</small><b style="color:var(--green)">${fmt(total)}</b></div><div class="sum-chip"><small>Daily Avg</small><b style="color:var(--blue)">${fmt(avg)}</b></div><div class="sum-chip"><small>Entries</small><b>${list.length}</b></div>`;
  const el=document.getElementById('saleList');
  if(!list.length){el.innerHTML='<div class="empty"><i class="ri-money-rupee-circle-line"></i><p>No sales this month</p></div>';return}
  el.innerHTML=list.map(r=>`<div class="li">
    <div class="li-ic" style="background:var(--green-bg);color:var(--green)"><i class="ri-arrow-up-circle-fill"></i></div>
    <div class="li-info"><div class="li-t">${r.note||'Revenue'}</div><div class="li-s">${fmtD(r.date)}</div></div>
    <div class="li-amt" style="color:var(--green)">+${fmt(r.amount)}</div>
    <div class="li-acts">
      <button class="be" onclick="editSale('${r.id}')"><i class="ri-pencil-line"></i></button>
      <button class="bd" onclick="delSale('${r.id}')"><i class="ri-delete-bin-line"></i></button>
    </div></div>`).join('');
}
function saveSaleForm(e){
  e.preventDefault();const list=getRevenue(),eid=document.getElementById('rEditId').value;
  const d={amount:Number(document.getElementById('rAmt').value),date:document.getElementById('rDate').value,note:document.getElementById('rNote').value.trim()};
  if(eid){const i=list.findIndex(x=>x.id===eid);if(i>=0)Object.assign(list[i],d);toast('Updated','ok')}
  else{d.id=DB.id();list.push(d);toast('Added','ok')}
  setRevenue(list);closeMod();document.getElementById('fSale').reset();document.getElementById('rEditId').value='';renderSales();
}
function editSale(id){const r=getRevenue().find(x=>x.id===id);if(!r)return;document.getElementById('rEditId').value=r.id;document.getElementById('rAmt').value=r.amount;document.getElementById('rDate').value=r.date;document.getElementById('rNote').value=r.note||'';document.getElementById('mSaleT').textContent='Edit Sale';openMod('mSale')}
function delSale(id){if(!confirm('Delete?'))return;setRevenue(getRevenue().filter(r=>r.id!==id));toast('Deleted','ok');renderSales()}

/* ===== DASHBOARD ===== */
let ch1=null,ch2=null;
function refreshDash(){
  const revs=getMonthRevenue(CM);
  const tR=revs.reduce((s,r)=>s+Number(r.amount),0),tE=totalMonthExpenses(CM),net=tR-tE;
  const exps=getMonthExpenses(CM);
  document.getElementById('dRev').textContent=fmt(tR);document.getElementById('dExp').textContent=fmt(tE);
  const nEl=document.getElementById('dNet');nEl.textContent=(net>=0?'+':'')+fmt(net);nEl.style.color=net>=0?'var(--green)':'var(--red)';
  document.getElementById('profitCard').style.borderColor=net>=0?'rgba(0,230,118,.2)':'rgba(255,82,82,.2)';
  
  const led = getMonthLedger(CM);
  const ob = led.manualAdj!==null ? led.manualAdj : led.autoOpen;
  document.getElementById('dOpenBal').textContent=fmt(ob);
  document.getElementById('dCloseBal').textContent=fmt(led.closing);

  drawBarChart();drawPieChart(exps);drawActivity();
}
function drawBarChart(){
  const c=document.getElementById('barChart');if(ch1)ch1.destroy();
  const L=[],R=[],E=[];
  for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);const m=d.toISOString().slice(0,7);L.push(d.toLocaleDateString('en-IN',{month:'short'}));R.push(getRevenue().filter(r=>r.date.startsWith(m)).reduce((s,r)=>s+Number(r.amount),0));E.push(totalMonthExpenses(m))}
  ch1=new Chart(c,{type:'bar',data:{labels:L,datasets:[{label:'Revenue',data:R,backgroundColor:'rgba(0,230,118,.65)',borderRadius:6},{label:'Expenses',data:E,backgroundColor:'rgba(255,82,82,.65)',borderRadius:6}]},options:{responsive:true,plugins:{legend:{labels:{color:'#9ca3af',font:{family:'Inter'}}}},scales:{x:{ticks:{color:'#6b7280'},grid:{display:false}},y:{ticks:{color:'#6b7280',callback:v=>'₹'+(v>=1000?(v/1000)+'k':v)},grid:{color:'rgba(255,255,255,.04)'}}}}});
}
function drawPieChart(exps){
  const c=document.getElementById('pieChart');if(ch2)ch2.destroy();
  const visExps=exps.filter(e=>!STAFF_CATS.includes(e.category));
  const ct={};visExps.forEach(e=>{ct[e.category]=(ct[e.category]||0)+Number(e.amount)});
  const cats=Object.keys(ct);if(!cats.length){ch2=null;return}
  ch2=new Chart(c,{type:'doughnut',data:{labels:cats,datasets:[{data:cats.map(c=>ct[c]),backgroundColor:cats.map(c=>getCatColor(c)),borderWidth:0}]},options:{responsive:true,cutout:'62%',plugins:{legend:{position:'bottom',labels:{color:'#9ca3af',padding:10,font:{family:'Inter',size:10}}}}}});
}
function drawActivity(){
  const visExps=getVisibleMonthExpenses(CM).map(e=>({...e,tp:'exp'}));
  const all=[...getMonthRevenue(CM).map(r=>({...r,tp:'rev'})),...visExps].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  const el=document.getElementById('actList');
  if(!all.length){el.innerHTML='<div class="empty"><p>No activity this month</p></div>';return}
  el.innerHTML=all.map(a=>`<div class="act"><div class="act-dot ${a.tp==='rev'?'g':'r'}"></div><div class="act-txt">${a.tp==='rev'?'Revenue':a.category}${a.note?' — '+a.note:''}<br><small style="color:var(--text3)">${fmtD(a.date)}</small></div><div class="act-amt ${a.tp==='rev'?'p':'n'}">${a.tp==='rev'?'+':'−'}${fmt(a.amount)}</div></div>`).join('');
}

/* ===== LEDGER / CARRY FORWARD ===== */
function renderLedger(){
  const led = getLedger();
  led.reverse();
  const el = document.getElementById('ledgerList');
  if(!led.length){ el.innerHTML = '<div class="empty"><i class="ri-booklet-line"></i><p>No financial data available</p></div>'; return; }
  
  el.innerHTML = led.map(l=>`
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="font-size:1.1rem">${monthLabel(l.month)}</h3>
        <div style="display:flex;gap:6px;align-items:center">
          ${l.manualAdj!==null ? `<span style="font-size:0.7rem;background:var(--blue-bg);color:var(--blue);padding:2px 6px;border-radius:4px"><i class="ri-edit-line"></i> Adjusted</span>` : ''}
          <button class="ledger-edit-btn" onclick="openAdjModFor('${l.month}')" style="margin-top:0" title="Edit opening balance"><i class="ri-edit-circle-line"></i> Edit</button>
        </div>
      </div>
      <div class="sd-grid">
        <div class="sd-chip"><small>Opening Balance</small><b style="color:var(--text)">${fmt(l.manualAdj!==null?l.manualAdj:l.autoOpen)}</b></div>
        <div class="sd-chip"><small>Closing Balance</small><b style="color:var(--purple)">${fmt(l.closing)}</b></div>
        <div class="sd-chip"><small>Total Revenue</small><b class="g">${fmt(l.revenue)}</b></div>
        <div class="sd-chip"><small>Total Expenses</small><b class="r">${fmt(l.expenses)}</b></div>
      </div>
      ${l.note ? `<div style="margin-top:10px;font-size:0.8rem;color:var(--text2)"><i class="ri-information-line"></i> ${l.note}</div>` : ''}
      ${l.manualAdj!==null ? `<button class="bd" style="margin-top:10px;font-size:0.8rem;padding:4px 8px;height:auto" onclick="delAdj('${l.month}')"><i class="ri-delete-bin-line"></i> Remove Adjustment</button>` : ''}
    </div>`).join('');
}

function openAdjMod(){
  document.getElementById('fAdj').reset();
  document.getElementById('adjMonth').value = CM;
  const l = getMonthLedger(CM);
  if(l.manualAdj!==null){
    document.getElementById('adjAmt').value = l.manualAdj;
    document.getElementById('adjNote').value = l.note;
  } else {
    document.getElementById('adjAmt').value = l.autoOpen;
  }
  openMod('mAdj');
}
function openAdjModFor(month){
  document.getElementById('fAdj').reset();
  document.getElementById('adjMonth').value = month;
  const l = getMonthLedger(month);
  if(l.manualAdj!==null){
    document.getElementById('adjAmt').value = l.manualAdj;
    document.getElementById('adjNote').value = l.note;
  } else {
    document.getElementById('adjAmt').value = l.autoOpen;
  }
  openMod('mAdj');
}

function saveAdjForm(e){
  e.preventDefault();
  const m = document.getElementById('adjMonth').value;
  const amt = document.getElementById('adjAmt').value;
  const note = document.getElementById('adjNote').value.trim();
  saveAdjustment(m, amt, note);
  toast('Opening balance adjusted', 'ok');
  closeMod();
  renderLedger();
  if(CM===m) refreshDash();
}

function delAdj(m){
  if(!confirm('Remove manual adjustment? The balance will revert to automatic calculation.'))return;
  clearAdjustment(m);
  toast('Adjustment removed','info');
  renderLedger();
  if(CM===m) refreshDash();
}

/* ===== INIT ===== */
function initApp(){
  setGreeting();
  migrateObsoleteCats(); /* Auto-remove obsolete categories */
  document.getElementById('curMonthBadge').textContent=monthLabel(CM);
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').then(()=>console.log('SW Registered'));
  }
  document.getElementById('eDate').value=todayStr();
  document.getElementById('rDate').value=todayStr();
  const sel=document.getElementById('eCat');
  sel.innerHTML='<option value="">Select Category</option>'+getVisibleCats().map(c=>'<option>'+c+'</option>').join('');
  
  // Render category modal options
  const cg=document.getElementById('cColorGrid'), ig=document.getElementById('cIconGrid');
  if(cg) cg.innerHTML=COLOR_LIST.map(c=>`<div class="color-swatch" style="background:${c}" onclick="selCol(this,'${c}')"></div>`).join('');
  if(ig) ig.innerHTML=ICON_LIST.map(i=>`<div class="icon-swatch" onclick="selIc(this,'${i}')"><i class="${i}"></i></div>`).join('');
  
  switchTab('dashboard');
}
window.addEventListener('DOMContentLoaded',()=>{
  const savedT=localStorage.getItem('kd_theme');
  if(savedT==='light'||(!savedT&&window.matchMedia('(prefers-color-scheme: light)').matches)){
    document.body.classList.add('light-theme');
  }
  
  // Use Firebase auth state listener for persistent login across devices
  initCloud();
  let authResolved = false;
  
  if (typeof firebase !== 'undefined' && fbAuth) {
    fbAuth.onAuthStateChanged((user) => {
      if (authResolved) return; // Only handle the first callback
      authResolved = true;
      if (user) {
        setCurUser({ id: user.uid, email: user.email, name: user.displayName || user.email.split('@')[0] });
        showScreen('mainApp');
        initApp();
        syncDataFromCloud(user.uid);
      } else {
        showScreen('loginScreen');
      }
    });
    
    // Fallback timeout in case Firebase is slow to respond
    setTimeout(() => {
      if (!authResolved) {
        authResolved = true;
        const u = curUser();
        if (u) { showScreen('mainApp'); initApp(); }
        else showScreen('loginScreen');
      }
    }, 3000);
  } else {
    // Fallback if Firebase not available
    setTimeout(() => {
      const u = curUser();
      if(u){showScreen('mainApp');initApp()}else showScreen('loginScreen');
    }, 1200);
  }
});
