let currentUser = null;

async function loadUser() {
  try {
    const res = await Auth.getCurrentUser();
    if (res && res.user) {
      currentUser = res.user;
      document.getElementById('userName').innerText = currentUser.nombre.split(' ')[0];
      document.getElementById('loginBtn').style.display = 'none';
      document.getElementById('logoutBtn').style.display = 'inline-block';
      cargarBoletos();
    } else {
      window.location.href = '/login.html?redirect=mis-boletos';
    }
  } catch(e) {
    console.error('Error de autenticación:', e);
    window.location.href = '/login.html?redirect=mis-boletos';
  }
}

document.getElementById('logoutBtn').onclick = async () => {
  await Auth.logout();
  location.href = '/';
};

async function cargarBoletos() {
  const container = document.getElementById('boletosContainer');
  container.innerHTML = '<div class="loader"><div class="spinner"></div><p>Cargando tus boletos...</p></div>';
  try {
    const boletos = await API.getMisBoletos();
    if (!boletos || boletos.length === 0) {
      container.innerHTML = '<p style="text-align:center;">🪐 No has comprado boletos aún. <a href="/eventos.html">Explorar eventos</a></p>';
      return;
    }
    let html = '<div class="boletos-list">';
    boletos.forEach(b => {
      const fecha = new Date(b.fecha_evento).toLocaleDateString();
      let cardStyle = 'background: var(--bg-card);';
      if (b.imagen_url) {
        cardStyle = `background-image: url('${b.imagen_url}'); background-size: cover; background-position: center; position: relative;`;
      }
      html += `
        <div class="boleto-card" style="${cardStyle} border-left: 5px solid var(--red-main); padding: 1.2rem; margin-bottom: 1.2rem; border-radius: 0.8rem; box-shadow: 0 2px 10px rgba(0,0,0,0.3); ${b.imagen_url ? 'color: white; text-shadow: 0 0 10px rgba(0,0,0,0.8);' : ''}">
          ${b.imagen_url ? `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10,10,10,0.6); border-radius: 0.8rem; z-index: 0;"></div>` : ''}
          <div style="position: relative; z-index: 1;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
              <div>
                <h3 style="color: var(--red-light);">${b.nombre_evento}</h3>
                <p style="color: var(--text-secondary);"><i class="fas fa-map-marker-alt" style="color:var(--red-main);"></i> ${b.ubicacion}</p>
                <p style="color: var(--text-secondary);"><i class="far fa-calendar" style="color:var(--red-main);"></i> ${fecha}</p>
                <p style="color: var(--text-secondary);">🪑 Zona: ${b.zona || 'General'} | Asiento: ${b.asiento || 'Libre'}</p>
                <p style="color: var(--text-secondary);">🎫 Tipo: ${b.tipo_precio === 'preventa' ? 'Preventa' : 'Normal'}</p>
                <p style="color: var(--text-secondary);"><strong>Comprador:</strong> ${b.nombre_usuario}</p>
                <p style="color: var(--text-secondary);"><strong>Precio pagado:</strong> <span style="color:var(--red-light);">$${b.precio_pagado}</span></p>
                <p style="font-size:0.9rem; color:var(--text-muted);">Código: <span class="boleto-codigo" style="color:var(--red-main); font-family:monospace;">${b.codigo_unico}</span></p>
              </div>
              <div style="text-align:center;">
                ${b.qr_codigo ? `<img src="${b.qr_codigo}" alt="QR" style="width:100px; height:100px; border:2px solid var(--red-main); border-radius:0.8rem; padding:0.2rem; background:white;">` : ''}
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">Escanea para acceder</div>
              </div>
            </div>
            <div style="margin-top:0.8rem; padding-top:0.8rem; border-top:1px dashed var(--red-main); text-align:center; font-size:0.7rem; color:var(--text-muted);">
              Presenta este boleto en la entrada del evento
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    if (err.message && err.message.includes('401')) {
      window.location.href = '/login.html?redirect=mis-boletos';
    } else {
      showToast('Error al cargar tus boletos', 'error');
      container.innerHTML = `<p style="text-align:center; color:var(--red-light);">❌ Error: ${err.message}</p>`;
    }
  }
}

loadUser();
if (typeof createStarField === 'function') createStarField();