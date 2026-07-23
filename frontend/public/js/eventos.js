let currentUser = null;
let countdownIntervals = [];

// ========== CARGA DE USUARIO ==========
async function loadUser() {
  try {
    const res = await Auth.getCurrentUser();
    if (res && res.user) {
      currentUser = res.user;
      document.getElementById('userName').innerText = currentUser.nombre.split(' ')[0];
      document.getElementById('loginBtn').style.display = 'none';
      document.getElementById('logoutBtn').style.display = 'inline-block';
    } else {
      document.getElementById('loginBtn').style.display = 'inline-block';
      document.getElementById('logoutBtn').style.display = 'none';
      document.getElementById('userName').innerText = 'Invitado';
    }
  } catch(e) {
    console.error('Error en loadUser:', e);
  }
}

document.getElementById('logoutBtn').onclick = async () => {
  await Auth.logout();
  location.href = '/';
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
    const eventId = card.dataset.eventId;
    const isPreventa = card.dataset.isPreventa === 'true';
    if (!eventDate) return;
    const container = card.querySelector('.countdown-container');
    if (!container) return;
    const eventDateObj = new Date(eventDate);
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
    location.href = '/login.html';
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

// ========== VALIDACIÓN DE INE CON OCR Y CÁMARA ==========
function mostrarModalValidacionINE(callback) {
  const modal = document.createElement('div');
  modal.id = 'ineModal';
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
    z-index: 10000;
    padding: 20px;
  `;
  modal.innerHTML = `
    <div style="background: linear-gradient(145deg, rgba(10,20,45,0.95), rgba(26,11,46,0.95)); border-radius: 2rem; padding: 2rem; max-width: 550px; width: 100%; border: 2px solid #ff0000; box-shadow: 0 0 40px rgba(255,0,0,0.3); max-height: 90vh; overflow-y: auto;">
      <h2 style="color: #ff3333; font-size: 1.8rem; text-align: center;">🔐 Validación de INE</h2>
      <p style="color: #aaa; text-align: center; margin-bottom: 1.5rem;">Para comprar boletos, debes validar tu identidad con INE y selfie.</p>
      
      <!-- ===== NOTA DE VALIDACIÓN OCR ===== -->
      <div id="ocrStatus" style="display:none; margin-bottom:1rem; padding:0.8rem; border-radius:0.8rem; text-align:center;"></div>
      
      <form id="ineFormModal" enctype="multipart/form-data">
        <div style="margin-bottom: 1rem;">
          <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">Número de INE (Clave de Elector)</label>
          <input type="text" id="numINE" placeholder="Ej: MRHRJN06121909H900" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem;">
          <div id="ineValid" style="font-size:0.8rem; margin-top:0.2rem;"></div>
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">CURP</label>
          <input type="text" id="curpINE" placeholder="Ej: MAHJ061219HDFRRNA6" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem;">
          <div id="curpValid" style="font-size:0.8rem; margin-top:0.2rem;"></div>
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">Nombre completo</label>
          <input type="text" id="nombreINE" placeholder="Como aparece en tu INE" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem;">
          <div id="nombreValid" style="font-size:0.8rem; margin-top:0.2rem;"></div>
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">Fecha de nacimiento</label>
          <input type="date" id="fechaNacINE" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem;">
          <div id="fechaValid" style="font-size:0.8rem; margin-top:0.2rem;"></div>
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">Sexo</label>
          <select id="sexoINE" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box; appearance:none; -webkit-appearance:none; background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path fill="white" d="M6 8L1 3h10z"/></svg>'); background-repeat:no-repeat; background-position:right 1rem center; background-size:12px;">
            <option value="" disabled selected style="color:#aaa; background:#0d0d0d;">Selecciona tu sexo</option>
            <option value="M" style="color:white; background:#1a1a1a;">Masculino</option>
            <option value="F" style="color:white; background:#1a1a1a;">Femenino</option>
          </select>
          <div id="sexoValid" style="font-size:0.8rem; margin-top:0.2rem;"></div>
        </div>
        
        <!-- ===== FOTO DEL INE CON OPCIÓN DE CÁMARA ===== -->
        <div style="margin-bottom: 1rem;">
          <label style="color: #ff3333; display: block; margin-bottom: 0.3rem;"><i class="fas fa-id-card"></i> Foto de tu INE</label>
          <input type="file" id="fotoINE" accept="image/*" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px dashed #ff0000; border-radius:0.8rem; color:white; cursor:pointer; margin-bottom:0.5rem;">
          <button type="button" id="ineCamBtn" style="background:rgba(255,0,0,0.2); border:1px solid #ff0000; color:#ff3333; padding:0.5rem 1rem; border-radius:0.8rem; cursor:pointer; width:100%;">
            <i class="fas fa-camera"></i> Tomar foto del INE
          </button>
          <video id="ineVideo" style="width:100%; max-height:200px; display:none; margin-top:0.5rem; border-radius:0.5rem; background:#000;" autoplay></video>
          <button type="button" id="ineCaptureBtn" style="display:none; background:#ff0000; color:white; border:none; padding:0.3rem 1rem; border-radius:0.5rem; cursor:pointer; margin-top:0.5rem; width:100%;">📸 Capturar INE</button>
          <img id="inePreview" style="display:none; max-width:100%; margin-top:0.5rem; border-radius:0.5rem; border:2px solid #ff0000;">
        </div>
        
        <!-- ===== SELFIE CON CÁMARA ===== -->
        <div style="margin-bottom: 1.5rem;">
          <label style="color: #ff3333; display: block; margin-bottom: 0.3rem;"><i class="fas fa-camera"></i> Selfie (foto de tu cara)</label>
          <input type="file" id="selfieINE" accept="image/*" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px dashed #ff0000; border-radius:0.8rem; color:white; cursor:pointer; margin-bottom:0.5rem;">
          <button type="button" id="selfieCamBtn" style="background:rgba(255,0,0,0.2); border:1px solid #ff0000; color:#ff3333; padding:0.5rem 1rem; border-radius:0.8rem; cursor:pointer; width:100%;">
            <i class="fas fa-camera"></i> Tomar selfie
          </button>
          <video id="selfieVideo" style="width:100%; max-height:200px; display:none; margin-top:0.5rem; border-radius:0.5rem; background:#000;" autoplay></video>
          <button type="button" id="selfieCaptureBtn" style="display:none; background:#ff0000; color:white; border:none; padding:0.3rem 1rem; border-radius:0.5rem; cursor:pointer; margin-top:0.5rem; width:100%;">📸 Capturar selfie</button>
          <img id="selfiePreview" style="display:none; max-width:100%; margin-top:0.5rem; border-radius:0.5rem; border:2px solid #ff0000;">
        </div>
        
        <button type="submit" style="background:linear-gradient(135deg, #cc0000, #ff0000); border:none; padding:0.8rem; border-radius:2rem; font-weight:bold; font-size:1.1rem; color:white; cursor:pointer; width:100%; box-shadow:0 0 20px rgba(255,0,0,0.3); transition:0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          ✅ Validar y Comprar
        </button>
      </form>
      <button id="closeINE" style="margin-top:1rem; background:rgba(255,255,255,0.1); color:#ff6666; border:1px solid #ff6666; padding:0.5rem 1rem; border-radius:2rem; cursor:pointer; width:100%; font-weight:bold;">
        ✕ Cancelar
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // ===== VARIABLES PARA CÁMARAS =====
  let ineStream = null;
  let selfieStream = null;
  const ineVideo = document.getElementById('ineVideo');
  const ineCamBtn = document.getElementById('ineCamBtn');
  const ineCaptureBtn = document.getElementById('ineCaptureBtn');
  const ineFileInput = document.getElementById('fotoINE');
  const inePreview = document.getElementById('inePreview');

  const selfieVideo = document.getElementById('selfieVideo');
  const selfieCamBtn = document.getElementById('selfieCamBtn');
  const selfieCaptureBtn = document.getElementById('selfieCaptureBtn');
  const selfieFileInput = document.getElementById('selfieINE');
  const selfiePreview = document.getElementById('selfiePreview');

  // ===== FUNCIÓN PARA CAPTURAR FOTO DEL INE =====
  async function capturarINE() {
    if (ineVideo.style.display === 'none') {
      try {
        ineStream = await navigator.mediaDevices.getUserMedia({ video: true, facingMode: 'environment' });
        ineVideo.srcObject = ineStream;
        ineVideo.style.display = 'block';
        ineCaptureBtn.style.display = 'block';
        ineCamBtn.textContent = 'Ocultar cámara';
      } catch(e) {
        showToast('Error al acceder a la cámara. Asegúrate de dar permisos.', 'error');
      }
    } else {
      if (ineStream) ineStream.getTracks().forEach(t => t.stop());
      ineVideo.style.display = 'none';
      ineCaptureBtn.style.display = 'none';
      ineCamBtn.textContent = 'Tomar foto del INE';
    }
  }

  ineCamBtn.onclick = capturarINE;

  ineCaptureBtn.onclick = () => {
    if (!ineStream) { showToast('Activa la cámara primero.', 'warning'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = ineVideo.videoWidth || 640;
    canvas.height = ineVideo.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(ineVideo, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) { showToast('Error al capturar', 'error'); return; }
      const file = new File([blob], 'ine.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(file);
      ineFileInput.files = dt.files;
      inePreview.src = URL.createObjectURL(blob);
      inePreview.style.display = 'block';
      showToast('✅ Foto de INE capturada. Extrayendo datos...', 'success');
      
      if (ineStream) ineStream.getTracks().forEach(t => t.stop());
      ineVideo.style.display = 'none';
      ineCaptureBtn.style.display = 'none';
      ineCamBtn.textContent = 'Tomar foto del INE';
      
      // ===== ENVIAR A OCR =====
      await extraerDatosINE(file);
    }, 'image/jpeg', 0.9);
  };

  // ===== FUNCIÓN PARA CAPTURAR SELFIE =====
  async function capturarSelfie() {
    if (selfieVideo.style.display === 'none') {
      try {
        selfieStream = await navigator.mediaDevices.getUserMedia({ video: true });
        selfieVideo.srcObject = selfieStream;
        selfieVideo.style.display = 'block';
        selfieCaptureBtn.style.display = 'block';
        selfieCamBtn.textContent = 'Ocultar cámara';
      } catch(e) {
        showToast('Error al acceder a la cámara. Asegúrate de dar permisos.', 'error');
      }
    } else {
      if (selfieStream) selfieStream.getTracks().forEach(t => t.stop());
      selfieVideo.style.display = 'none';
      selfieCaptureBtn.style.display = 'none';
      selfieCamBtn.textContent = 'Tomar selfie';
    }
  }

  selfieCamBtn.onclick = capturarSelfie;

  selfieCaptureBtn.onclick = () => {
    if (!selfieStream) { showToast('Activa la cámara primero.', 'warning'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = selfieVideo.videoWidth || 640;
    canvas.height = selfieVideo.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(selfieVideo, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { showToast('Error al capturar', 'error'); return; }
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(file);
      selfieFileInput.files = dt.files;
      selfiePreview.src = URL.createObjectURL(blob);
      selfiePreview.style.display = 'block';
      showToast('✅ Selfie capturada', 'success');
      if (selfieStream) selfieStream.getTracks().forEach(t => t.stop());
      selfieVideo.style.display = 'none';
      selfieCaptureBtn.style.display = 'none';
      selfieCamBtn.textContent = 'Tomar selfie';
    }, 'image/jpeg', 0.9);
  };

  // ===== FUNCIÓN OCR =====
  async function extraerDatosINE(file) {
    const statusDiv = document.getElementById('ocrStatus');
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '⏳ Extrayendo datos del INE...';
    statusDiv.style.background = 'rgba(255,255,0,0.2)';
    statusDiv.style.color = '#ffcc00';

    try {
      const formData = new FormData();
      formData.append('ineImage', file);

      const res = await fetch('/api/ine/ocr', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        statusDiv.innerHTML = '✅ Datos extraídos correctamente';
        statusDiv.style.background = 'rgba(0,255,0,0.2)';
        statusDiv.style.color = '#00ff88';

        // Autocompletar campos
        if (data.numero_ine) document.getElementById('numINE').value = data.numero_ine;
        if (data.curp) document.getElementById('curpINE').value = data.curp;
        if (data.nombre_completo) document.getElementById('nombreINE').value = data.nombre_completo;
        if (data.fecha_nacimiento) {
          // Formato esperado: YYYY-MM-DD
          const fecha = data.fecha_nacimiento;
          if (fecha.includes('/')) {
            const partes = fecha.split('/');
            if (partes.length === 3) {
              // Asumimos DD/MM/YYYY o MM/DD/YYYY? mejor lo dejamos como está
              document.getElementById('fechaNacINE').value = partes.reverse().join('-');
            }
          } else {
            document.getElementById('fechaNacINE').value = fecha;
          }
        }
        if (data.sexo) {
          const sexoSelect = document.getElementById('sexoINE');
          if (data.sexo.toUpperCase() === 'M' || data.sexo.toUpperCase() === 'F') {
            sexoSelect.value = data.sexo.toUpperCase();
          } else if (data.sexo.toLowerCase().includes('masculino')) {
            sexoSelect.value = 'M';
          } else if (data.sexo.toLowerCase().includes('femenino')) {
            sexoSelect.value = 'F';
          }
        }

        // Mostrar validación visual
        validarCamposConOCR(data);
        showToast('✅ Datos del INE extraídos y autocompletados', 'success');
      } else {
        statusDiv.innerHTML = '❌ No se pudieron extraer los datos. Ingresa manualmente.';
        statusDiv.style.background = 'rgba(255,0,0,0.2)';
        statusDiv.style.color = '#ff6666';
        showToast('❌ Error al procesar OCR', 'error');
      }
    } catch (err) {
      statusDiv.innerHTML = '❌ Error: ' + err.message;
      statusDiv.style.background = 'rgba(255,0,0,0.2)';
      statusDiv.style.color = '#ff6666';
      showToast('Error en OCR: ' + err.message, 'error');
    }
  }

  // ===== VALIDACIÓN VISUAL DE CAMPOS =====
  function validarCamposConOCR(datos) {
    const campos = [
      { id: 'numINE', key: 'numero_ine', divId: 'ineValid' },
      { id: 'curpINE', key: 'curp', divId: 'curpValid' },
      { id: 'nombreINE', key: 'nombre_completo', divId: 'nombreValid' },
      { id: 'fechaNacINE', key: 'fecha_nacimiento', divId: 'fechaValid' },
      { id: 'sexoINE', key: 'sexo', divId: 'sexoValid' }
    ];

    campos.forEach(campo => {
      const input = document.getElementById(campo.id);
      const div = document.getElementById(campo.divId);
      if (datos[campo.key]) {
        div.innerHTML = `✅ Dato extraído: ${datos[campo.key]}`;
        div.style.color = '#00ff88';
      } else {
        div.innerHTML = '❌ No se extrajo este dato';
        div.style.color = '#ff6666';
      }
    });
  }

  // ===== CIERRE MODAL =====
  document.getElementById('closeINE').onclick = () => {
    if (ineStream) ineStream.getTracks().forEach(t => t.stop());
    if (selfieStream) selfieStream.getTracks().forEach(t => t.stop());
    modal.remove();
    callback(false);
  };

  // ===== FORMULARIO DE VALIDACIÓN =====
  document.getElementById('ineFormModal').onsubmit = async (e) => {
    e.preventDefault();
    
    const numeroINE = document.getElementById('numINE').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const curp = document.getElementById('curpINE').value.trim().toUpperCase().replace(/[^A-ZÑ0-9]/g, '');
    const nombreCompleto = document.getElementById('nombreINE').value.trim();
    const fechaNacimiento = document.getElementById('fechaNacINE').value;
    const sexo = document.getElementById('sexoINE').value;
    
    if (!sexo) {
      showToast('Por favor, selecciona tu sexo', 'warning');
      return;
    }

    console.log('📤 Datos enviados (frontend):', { numeroINE, curp, nombreCompleto, fechaNacimiento, sexo });

    const formData = new FormData();
    formData.append('numero_ine', numeroINE);
    formData.append('curp', curp);
    formData.append('nombre_completo', nombreCompleto);
    formData.append('fecha_nacimiento', fechaNacimiento);
    formData.append('sexo', sexo);
    formData.append('entidad_emision', '');

    const fotoINE = document.getElementById('fotoINE').files[0];
    const selfie = document.getElementById('selfieINE').files[0];
    if (!fotoINE || !selfie) {
      showToast('Debes subir foto de INE y selfie', 'warning');
      return;
    }
    formData.append('ineImage', fotoINE);
    formData.append('selfieImage', selfie);

    try {
      const res = await fetch('/api/ine/validar-con-imagen', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('✅ INE validado correctamente. Ahora puedes comprar.', 'success');
        modal.remove();
        if (ineStream) ineStream.getTracks().forEach(t => t.stop());
        if (selfieStream) selfieStream.getTracks().forEach(t => t.stop());
        callback(true);
      } else {
        showToast('❌ ' + (data.error || 'Error al validar'), 'error');
      }
    } catch(err) {
      showToast('Error: ' + err.message, 'error');
    }
  };
}

// ========== MODAL PAGO ==========
function mostrarModalPago(eventoId, esPreventa, tipoPrecio, cantidad, zona, asiento, eventoNombre, precioUnitario) {
  const total = precioUnitario * cantidad;
  const modal = document.createElement('div');
  modal.id = 'pagoModal';
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
    z-index: 10002;
    padding: 20px;
  `;
  modal.innerHTML = `
    <div style="background: linear-gradient(145deg, rgba(10,20,45,0.95), rgba(26,11,46,0.95)); border-radius: 2rem; padding: 2rem; max-width: 520px; width: 100%; border: 2px solid #ff0000; box-shadow: 0 0 40px rgba(255,0,0,0.3);">
      <h2 style="color: #ff3333; text-align: center; margin-bottom: 0.5rem;">💳 Pago Seguro</h2>
      <p style="color: #aaa; text-align: center; margin-bottom: 1.5rem;">Tus datos están encriptados con AES-256-GCM</p>
      <div style="background: rgba(255,255,255,0.05); border-radius: 1rem; padding: 1rem; margin-bottom: 1.5rem; border-left: 4px solid #ff0000;">
        <p style="color: var(--text-secondary); margin: 0.2rem 0;"><strong style="color: #ff3333;">Evento:</strong> ${eventoNombre}</p>
        <p style="color: var(--text-secondary); margin: 0.2rem 0;"><strong style="color: #ff3333;">Cantidad:</strong> ${cantidad} boletos</p>
        <p style="color: var(--text-secondary); margin: 0.2rem 0;"><strong style="color: #ff3333;">Zona:</strong> ${zona}</p>
        <p style="color: var(--text-secondary); margin: 0.2rem 0; font-size: 1.2rem;"><strong style="color: #ff3333;">Total:</strong> $${total.toFixed(2)}</p>
      </div>
      <form id="pagoForm">
        <div style="margin-bottom: 1rem;">
          <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">Nombre en la tarjeta</label>
          <input type="text" id="nombreTarjeta" placeholder="Como aparece en la tarjeta" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">Número de tarjeta</label>
          <input type="text" id="numTarjeta" placeholder="1234 5678 9012 3456" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box;">
        </div>
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
          <div style="flex: 1;">
            <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">Fecha de vencimiento</label>
            <input type="text" id="fechaVencimiento" placeholder="MM/AA" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box;">
          </div>
          <div style="flex: 1;">
            <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">CVV</label>
            <input type="password" id="cvv" placeholder="123" required style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box;">
          </div>
        </div>
        <div style="margin-bottom: 1.5rem;">
          <label style="color: #ccc; display: block; margin-bottom: 0.3rem;">Tipo de tarjeta</label>
          <select id="tipoTarjeta" style="width:100%; padding:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,0,0,0.5); border-radius:0.8rem; color:white; font-size:1rem; box-sizing:border-box;">
            <option value="VISA">VISA</option>
            <option value="Mastercard">Mastercard</option>
            <option value="AMEX">American Express</option>
          </select>
        </div>
        <div class="pago-seguro" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">
          <i class="fas fa-lock" style="color:#00D4FF;"></i>
          <span>Transacción segura con encriptación AES-256</span>
        </div>
        <button type="submit" style="background:linear-gradient(135deg, #cc0000, #ff0000); border:none; padding:0.8rem; border-radius:2rem; font-weight:bold; font-size:1.1rem; color:white; cursor:pointer; width:100%; box-shadow:0 0 20px rgba(255,0,0,0.3); transition:0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          ✅ Pagar Ahora
        </button>
      </form>
      <button id="cerrarPago" style="margin-top:1rem; background:rgba(255,255,255,0.1); color:#ff6666; border:1px solid #ff6666; padding:0.5rem 1rem; border-radius:2rem; cursor:pointer; width:100%; font-weight:bold;">✕ Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cerrarPago').onclick = () => modal.remove();
  document.getElementById('pagoForm').onsubmit = async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombreTarjeta').value;
    const num_tarjeta = document.getElementById('numTarjeta').value;
    const fecha = document.getElementById('fechaVencimiento').value;
    const cv = document.getElementById('cvv').value;
    const factor_tarjeta = document.getElementById('tipoTarjeta').value;
    if (!nombre || !num_tarjeta || !fecha || !cv) {
      showToast('Por favor, completa todos los campos de la tarjeta', 'warning');
      return;
    }
    try {
      const res = await API.comprarBoleto(eventoId, cantidad, zona, asiento, {
        num_tarjeta,
        cv,
        factor_tarjeta
      }, tipoPrecio);
      if (res.success) {
        modal.remove();
        mostrarBoletoModal(res.boleto.personalizado, res.boleto.url);
        showToast(`✅ Compra exitosa! Código: ${res.boleto.codigo}`, 'success');
        setTimeout(() => window.location.href = '/mis-boletos.html', 3000);
      }
    } catch (err) {
      showToast('❌ Error en el pago: ' + err.message, 'error');
    }
  };
}

// ========== MODAL BOLETO ==========
function mostrarBoletoModal(boletoHTML, urlDescarga) {
  const modal = document.createElement('div');
  modal.id = 'boletoModal';
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
  const contenido = document.createElement('div');
  contenido.style.cssText = `background: transparent; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative;`;
  contenido.innerHTML = boletoHTML;
  const botonesContainer = document.createElement('div');
  botonesContainer.style.cssText = `display: flex; gap: 10px; justify-content: center; margin-top: 20px; flex-wrap: wrap;`;
  const verBoletosBtn = document.createElement('button');
  verBoletosBtn.innerHTML = '🎫 Ver mis boletos';
  verBoletosBtn.style.cssText = `padding:10px 20px; background:linear-gradient(135deg, #ff0000, #cc0000); color:white; border:none; border-radius:50px; font-weight:bold; cursor:pointer;`;
  verBoletosBtn.onclick = () => {
    modal.remove();
    window.location.href = '/mis-boletos.html';
  };
  const cerrarBtn = document.createElement('button');
  cerrarBtn.innerHTML = '✕ Cerrar';
  cerrarBtn.style.cssText = `padding:10px 20px; background:#333; color:white; border:none; border-radius:50px; font-weight:bold; cursor:pointer;`;
  cerrarBtn.onclick = () => modal.remove();
  if (urlDescarga) {
    const descargarBtn = document.createElement('button');
    descargarBtn.innerHTML = '⬇️ Descargar Boleto';
    descargarBtn.style.cssText = `padding:10px 20px; background:linear-gradient(135deg, #00ff88, #00cc66); color:#0a0f2a; border:none; border-radius:50px; font-weight:bold; cursor:pointer;`;
    descargarBtn.onclick = () => window.open(urlDescarga, '_blank');
    botonesContainer.appendChild(descargarBtn);
  }
  botonesContainer.appendChild(verBoletosBtn);
  botonesContainer.appendChild(cerrarBtn);
  contenido.appendChild(botonesContainer);
  modal.appendChild(contenido);
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ========== INICIAR COMPRA ==========
async function iniciarCompra(eventoId, esPreventa, eventoNombre, precioUnitario) {
  if (!currentUser) {
    showToast('Inicia sesión para comprar', 'warning');
    location.href = '/login.html';
    return;
  }
  mostrarModalCompra(eventoId, esPreventa, eventoNombre, precioUnitario);
}

// ========== CARGAR EVENTOS ==========
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
      const imagen = e.imagen_url ? `<img src="${e.imagen_url}" style="width:100%; height:180px; object-fit:cover;">` : '<div class="evento-imagen"><i class="fas fa-rocket"></i></div>';
      html += `
        <div class="evento-card" data-event-id="${e.id_evento}" data-event-date="${e.fecha_evento}" data-is-preventa="${e.es_preventa}" data-precio="${precioNormal}" data-precio-preventa="${precioPreventa}" data-preventa-inicio="${e.preventa_inicio || ''}" data-preventa-fin="${e.preventa_fin || ''}">
          ${imagen}
          <div class="evento-info">
            <h3 class="evento-titulo">${e.nombre_evento} ${badge}</h3>
            <p><i class="fas fa-map-marker-alt"></i> ${e.ubicacion}</p>
            <p><i class="far fa-calendar"></i> ${fecha} - ${e.hora_evento.substring(0,5)}</p>
            <div class="precio">$${precioNormal}</div>
            <div class="countdown-container" style="margin: 0.8rem 0; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 0.8rem;">
              <div style="text-align:center; font-size:0.8rem; color:#aaa; margin-bottom:0.3rem;">⏳ Cargando...</div>
              <div id="countdown-${e.id_evento}" style="text-align:center; font-size:1rem; font-weight:bold; color:#ff3333;">Cargando...</div>
            </div>
            <button class="btn-comprar" data-id="${e.id_evento}" data-preventa="${e.es_preventa}" data-nombre="${e.nombre_evento}" data-precio="${precioNormal}" data-precio-preventa="${precioPreventa}">Comprar Boleto</button>
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
    showToast('Error al cargar eventos: ' + err.message, 'error');
    container.innerHTML = `<p style="text-align:center; color:var(--red-light);">❌ Error al cargar eventos: ${err.message}</p>`;
  }
}

// ========== INICIALIZACIÓN ==========
loadUser();
cargarEventos();
if (typeof createStarField === 'function') createStarField();