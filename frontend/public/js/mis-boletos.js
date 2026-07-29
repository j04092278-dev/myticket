let currentUser = null;

async function loadUser() {
  try {
    console.log('🔄 Cargando usuario desde Mis Boletos...');
    const res = await Auth.getCurrentUser();
    console.log('📥 Respuesta de getCurrentUser:', res);
    
    if (res && res.user) {
      currentUser = res.user;
      const userNameEl = document.getElementById('userName');
      if (userNameEl) userNameEl.innerText = currentUser.nombre.split(' ')[0];
      const loginBtn = document.getElementById('loginBtn');
      const logoutBtn = document.getElementById('logoutBtn');
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
      console.log('✅ Usuario autenticado en Mis Boletos:', currentUser.email);

      await verificarPagoExitoso();
      cargarBoletos();
    } else {
      console.log('⚠️ Usuario no autenticado en Mis Boletos, redirigiendo a login');
      window.location.href = '/login.html?redirect=mis-boletos';
    }
  } catch(e) {
    console.error('❌ Error de autenticación en Mis Boletos:', e);
    window.location.href = '/login.html?redirect=mis-boletos';
  }
}

document.getElementById('logoutBtn').onclick = async () => {
  await Auth.logout();
  currentUser = null;
  window.location.href = '/';
};

async function verificarPagoExitoso() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');

  if (!sessionId) return;

  console.log('🔍 Session ID encontrado:', sessionId);
  showToast('⏳ Procesando tu pago...', 'info', 10000);

  try {
    const res = await fetch('/api/pagos/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
      credentials: 'include'
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast('✅ ¡Pago confirmado! Boleto guardado.', 'success');
      window.history.replaceState({}, document.title, '/mis-boletos');
    } else {
      showToast('❌ Error al confirmar pago: ' + (data.error || 'Error desconocido'), 'error');
      window.history.replaceState({}, document.title, '/mis-boletos');
    }
  } catch (err) {
    console.error('❌ Error al confirmar pago:', err);
    showToast('❌ Error de conexión', 'error');
    window.history.replaceState({}, document.title, '/mis-boletos');
  }
}

async function cargarBoletos() {
  const container = document.getElementById('boletosContainer');
  container.innerHTML = '<div class="loader"><div class="spinner"></div><p>Cargando tus boletos...</p></div>';
  try {
    console.log('🔄 Cargando boletos...');
    const boletos = await API.getMisBoletos();
    console.log('📦 Boletos recibidos:', boletos);
    if (!boletos || boletos.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">🪐 No has comprado boletos aún. <a href="/eventos.html" style="color:var(--red-main);">Explorar eventos</a></p>';
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
                <button onclick="descargarBoleto(${b.id_boleto})" style="margin-top:0.5rem; padding:0.5rem 1.5rem; background:linear-gradient(135deg, #00ff88, #00cc66); color:#0a0f2a; border:none; border-radius:50px; font-weight:bold; cursor:pointer; font-size:0.9rem;">
                  ⬇️ Descargar Boleto
                </button>
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
    console.error('❌ Error cargando boletos:', err);
    if (err.message && err.message.includes('401')) {
      window.location.href = '/login.html?redirect=mis-boletos';
    } else {
      showToast('Error al cargar tus boletos', 'error');
      container.innerHTML = `<p style="text-align:center; color:var(--red-light);">❌ Error: ${err.message}</p>`;
    }
  }
}

async function descargarBoleto(idBoleto) {
  try {
    const res = await fetch(`/api/boletos/${idBoleto}/descargar`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const data = await res.json();
      showToast('❌ Error al descargar: ' + (data.error || 'Error desconocido'), 'error');
      return;
    }
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boleto_${idBoleto}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ Boleto descargado correctamente', 'success');
  } catch (err) {
    console.error('❌ Error en descarga:', err);
    showToast('❌ Error al descargar el boleto', 'error');
  }
}

loadUser();
if (typeof createStarField === 'function') createStarField();