(function(){
  // Auth check
  if(sessionStorage.getItem('admin_auth') !== 'true'){
    window.location.href = 'admin-login.html';
    return;
  }
  
  const adminUser = JSON.parse(sessionStorage.getItem('admin_user')||'{}');
  document.getElementById('admin-info').textContent = 'Logged in as: ' + (adminUser.name || adminUser.phone || 'Admin');
  
  document.getElementById('logout').addEventListener('click', ()=>{
    sessionStorage.removeItem('admin_auth');
    sessionStorage.removeItem('admin_user');
    window.location.href = 'admin-login.html';
  });
  
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
      if(tab.dataset.tab === 'theatres') loadTheatres();
      if(tab.dataset.tab === 'media') loadMedia();
    });
  });
  
  async function loadTheatres(){
    const list = document.getElementById('theatres-list');
    list.innerHTML = '<p>Loading...</p>';
    try{
      const res = await fetch('data/odisha/theatre/index.json?_=' + Date.now());
      if(res.ok){
        const data = await res.json();
        list.innerHTML = '<pre style="overflow:auto;">' + JSON.stringify(data, null, 2) + '</pre>';
      }else{
        // Try individual files
        list.innerHTML = '<p>Theatre data loaded from CMS. Use Theatre Editor for detailed editing.</p>';
      }
    }catch(e){
      list.innerHTML = '<p>Error loading theatres</p>';
    }
  }
  
  async function loadMedia(){
    const list = document.getElementById('media-list');
    list.innerHTML = '<p>Media files in /media/ directory</p>';
  }
  
  window.saveHome = function(){
    alert('Home page changes saved (demo). In production, this would update the CMS and trigger publish.');
  };
  
  window.saveSite = function(){
    alert('Site settings saved (demo).');
  };
  
  // Load existing data
  fetch('data/odisha/home.json?_=' + Date.now()).then(r=>r.json()).then(d=>{
    // Can populate fields if needed
  }).catch(()=>{});
})();
