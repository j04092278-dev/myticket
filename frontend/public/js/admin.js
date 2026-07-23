let currentUser = null;
let eventosCache = [];

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

      // Imagen del evento en admin
      let imagenHtml = '';
      if (e.imagen_url && e.tiene_imagen) {
        imagenHtml = `<img src="${e.imagen_url}" style="width:60px; height:60px; object-fit:cover; border-radius:8px; margin-right:1rem;">`;
      } else {
        imagenHtml = `<div style="width:60px; height:60px; background:rgba(255,255,255,0.05); border-radius:8px; display:flex; align-items:center; justify-content:center; margin-right:1rem;">
          <i class="fas fa-image" style="color:#666;"></i>
        </div>`;
      }

      html += `
        <div class="event-card" data-id="${e.id_evento}" style="display:flex; align-items:center; justify-content:space-between; padding:1rem; background:var(--bg-card); border-radius:1rem; margin-bottom:1rem; border-left:4px solid var(--red-main);">
          <div style="display:flex; align-items:center; flex:1;">
            ${imagenHtml}
            <div>
              <strong style="color:var(--red-light);">${e.nombre_evento}</strong><br>
              <span style="color:var(--text-secondary); font-size:0.9rem;">📍 ${e.ubicacion} | 📅 ${fecha} ${e.hora_evento.substring(0,5)}</span><br>
              <span style="color:var(--text-secondary); font-size:0.85rem;">🎟️ Capacidad: ${stats.capacidad} | Disponibles: ${stats.disponibles} | Vendidos: ${stats.vendidos}</span>
              <div style="background:#2D2D2D; height:6px; width:100%; border-radius:4px; margin-top:4px; max-width:200px;">
                <div style="background: linear-gradient(90deg, #ff0000, #ff3333); height:6px; width:${porcentaje}%; border-radius:4px;"></div>
              </div>
              <span style="font-size:0.75rem; color:var(--text-secondary);">${porcentaje}% ocupado</span>
              ${e.es_preventa ? `| <span style="color:var(--red-light);">🔥 Preventa</span>` : ''}
            </div>
          </div>
          <button class="btn-eliminar" data-id="${e.id_evento}" style="background:#cc0000; color:white; border:none; padding:0.5rem 1rem; border-radius:0.8rem; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#ff0000'" onmouseout="this.style.background='#cc0000'">
            🗑️ Eliminar
          </button>
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
    container.innerHTML = `<p style="text-align:center; color:var(--red-light);">❌ Error al cargar eventos: ${err.message}</p>`;
  }
}

function mostrarFormCrear() {
  // ... (código completo ya dado anteriormente)
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