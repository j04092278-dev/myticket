let currentUser = null;
let eventosCache = [];

async function checkAdmin() {
  try {
    if (typeof Auth === 'undefined') {
      showToast('❌ Error: Auth no definido', 'error');
      return;
    }
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

async function cargarListaEventos() {
  const container = document.getElementById('dynamicPanel');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div><p>Cargando eventos...</p>';
  try {
    const eventos = await API.getEventos();
    eventosCache = eventos;
    if (!eventos || eventos.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No hay eventos registrados.</p>';
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
      
      // ===== CORRECCIÓN: Mostrar imagen desde BD correctamente =====
      let imagenMiniatura = '';
      if (e.imagen_url) {
        imagenMiniatura = `<img src="${e.imagen_url}" alt="${e.nombre_evento}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;">`;
      } else if (e.tiene_imagen) {
        imagenMiniatura = `<img src="/api/eventos/imagen/${e.id_evento}" alt="${e.nombre_evento}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;">`;
      } else {
        imagenMiniatura = `<div style="width:60px; height:60px; background:rgba(255,255,255,0.1); border-radius:8px; display:flex; align-items:center; justify-content:center;"><i class="fas fa-image" style="color:#666; font-size:1.5rem;"></i></div>`;
      }

      html += `
        <div class="event-card" data-id="${e.id_evento}" style="display:flex; align-items:center; gap:1rem; padding:1rem; background:var(--bg-card); border-radius:1rem; margin-bottom:0.8rem; border:1px solid var(--border-color);">
          ${imagenMiniatura}
          <div style="flex:1;">
            <strong style="color:var(--red-light);">${e.nombre_evento}</strong><br>
            📍 ${e.ubicacion} | 📅 ${fecha} ${e.hora_evento ? e.hora_evento.substring(0,5) : ''}<br>
            🎟️ Capacidad: ${stats.capacidad} | Disponibles: ${stats.disponibles} | Vendidos: ${stats.vendidos}<br>
            <div style="background:#2D2D2D; height:8px; width:100%; border-radius:4px; margin-top:4px;">
              <div style="background: linear-gradient(90deg, #ff0000, #ff3333); height:8px; width:${porcentaje}%; border-radius:4px;"></div>
            </div>
            <span style="font-size:0.8rem; color:var(--text-secondary);">${porcentaje}% ocupado</span>
            ${e.es_preventa ? `| <span style="color:var(--red-light);">🔥 Preventa</span>` : ''}
            ${e.preventa_inicio && e.preventa_fin ? `<br><span style="font-size:0.7rem; color:var(--text-muted);">Preventa: ${new Date(e.preventa_inicio).toLocaleDateString()} - ${new Date(e.preventa_fin).toLocaleDateString()}</span>` : ''}
          </div>
          <button class="btn-eliminar" data-id="${e.id_evento}" style="background:#cc0000; color:white; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer; font-weight:bold;">🗑️ Eliminar</button>
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
    console.error('❌ Error en cargarListaEventos:', err);
    showToast('Error al cargar eventos: ' + err.message, 'error');
    container.innerHTML = `<p style="text-align:center; color:var(--red-light);">❌ Error al cargar eventos: ${err.message}</p>`;
  }
}

function mostrarFormCrear() {
  const container = document.getElementById('dynamicPanel');
  if (!container) return;
  container.innerHTML = `
    <div style="max-width:600px; margin:0 auto;">
      <h2 style="color:var(--red-light); font-family:'Orbitron',sans-serif;">Crear Nuevo Evento</h2>
      <form id="createEventForm" class="form-evento" enctype="multipart/form-data">
        <input type="text" id="nombre" placeholder="Nombre del evento" required>
        <input type="text" id="ubicacion" placeholder="Ubicación" required>
        <input type="date" id="fecha" required>
        <input type="time" id="hora" required>
        <input type="number" id="capacidad" placeholder="Capacidad total" required>
        <input type="number" id="precioNormal" step="0.01" placeholder="Precio normal" required>
        <input type="number" id="precioPreventa" step="0.01" placeholder="Precio preventa (opcional)">
        <label style="color:var(--text-secondary); display:flex; align-items:center; gap:0.5rem;">
          <input type="checkbox" id="esPreventa"> Activar preventa
        </label>
        <div id="preventaFechas" style="display:none; margin:0.5rem 0;">
          <label style="color:var(--text-secondary); display:block; margin-bottom:0.3rem;">Inicio de preventa</label>
          <input type="datetime-local" id="preventaInicio">
          <label style="color:var(--text-secondary); display:block; margin:0.5rem 0 0.3rem 0;">Fin de preventa</label>
          <input type="datetime-local" id="preventaFin">
        </div>
        <div style="margin-top:0.5rem;">
          <label style="color:var(--red-light); display:block; margin-bottom:0.3rem;">Imagen del evento</label>
          <input type="file" id="imagenEvento" accept="image/*">
          <img id="previewImg" class="preview-img" style="display:none; max-width:100%; margin-top:0.5rem; border-radius:8px;">
        </div>
        <button type="submit" class="btn-neon" style="margin-top:1rem;">Crear Evento</button>
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
      if (res.ok && data.success) {
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