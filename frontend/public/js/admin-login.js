document.addEventListener('DOMContentLoaded', function() {
  if (typeof createStarField === 'function') createStarField();

  document.getElementById('adminLoginForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('errorMsg');
    errorDiv.innerText = 'Verificando...';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo_usuario: email, contrasena: password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success && data.user.isAdmin === true) {
        window.location.href = '/admin.html';
      } else {
        errorDiv.innerText = data.error || 'Credenciales incorrectas';
        showToast('❌ ' + (data.error || 'Credenciales incorrectas'), 'error');
      }
    } catch (err) {
      errorDiv.innerText = 'Error de conexión: ' + err.message;
      showToast('❌ Error de conexión: ' + err.message, 'error');
    }
  };
});