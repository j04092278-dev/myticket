let currentUser = null;
let eventosCache = [];

// ========== VERIFICAR ADMIN ==========
async function checkAdmin() {
  try {
    console.log('🔍 Verificando autenticación de admin...');
    const res = await Auth.getCurrentUser();
    console.log('📥 Respuesta getCurrentUser:', res);
    
    if (res && res.user) {
      currentUser = res.user;
      const userNameEl = document.getElementById('userName');
      if (userNameEl) userNameEl.innerText = currentUser.nombre.split(' ')[0];
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
      
      console.log('👤 Usuario autenticado:', currentUser.email, 'esAdmin:', currentUser.isAdmin);
      
      if (!currentUser.isAdmin) {
        console.warn('⚠️ Usuario no es administrador, redirigiendo...');
        window.location.href = '/admin-login.html';
        return;
      }
      
      // Si es admin, cargar datos
      console.log('✅ Admin verificado, cargando panel...');
      cargarListaEventos();
      cargarEstadisticas();
    } else {
      console.warn('⚠️ No autenticado, redirigiendo a login');
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

// ========== MOSTRAR FORMULARIO CREAR EVENTO ==========
function mostrarFormCrear() {
  const container = document.getElementById('dynamicPanel');
  container.innerHTML = `
    <div style="max-width:600px; margin:0 auto;">
      <h2 style="color:var(--red-light); font-family:'Orbitron',sans-serif;">Crear Nuevo Evento</h2>
      <form id="createEventForm" enctype="multipart/form-data">
        <input type="text" id="nombre" placeholder="Nombre del evento" required style="width:100%; padding:0.8rem; margin-bottom:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:0.8rem; color:white; box-sizing:border-box;">
        <input type="text" id="ubicacion" placeholder="Ubicación" required style="width:100%; padding:0.8rem; margin-bottom:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:0.8rem; color:white; box-sizing:border-box;">
        <input type="date" id="fecha" required style="width:100%; padding:0.8rem; margin-bottom:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:0.8rem; color:white; box-sizing:border-box;">
        <input type="time" id="hora" required style="width:100%; padding:0.8rem; margin-bottom:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:0.8rem; color:white; box-sizing:border-box;">
        <input type="number" id="capacidad" placeholder="Capacidad total" required style="width:100%; padding:0.8rem; margin-bottom:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:0.8rem; color:white; box-sizing:border-box;">
        <input type="number" id="precioNormal" step="0.01" placeholder="Precio normal" required style="width:100%; padding:0.8rem; margin-bottom:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:0.8rem; color:white; box-sizing:border-box;">
        <input type="number" id="precioPreventa" step="0.01" placeholder="Precio preventa (opcional)" style="width:100%; padding:0.8rem; margin-bottom:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:0.8rem; color:white; box-sizing:border-box;">
        <label style="color:var(--text-secondary); display:flex; align-items:center; gap:0.5rem; margin:0.5rem 0;">
          <input type="checkbox" id="esPreventa"> Activar preventa
        </label>
        <div id="preventaFechas" style="display:none; margin:0.5rem 0;">
          <label style="color:var(--text-secondary); display:block; margin-bottom:0.3rem;">Inicio de preventa</label>
          <input type="datetime-local" id="preventaInicio" style="width:100%; padding:0.8rem; margin-bottom:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:0.8rem; color:white; box-sizing:border-box;">
          <label style="color:var(--text-secondary); display:block; margin:0.5rem 0 0.3rem 0;">Fin de preventa</label>
          <input type="datetime-local" id="preventaFin" style="width:100%; padding:0.8rem; margin-bottom:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:0.8rem; color:white; box-sizing:border-box;">
        </div>
        <div style="margin-top:0.5rem;">
          <label style="color:var(--red-light); display:block; margin-bottom:0.3rem;">Imagen del evento</label>
          <input type="file" id="imagenEvento" accept="image/*" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px dashed #ff0000; border-radius:0.8rem; color:white; cursor:pointer;">
          <img id="previewImg" class="preview-img" style="display:none; margin-top:0.5rem; max-width:200px; border-radius:0.8rem;">
        </div>
        <button type="submit" style="margin-top:1rem; width:100%; padding:0.8rem; background:linear-gradient(135deg, #cc0000, #ff0000); color:white; border:none; border-radius:2rem; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          Crear Evento
        </button>
      </form>
      <button id="btnVolver" style="margin-top:1rem; width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); color:white; border:1px solid #666; border-radius:2rem; cursor:pointer;">← Volver</button>
    </div>
  `;

  // Mostrar fechas preventa
  document.getElementById('esPreventa').onchange = function() {
    document.getElementById('preventaFechas').style.display = this.checked ? 'block' : 'none';
  };

  // Previsualizar imagen
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

  // Volver a lista
  document.getElementById('btnVolver').onclick = cargarListaEventos;

  // ===== ENVÍO DEL FORMULARIO CON credentials =====
  document.getElementById('createEventForm').onsubmit = async (e) => {
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
      console.log('📤 Enviando evento...');
      const res = await fetch('/api/eventos', {
        method: 'POST',
        body: formData,
        credentials: 'include'  // <--- ¡IMPORTANTE!
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        showToast('✅ Evento creado exitosamente', 'success');
        cargarListaEventos();
        cargarEstadisticas();
        document.getElementById('btnListar').click();
      } else {
        showToast('❌ Error: ' + (data.error || 'Error desconocido'), 'error');
      }
    } catch (err) {
      console.error('❌ Error al crear evento:', err);
      showToast('❌ Error al crear evento: ' + err.message, 'error');
    }
  };
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔄 Inicializando panel de administración...');
  
  document.getElementById('btnCrear').onclick = mostrarFormCrear;
  document.getElementById('btnListar').onclick = cargarListaEventos;
  
  document.getElementById('logoutBtn').onclick = async () => {
    await Auth.logout();
    window.location.href = '/';
  };
  
  if (typeof createStarField === 'function') createStarField();
  
  // Verificar admin
  checkAdmin();
});