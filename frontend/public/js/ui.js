function showToast(message, type = 'info', duration = 3500) {
  const oldToasts = document.querySelectorAll('.myticket-toast');
  oldToasts.forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'myticket-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    padding: 16px 24px;
    border-radius: 12px;
    font-family: 'Poppins', sans-serif;
    font-size: 1rem;
    color: #FFFFFF;
    z-index: 99999;
    max-width: 400px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    animation: slideInRight 0.4s ease;
    border-left: 6px solid;
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  const colors = {
    success: { bg: 'rgba(0, 200, 80, 0.9)', border: '#00cc66', icon: '✅' },
    error: { bg: 'rgba(200, 0, 0, 0.9)', border: '#ff0000', icon: '❌' },
    warning: { bg: 'rgba(200, 150, 0, 0.9)', border: '#ffcc00', icon: '⚠️' },
    info: { bg: 'rgba(0, 100, 200, 0.9)', border: '#0066cc', icon: 'ℹ️' }
  };

  const color = colors[type] || colors.info;
  toast.style.background = color.bg;
  toast.style.borderColor = color.border;

  toast.innerHTML = `
    <span style="font-size: 1.5rem;">${color.icon}</span>
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="
      background: transparent;
      border: none;
      color: white;
      font-size: 1.2rem;
      cursor: pointer;
      margin-left: auto;
      opacity: 0.7;
      font-family: 'Poppins', sans-serif;
    ">✕</button>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);

  if (!document.getElementById('toastStyles')) {
    const style = document.createElement('style');
    style.id = 'toastStyles';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

function showAlert(message, title = 'MyTicket') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'myticket-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100000;
      animation: fadeIn 0.3s ease;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="
        background: linear-gradient(145deg, rgba(10,20,45,0.95), rgba(26,11,46,0.95));
        border-radius: 2rem;
        padding: 2rem;
        max-width: 450px;
        width: 100%;
        border: 2px solid #ff0000;
        box-shadow: 0 0 40px rgba(255,0,0,0.3);
        text-align: center;
      ">
        <h2 style="color: #ff3333; margin-bottom: 0.5rem; font-family: 'Orbitron', sans-serif;">${title}</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 1.1rem; line-height: 1.5;">${message}</p>
        <button onclick="this.closest('.myticket-modal').remove()" style="
          background: linear-gradient(135deg, #cc0000, #ff0000);
          border: none;
          padding: 0.8rem 2rem;
          border-radius: 2rem;
          font-weight: bold;
          font-size: 1rem;
          color: white;
          cursor: pointer;
          font-family: 'Poppins', sans-serif;
          box-shadow: 0 4px 15px rgba(255,0,0,0.3);
          transition: 0.2s;
        " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          Aceptar
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve();
      }
    });

    const closeBtn = modal.querySelector('button');
    closeBtn.addEventListener('click', () => {
      modal.remove();
      resolve();
    });
  });
}

function showConfirm(message, title = 'Confirmar') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'myticket-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100000;
      animation: fadeIn 0.3s ease;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="
        background: linear-gradient(145deg, rgba(10,20,45,0.95), rgba(26,11,46,0.95));
        border-radius: 2rem;
        padding: 2rem;
        max-width: 450px;
        width: 100%;
        border: 2px solid #ff0000;
        box-shadow: 0 0 40px rgba(255,0,0,0.3);
        text-align: center;
      ">
        <h2 style="color: #ff3333; margin-bottom: 0.5rem; font-family: 'Orbitron', sans-serif;">${title}</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 1.1rem; line-height: 1.5;">${message}</p>
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <button id="confirmYes" style="
            background: linear-gradient(135deg, #cc0000, #ff0000);
            border: none;
            padding: 0.8rem 2rem;
            border-radius: 2rem;
            font-weight: bold;
            font-size: 1rem;
            color: white;
            cursor: pointer;
            font-family: 'Poppins', sans-serif;
            box-shadow: 0 4px 15px rgba(255,0,0,0.3);
            transition: 0.2s;
            flex: 1;
          " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
            Sí
          </button>
          <button id="confirmNo" style="
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border-color);
            padding: 0.8rem 2rem;
            border-radius: 2rem;
            font-weight: bold;
            font-size: 1rem;
            color: var(--text-secondary);
            cursor: pointer;
            font-family: 'Poppins', sans-serif;
            transition: 0.2s;
            flex: 1;
          " onmouseover="this.style.borderColor='#ff0000'; this.style.color='white'" onmouseout="this.style.borderColor='var(--border-color)'; this.style.color='var(--text-secondary)'">
            No
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    });

    document.getElementById('confirmYes').addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });

    document.getElementById('confirmNo').addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });
  });
}

function showPrompt(message, defaultValue = '', title = 'Ingresa un valor') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'myticket-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100000;
      animation: fadeIn 0.3s ease;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="
        background: linear-gradient(145deg, rgba(10,20,45,0.95), rgba(26,11,46,0.95));
        border-radius: 2rem;
        padding: 2rem;
        max-width: 450px;
        width: 100%;
        border: 2px solid #ff0000;
        box-shadow: 0 0 40px rgba(255,0,0,0.3);
        text-align: center;
      ">
        <h2 style="color: #ff3333; margin-bottom: 0.5rem; font-family: 'Orbitron', sans-serif;">${title}</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 1.1rem; line-height: 1.5;">${message}</p>
        <input id="promptInput" type="text" value="${defaultValue}" style="
          width: 100%;
          padding: 0.8rem;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,0,0,0.5);
          border-radius: 0.8rem;
          color: white;
          font-size: 1rem;
          font-family: 'Poppins', sans-serif;
          margin-bottom: 1rem;
          box-sizing: border-box;
        " autofocus>
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <button id="promptOk" style="
            background: linear-gradient(135deg, #cc0000, #ff0000);
            border: none;
            padding: 0.8rem 2rem;
            border-radius: 2rem;
            font-weight: bold;
            font-size: 1rem;
            color: white;
            cursor: pointer;
            font-family: 'Poppins', sans-serif;
            box-shadow: 0 4px 15px rgba(255,0,0,0.3);
            transition: 0.2s;
            flex: 1;
          " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
            Aceptar
          </button>
          <button id="promptCancel" style="
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border-color);
            padding: 0.8rem 2rem;
            border-radius: 2rem;
            font-weight: bold;
            font-size: 1rem;
            color: var(--text-secondary);
            cursor: pointer;
            font-family: 'Poppins', sans-serif;
            transition: 0.2s;
            flex: 1;
          " onmouseover="this.style.borderColor='#ff0000'; this.style.color='white'" onmouseout="this.style.borderColor='var(--border-color)'; this.style.color='var(--text-secondary)'">
            Cancelar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = document.getElementById('promptInput');
    input.focus();
    input.select();

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        modal.remove();
        resolve(input.value);
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(null);
      }
    });

    document.getElementById('promptOk').addEventListener('click', () => {
      modal.remove();
      resolve(input.value);
    });

    document.getElementById('promptCancel').addEventListener('click', () => {
      modal.remove();
      resolve(null);
    });
  });
}

if (!document.getElementById('modalStyles')) {
  const style = document.createElement('style');
  style.id = 'modalStyles';
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

window.showToast = showToast;
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.showPrompt = showPrompt;