let currentUser = null;
let eventosCache = [];

// ========== VERIFICAR ADMIN ==========
async function checkAdmin() {
  try {
    const res = await Auth.getCurrentUser();
    if (res && res.user) {
      currentUser = res.user;
      const userNameEl = document.getElementById('userName');
      if (userNameEl) userNameEl.innerText = currentUser.nombre.split(' ')[0];
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
      
      if (!currentUser.isAdmin) {
        window.location.href = '/admin-login.html';
        return;
      }
      cargarListaEventos();
      cargarEstadisticas();
    } else {
      window.location.href = '/admin-login.html';
    }
  } catch (error) {
    console.error('❌ Error en checkAdmin:', error);
    window.location.href = '/admin-login.html';
  }
}

// ========== CARGAR ESTADÍSTICAS ==========
async function cargarEstadisticas() {
  try {
    const eventos = await API.getEventos();
    document.getElementById('totalEventos').innerText = eventos.length;
    let totalVendidos = 0;
    for (const e of eventos) {
      try {
        const stats = await API.request(`/eventos/${e.id_evento}/stats`);
        totalVendidos += stats.vendidos || 0;
      } catch(e) {}
    }
    document.getElementById('totalBoletosVendidos').innerText = totalVendidos;
  } catch(e) {
    console.error('Error cargando estadísticas:', e);
  }
}

// ========== CARGAR LISTA DE EVENTOS ==========
async function cargarListaEventos() {
  const container = document.getElementById('dynamicPanel');
  container.innerHTML = '<div class="spinner"></div><p>Cargando eventos...</p>';
  try {
    const eventos = await API.getEventos();
    eventosCache = eventos;
    if (!eventos || eventos.length === 0) {
      container.innerHTML = '<p style="text-align:center;">No hay eventos registrados.</p>';
      return;
    }
    let html = '<div class="event-list">';
    for (const e of eventos) {
      const fecha = new Date(e.fecha_evento).toLocaleDateString();
      let stats = { capacidad: e.capacidad_total, disponibles: e.boletos_disponibles, vendidos: 0 };
      try {
        const res = await API.request(`/eventos/${e.id_evento}/stats`);
        stats = res;
      } catch(err) {}
      const porcentaje = stats.capacidad > 0 ? Math.round((stats.vendidos / stats.capacidad) * 100) : 0;
      
      // ===== MOSTRAR IMAGEN DESDE BD =====
      const imagenHtml = e.imagen_url ? 
        `<img src="${e.imagen_url}" alt="${e.nombre_evento}" style="width:100%; height:150px; object-fit:cover; border-radius:8px; margin-bottom:10px;">` : 
        '<div style="width:100%; height:150px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; border-radius:8px; margin-bottom:10px;"><i class="fas fa-image" style="color:#666; font-size:3rem;"></i></div>';
      
      html += `
        <div class="event-card" data-id="${e.id_evento}" style="background: var(--bg-card); padding: 1rem; border-radius: 1rem; margin-bottom: 1rem; border: 1px solid var(--border-color);">
          ${imagenHtml}
          <div>
            <strong style="color: var(--red-light);">${e.nombre_evento}</strong><br>
            📍 ${e.ubicacion} | 📅 ${fecha} ${e.hora_evento ? e.hora_evento.substring(0,5) : ''}<br>
            🎟️ Capacidad: ${stats.capacidad} | Disponibles: ${stats.disponibles} | Vendidos: ${stats.vendidos}<br>
            <div style="background:#2D2D2D; height:8px; width:100%; border-radius:4px; margin-top:4px;">
              <div style="background: linear-gradient(90deg, #ff0000, #ff3333); height:8px; width:${porcentaje}%; border-radius:4px;"></div>
            </div>
            <span style="font-size:0.8rem; color:var(--text-secondary);">${porcentaje}% ocupado</span>
            ${e.es_preventa ? `| <span style="color:var(--red-light);">🔥 Preventa</span>` : ''}
            ${e.preventa_inicio && e.preventa_fin ? `<br><span style="font-size:0.7rem; color:var(--text-muted);">Preventa: ${new Date(e.preventa_inicio).toLocaleDateString()} - ${new Date(e.preventa_fin).toLocaleDateString()}</span>` : ''}
          </div>
          <div style="display:flex; gap:0.5rem; margin-top:0.8rem;">
            <button class="btn-eliminar" data-id="${e.id_evento}" style="background:#cc0000; color:white; border:none; padding:0.3rem 0.8rem; border-radius:0.5rem; cursor:pointer;">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    }
    html += '</div>';
    container.innerHTML = html;

    document.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const evento = eventosCache.find(e => e.id_evento == id);
        if (!evento) return;
        const confirmado = await showConfirm(`¿Eliminar el evento "${evento.nombre_evento}"? Esta acción no se puede deshacer.`, 'Eliminar Evento');
        if (confirmado) {
          try {
            await API.request(`/eventos/${id}`, { method: 'DELETE' });
            showToast('✅ Evento eliminado correctamente', 'success');
            cargarListaEventos();
            cargarEstadisticas();
          } catch (err) {
            showToast('❌ Error al eliminar: ' + err.message, 'error');
          }
        }
      };
    });
  } catch(err) {
    console.error('Error en cargarListaEventos:', err);
    container.innerHTML = '<p>Error al cargar eventos.</p>';
  }
}

// ========== MOSTRAR FORMULARIO CREAR EVENTO ==========
function mostrarFormCrear() {
  const container = document.getElementById('dynamicPanel');
  container.innerHTML = `
    <div style="max-width:600px; margin:0 auto;">
      <h2 style="color:var(--red-light); font-family:'Orbitron',sans-serif;">Crear Nuevo Evento</h2>
      <form id="createEventForm" class="form-evento" enctype="multipart/form-data">
        <input type="text" id="nombre" placeholder="Nombre del evento" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box; margin-bottom:0.8rem;">
        <input type="text" id="ubicacion" placeholder="Ubicación" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box; margin-bottom:0.8rem;">
        <input type="date" id="fecha" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box; margin-bottom:0.8rem;">
        <input type="time" id="hora" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box; margin-bottom:0.8rem;">
        <input type="number" id="capacidad" placeholder="Capacidad total" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box; margin-bottom:0.8rem;">
        <input type="number" id="precioNormal" step="0.01" placeholder="Precio normal" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box; margin-bottom:0.8rem;">
        <input type="number" id="precioPreventa" step="0.01" placeholder="Precio preventa (opcional)" style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box; margin-bottom:0.8rem;">
        <label style="color:var(--text-secondary); display:flex; align-items:center; gap:0.5rem; margin-bottom:0.8rem;">
          <input type="checkbox" id="esPreventa"> Activar preventa
        </label>
        <div id="preventaFechas" style="display:none; margin:0.5rem 0;">
          <label style="color:var(--text-secondary); display:block; margin-bottom:0.3rem;">Inicio de preventa</label>
          <input type="datetime-local" id="preventaInicio" style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box; margin-bottom:0.8rem;">
          <label style="color:var(--text-secondary); display:block; margin:0.5rem 0 0.3rem 0;">Fin de preventa</label>
          <input type="datetime-local" id="preventaFin" style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box; margin-bottom:0.8rem;">
        </div>
        <div style="margin-top:0.5rem;">
          <label style="color:var(--red-light); display:block; margin-bottom:0.3rem;">Imagen del evento (se guarda en la base de datos)</label>
          <input type="file" id="imagenEvento" accept="image/*" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px dashed #ff0000; border-radius:0.8rem; color:white; cursor:pointer;">
          <img id="previewImg" class="preview-img" style="display:none; max-width:100%; margin-top:0.5rem; border-radius:0.8rem; max-height:200px; object-fit:cover;">
        </div>
        <button type="submit" class="btn-neon" style="margin-top:1rem; width:100%; padding:0.8rem; background:linear-gradient(135deg, #cc0000, #ff0000); border:none; border-radius:2rem; font-weight:bold; font-size:1.1rem; color:white; cursor:pointer;">Crear Evento</button>
      </form>
    </div>
  `;

  document.getElementById('esPreventa').onchange = function() {
    document.getElementById('preventaFechas').style.display = this.checked ? 'block' : 'none';
  };

  document.getElementById('imagenEvento').onchange = function(e) {
    const preview = document.getElementById('previewImg');
    if (this.files && this.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        preview.src = ev.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(this.files[0]);
    }
  };

  const form = document.getElementById('createEventForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('nombre_evento', document.getElementById('nombre').value);
    formData.append('ubicacion', document.getElementById('ubicacion').value);
    formData.append('fecha_evento', document.getElementById('fecha').value);
    formData.append('hora_evento', document.getElementById('hora').value);
    formData.append('capacidad_total', document.getElementById('capacidad').value);
    formData.append('precio_normal', document.getElementById('precioNormal').value);
    formData.append('precio_preventa', document.getElementById('precioPreventa').value || '');
    const esPreventa = document.getElementById('esPreventa').checked;
    formData.append('es_preventa', esPreventa);
    if (esPreventa) {
      formData.append('preventa_inicio', document.getElementById('preventaInicio').value || '');
      formData.append('preventa_fin', document.getElementById('preventaFin').value || '');
    }
    const imagenFile = document.getElementById('imagenEvento').files[0];
    if (imagenFile) formData.append('imagen', imagenFile);

    try {
      const res = await fetch('/api/eventos', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        showToast('✅ Evento creado exitosamente', 'success');
        cargarListaEventos();
        cargarEstadisticas();
        document.getElementById('btnListar').click();
      } else {
        showToast('❌ Error: ' + (data.error || 'Error desconocido'), 'error');
      }
    } catch (err) {
      console.error('Error de conexión:', err);
      showToast('❌ Error de conexión: ' + err.message, 'error');
    }
  };
}

// ========== EVENTOS DEL DOM ==========
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btnCrear').onclick = mostrarFormCrear;
  document.getElementById('btnListar').onclick = cargarListaEventos;
  document.getElementById('logoutBtn').onclick = async () => {
    await Auth.logout();
    window.location.href = '/';
  };
  if (typeof createStarField === 'function') createStarField();
  checkAdmin();
});