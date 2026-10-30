(function(){
  const ADMIN_CONFIG_URL = 'admin-config.json?_=' + Date.now();
  let currentPhone = '';
  let otpSession = null;
  
  const stepPhone = document.getElementById('step-phone');
  const stepOtp = document.getElementById('step-otp');
  const stepPass = document.getElementById('step-password');
  
  const phoneInput = document.getElementById('phone');
  const sendBtn = document.getElementById('send-otp');
  const phoneErr = document.getElementById('phone-error');
  const phoneInfo = document.getElementById('phone-info');
  
  const otpInput = document.getElementById('otp');
  const verifyBtn = document.getElementById('verify-otp');
  const resendBtn = document.getElementById('resend-otp');
  const otpErr = document.getElementById('otp-error');
  
  const passInput = document.getElementById('admin-pass');
  const loginBtn = document.getElementById('login-admin');
  const passErr = document.getElementById('pass-error');
  
  function show(el){ el.classList.remove('hidden'); }
  function hide(el){ el.classList.add('hidden'); }
  function err(el,msg){ el.textContent=msg; el.style.display='block'; }
  function clearErr(el){ el.style.display='none'; el.textContent=''; }
  
  async function getConfig(){
    try{
      const res = await fetch(ADMIN_CONFIG_URL);
      if(!res.ok) throw new Error('config not found');
      return await res.json();
    }catch(e){
      return { users: [] };
    }
  }
  
  sendBtn.addEventListener('click', async ()=>{
    clearErr(phoneErr); clearErr(phoneInfo);
    const phone = phoneInput.value.trim();
    if(!phone){ err(phoneErr,'Enter phone number'); return; }
    currentPhone = phone;
    const cfg = await getConfig();
    const user = (cfg.users||[]).find(u => (u.phone||'').replace(/\s+/g,'') === phone.replace(/\s+/g,''));
    if(!user){ err(phoneErr,'Phone number not authorized'); return; }
    // Generate OTP (6 digits) - in production this would be sent via SMS
    const otp = Math.floor(100000 + Math.random()*900000).toString();
    otpSession = { phone: currentPhone, otp: otp, user: user };
    // Store in sessionStorage for verification
    sessionStorage.setItem('admin_otp_session', JSON.stringify(otpSession));
    phoneInfo.textContent = 'OTP sent to registered number. (Demo: ' + otp + ')';
    phoneInfo.style.display = 'block';
    hide(stepPhone);
    show(stepOtp);
    otpInput.focus();
  });
  
  verifyBtn.addEventListener('click', ()=>{
    clearErr(otpErr);
    const code = otpInput.value.trim();
    const sess = JSON.parse(sessionStorage.getItem('admin_otp_session')||'null');
    if(!sess || sess.phone !== currentPhone){ err(otpErr,'Session expired. Send OTP again.'); return; }
    if(code !== sess.otp){ err(otpErr,'Invalid OTP'); return; }
    hide(stepOtp);
    show(stepPass);
    passInput.focus();
  });
  
  resendBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    sendBtn.click();
  });
  
  loginBtn.addEventListener('click', async ()=>{
    clearErr(passErr);
    const pwd = passInput.value;
    if(!pwd){ err(passErr,'Enter password'); return; }
    const sess = JSON.parse(sessionStorage.getItem('admin_otp_session')||'null');
    if(!sess){ err(passErr,'Session expired'); return; }
    const cfg = await getConfig();
    const user = (cfg.users||[]).find(u => (u.phone||'').replace(/\s+/g,'') === sess.phone.replace(/\s+/g,''));
    if(!user){ err(passErr,'Invalid user'); return; }
    if(user.password && user.password !== pwd){ err(passErr,'Invalid password'); return; }
    // If no password set, allow setting it
    sessionStorage.setItem('admin_auth', 'true');
    sessionStorage.setItem('admin_user', JSON.stringify({phone: user.phone, name: user.name||'Admin'}));
    sessionStorage.removeItem('admin_otp_session');
    window.location.href = 'admin-dashboard.html';
  });
  
  passInput.addEventListener('keypress', (e)=>{
    if(e.key === 'Enter') loginBtn.click();
  });
})();
