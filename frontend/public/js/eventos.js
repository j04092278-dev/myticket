let currentUser = null;
let countdownIntervals = [];

// ========== CARGA DE USUARIO ==========
async function loadUser() {
  try {
    const res = await Auth.getCurrentUser();
    if (res && res.user) {
      currentUser = res.user;
      const userNameEl = document.getElementById('userName');
      if (userNameEl) userNameEl.innerText = currentUser.nombre.split(' ')[0];
      const loginBtn = document.getElementById('loginBtn');
      const logoutBtn = document.getElementById('logoutBtn');
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
      const loginBtn = document.getElementById('loginBtn');
      const logoutBtn = document.getElementById('logoutBtn');
      const userNameEl = document.getElementById('userName');
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (userNameEl) userNameEl.innerText = 'Invitado';
      currentUser = null;
    }
  } catch(e) {
    console.error('Error en loadUser:', e);
    currentUser = null;
  }
}

document.getElementById('logoutBtn').onclick = async () => {
  await Auth.logout();
  currentUser = null;
  window.location.href = '/';
};

// ========== VERIFICACIÓN DE INE ==========
async function verificarINE() {
  try {
    const res = await API.request('/ine/estado');
    return res.validado === true && res.facial_verificado === true;
  } catch(e) {
    return false;
  }
}

// ========== CUENTA REGRESIVA ==========
function getTimeRemaining(targetDate) {
  const now = new Date().getTime();
  const target = new Date(targetDate).getTime();
  const diff = target - now;
  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { expired: false, days, hours, minutes, seconds };
}

function iniciarCuentasRegresivas() {
  countdownIntervals.forEach(interval => clearInterval(interval));
  countdownIntervals = [];
  document.querySelectorAll('.evento-card').forEach(card => {
    const eventDate = card.dataset.eventDate;
    if (!eventDate) return;
    const container = card.querySelector('.countdown-container');
    if (!container) return;
    const eventDateObj = new Date(eventDate);
    const isPreventa = card.dataset.isPreventa === 'true';
    let inicioPreventa, finPreventa;
    if (card.dataset.preventaInicio && card.dataset.preventaFin) {
      inicioPreventa = new Date(card.dataset.preventaInicio);
      finPreventa = new Date(card.dataset.preventaFin);
    } else {
      inicioPreventa = new Date(eventDateObj.getTime() - 30 * 24 * 60 * 60 * 1000);
      finPreventa = new Date(eventDateObj.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    const actualizarPrecio = (precio) => {
      const precioEl = card.querySelector('.precio');
      if (precioEl) precioEl.textContent = `$${precio}`;
    };
    const update = () => {
      const now = new Date();
      let targetDate = null;
      let mensaje = '';
      let precioMostrado = null;
      if (now >= eventDateObj) {
        container.innerHTML = `<div style="text-align:center; color:#ff6666; font-weight:bold; font-size:0.9rem;">⏰ Evento finalizado</div>`;
        return;
      }
      if (isPreventa) {
        if (now < inicioPreventa) {
          targetDate = inicioPreventa;
          mensaje = '🚀 La preventa comienza en:';
          precioMostrado = parseFloat(card.dataset.precioPreventa || card.dataset.precio);
        } else if (now >= inicioPreventa && now < finPreventa) {
          targetDate = finPreventa;
          mensaje = '🔥 La preventa termina en:';
          precioMostrado = parseFloat(card.dataset.precioPreventa || card.dataset.precio);
        } else {
          targetDate = eventDateObj;
          mensaje = '🎫 Venta normal:';
          precioMostrado = parseFloat(card.dataset.precio);
        }
      } else {
        targetDate = eventDateObj;
        mensaje = '🎫 Tiempo para el evento:';
        precioMostrado = parseFloat(card.dataset.precio);
      }
      if (precioMostrado !== null) actualizarPrecio(precioMostrado.toFixed(2));
      const remaining = getTimeRemaining(targetDate);
      if (remaining.expired) {
        container.innerHTML = `<div style="text-align:center; color:#ff6666;">⏰ Tiempo agotado</div>`;
        return;
      }
      const html = `
        <div style="text-align:center; font-size:0.8rem; color:#aaa; margin-bottom:0.3rem;">${mensaje}</div>
        <div style="display:flex; gap:0.5rem; justify-content:center;">
          <div style="text-align:center; background:rgba(255,0,0,0.15); padding:0.3rem 0.5rem; border-radius:0.5rem; min-width:45px;">
            <div style="font-size:1.2rem; font-weight:bold; color:#ff3333;">${String(remaining.days).padStart(2, '0')}</div>
            <div style="font-size:0.5rem; color:#aaa;">días</div>
          </div>
          <div style="text-align:center; background:rgba(255,0,0,0.15); padding:0.3rem 0.5rem; border-radius:0.5rem; min-width:45px;">
            <div style="font-size:1.2rem; font-weight:bold; color:#ff3333;">${String(remaining.hours).padStart(2, '0')}</div>
            <div style="font-size:0.5rem; color:#aaa;">horas</div>
          </div>
          <div style="text-align:center; background:rgba(255,0,0,0.15); padding:0.3rem 0.5rem; border-radius:0.5rem; min-width:45px;">
            <div style="font-size:1.2rem; font-weight:bold; color:#ff3333;">${String(remaining.minutes).padStart(2, '0')}</div>
            <div style="font-size:0.5rem; color:#aaa;">min</div>
          </div>
          <div style="text-align:center; background:rgba(255,0,0,0.15); padding:0.3rem 0.5rem; border-radius:0.5rem; min-width:45px;">
            <div style="font-size:1.2rem; font-weight:bold; color:#ff3333;">${String(remaining.seconds).padStart(2, '0')}</div>
            <div style="font-size:0.5rem; color:#aaa;">seg</div>
          </div>
        </div>
        <div style="text-align:center; margin-top:0.3rem; font-size:0.8rem; color:var(--red-light); font-weight:bold;">
          $${precioMostrado.toFixed(2)}
        </div>
      `;
      container.innerHTML = html;
    };
    update();
    const interval = setInterval(update, 1000);
    countdownIntervals.push(interval);
  });
}

// ========== MODAL COMPRA ==========
function mostrarModalCompra(eventoId, esPreventa, eventoNombre, precioUnitario) {
  const modal = document.createElement('div');
  modal.id = 'compraModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(10px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10001;
    padding: 20px;
  `;
  modal.innerHTML = `
    <div style="background: linear-gradient(145deg, rgba(10,20,45,0.95), rgba(26,11,46,0.95)); border-radius: 2rem; padding: 2rem; max-width: 420px; width: 100%; border: 2px solid #ff0000; box-shadow: 0 0 40px rgba(255,0,0,0.3);">
      <h2 style="color: #ff3333; text-align: center; margin-bottom: 0.5rem;">🎫 Comprar Boleto</h2>
      <p style="color: var(--text-secondary); text-align: center; margin-bottom: 1.5rem;">
        <strong style="color: var(--red-light);">${eventoNombre}</strong><br>
        <span style="font-size: 0.9rem;">Precio unitario: <strong style="color: var(--red-main);">$${precioUnitario.toFixed(2)}</strong></span>
      </p>
      <div style="margin-bottom: 1rem;">
        <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">Cantidad de boletos</label>
        <input type="number" id="cantidadInput" value="1" min="1" max="10" style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box;">
      </div>
      <div style="margin-bottom: 1.5rem;">
        <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">Zona</label>
        <select id="zonaSelect" style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box;">
          <option value="General">General</option>
          <option value="VIP">VIP</option>
          <option value="Platea">Platea</option>
          <option value="Palco">Palco</option>
        </select>
      </div>
      <div style="display: flex; gap: 1rem;">
        <button id="continuarCompra" style="flex:2; background:linear-gradient(135deg, #cc0000, #ff0000); border:none; padding:0.8rem; border-radius:2rem; font-weight:bold; font-size:1rem; color:white; cursor:pointer; box-shadow:0 0 20px rgba(255,0,0,0.3); transition:0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          ✅ Continuar
        </button>
        <button id="cancelarCompra" style="flex:1; background:rgba(255,255,255,0.1); border:1px solid #ff6666; padding:0.8rem; border-radius:2rem; font-weight:bold; color:#ff6666; cursor:pointer;">
          ✕ Cancelar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cancelarCompra').onclick = () => modal.remove();
  document.getElementById('continuarCompra').onclick = async () => {
    const cantidad = parseInt(document.getElementById('cantidadInput').value);
    const zona = document.getElementById('zonaSelect').value;
    if (!cantidad || cantidad < 1) {
      showToast('Ingresa una cantidad válida', 'warning');
      return;
    }
    modal.remove();
    await procederConCompra(eventoId, esPreventa, eventoNombre, precioUnitario, cantidad, zona, '');
  };
}

// ========== PROCEDER CON COMPRA ==========
async function procederConCompra(eventoId, esPreventa, eventoNombre, precioUnitario, cantidad, zona, asiento) {
  if (!currentUser) {
    showToast('Inicia sesión para comprar', 'warning');
    window.location.href = '/login.html';
    return;
  }
  let tipoPrecio = 'normal';
  if (esPreventa) {
    const card = document.querySelector(`.evento-card[data-event-id="${eventoId}"]`);
    if (card) {
      const eventDate = new Date(card.dataset.eventDate);
      const ahora = new Date();
      const inicioPreventa = card.dataset.preventaInicio ? new Date(card.dataset.preventaInicio) : new Date(eventDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const finPreventa = card.dataset.preventaFin ? new Date(card.dataset.preventaFin) : new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (ahora >= inicioPreventa && ahora < finPreventa) {
        tipoPrecio = 'preventa';
      }
    }
  }
  const ineValidado = await verificarINE();
  if (!ineValidado) {
    mostrarModalValidacionINE(async (validado) => {
      if (validado) {
        mostrarModalPago(eventoId, esPreventa, tipoPrecio, cantidad, zona, asiento, eventoNombre, precioUnitario);
      }
    });
    return;
  }
  mostrarModalPago(eventoId, esPreventa, tipoPrecio, cantidad, zona, asiento, eventoNombre, precioUnitario);
}

// ========== VALIDACIÓN DE INE ==========
function mostrarModalValidacionINE(callback) {
  // ... (código completo ya dado anteriormente)
  // Mantén la misma función que ya tienes, pero asegura que `sexo` se envíe correctamente
}

// ========== MODAL PAGO ==========
function mostrarModalPago(eventoId, esPreventa, tipoPrecio, cantidad, zona, asiento, eventoNombre, precioUnitario) {
  // ... (código completo ya dado anteriormente)
}

// ========== MODAL BOLETO ==========
function mostrarBoletoModal(boletoHTML, urlDescarga) {
  // ... (código completo ya dado anteriormente)
}

// ========== INICIAR COMPRA ==========
async function iniciarCompra(eventoId, esPreventa, eventoNombre, precioUnitario) {
  if (!currentUser) {
    showToast('Inicia sesión para comprar', 'warning');
    window.location.href = '/login.html';
    return;
  }
  mostrarModalCompra(eventoId, esPreventa, eventoNombre, precioUnitario);
}

// ========== CARGAR EVENTOS (CORREGIDO - imágenes y sesión) ==========
async function cargarEventos() {
  const container = document.getElementById('eventosContainer');
  container.innerHTML = '<div class="loader"><div class="spinner"></div><p>Cargando eventos...</p></div>';
  try {
    const eventos = await API.getEventos();
    if (!eventos || eventos.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">✨ No hay eventos disponibles.</p>';
      return;
    }
    let html = '<div class="eventos-grid">';
    eventos.forEach(e => {
      const fecha = new Date(e.fecha_evento).toLocaleDateString();
      const precioNormal = e.precio_normal;
      const precioPreventa = e.precio_preventa || e.precio_normal;
      const badge = e.es_preventa ? '<span class="badge-preventa">PREVENTA</span>' : '';

      // ===== IMAGEN DEL EVENTO =====
      let imagenHtml = '';
      if (e.imagen_url && e.tiene_imagen) {
        imagenHtml = `<img src="${e.imagen_url}" style="width:100%; height:180px; object-fit:cover; border-radius:8px 8px 0 0;" alt="${e.nombre_evento}">`;
      } else {
        imagenHtml = `<div style="width:100%; height:180px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; border-radius:8px 8px 0 0; border-bottom:2px solid rgba(255,0,0,0.3);">
          <i class="fas fa-image" style="color:#666; font-size:3rem; opacity:0.5;"></i>
        </div>`;
      }

      html += `
        <div class="evento-card" data-event-id="${e.id_evento}" data-event-date="${e.fecha_evento}" data-is-preventa="${e.es_preventa}" data-precio="${precioNormal}" data-precio-preventa="${precioPreventa}" data-preventa-inicio="${e.preventa_inicio || ''}" data-preventa-fin="${e.preventa_fin || ''}">
          ${imagenHtml}
          <div class="evento-info" style="padding: 1rem;">
            <h3 class="evento-titulo" style="font-family:'Orbitron',sans-serif; color:var(--red-light);">${e.nombre_evento} ${badge}</h3>
            <p style="color:var(--text-secondary); margin:0.3rem 0;"><i class="fas fa-map-marker-alt" style="color:var(--red-main);"></i> ${e.ubicacion}</p>
            <p style="color:var(--text-secondary); margin:0.3rem 0;"><i class="far fa-calendar" style="color:var(--red-main);"></i> ${fecha} - ${e.hora_evento.substring(0,5)}</p>
            <div class="precio" style="font-size:1.2rem; font-weight:bold; color:var(--red-light); margin:0.5rem 0;">$${precioNormal}</div>
            <div class="countdown-container" style="margin: 0.8rem 0; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 0.8rem;">
              <div style="text-align:center; font-size:0.8rem; color:#aaa; margin-bottom:0.3rem;">⏳ Cargando...</div>
              <div id="countdown-${e.id_evento}" style="text-align:center; font-size:1rem; font-weight:bold; color:#ff3333;">Cargando...</div>
            </div>
            <button class="btn-comprar" data-id="${e.id_evento}" data-preventa="${e.es_preventa}" data-nombre="${e.nombre_evento}" data-precio="${precioNormal}" data-precio-preventa="${precioPreventa}" style="width:100%; padding:0.8rem; background:linear-gradient(135deg, #cc0000, #ff0000); color:white; border:none; border-radius:2rem; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
              Comprar Boleto
            </button>
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
    iniciarCuentasRegresivas();
    document.querySelectorAll('.btn-comprar').forEach(btn => {
      btn.onclick = () => {
        const eventoId = btn.dataset.id;
        const esPreventa = btn.dataset.preventa === 'true';
        const eventoNombre = btn.dataset.nombre;
        const precioNormal = parseFloat(btn.dataset.precio);
        const precioPreventa = parseFloat(btn.dataset.precioPreventa);
        let precioUnitario = precioNormal;
        const card = document.querySelector(`.evento-card[data-event-id="${eventoId}"]`);
        if (card && esPreventa) {
          const eventDate = new Date(card.dataset.eventDate);
          const ahora = new Date();
          const inicioPreventa = card.dataset.preventaInicio ? new Date(card.dataset.preventaInicio) : new Date(eventDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          const finPreventa = card.dataset.preventaFin ? new Date(card.dataset.preventaFin) : new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (ahora >= inicioPreventa && ahora < finPreventa) {
            precioUnitario = precioPreventa;
          }
        }
        iniciarCompra(eventoId, esPreventa, eventoNombre, precioUnitario);
      };
    });
  } catch (err) {
    console.error('❌ Error cargando eventos:', err);
    showToast('Error al cargar eventos: ' + err.message, 'error');
    container.innerHTML = `<p style="text-align:center; color:var(--red-light);">❌ Error al cargar eventos: ${err.message}</p>`;
  }
}

// ========== INICIALIZACIÓN ==========
loadUser();
cargarEventos();
if (typeof createStarField === 'function') createStarField();