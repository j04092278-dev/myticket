let isLogin = true;
const form = document.getElementById('authForm');
const title = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const toggle = document.getElementById('toggleText');
const regFields = document.getElementById('registerFields');
const regNombre = document.getElementById('regNombre');
const regEdad = document.getElementById('regEdad');
const regTelefono = document.getElementById('regTelefono');

function setRegisterRequired(required) {
  if (required) {
    regNombre.setAttribute('required', 'required');
    regEdad.setAttribute('required', 'required');
    regTelefono.setAttribute('required', 'required');
  } else {
    regNombre.removeAttribute('required');
    regEdad.removeAttribute('required');
    regTelefono.removeAttribute('required');
  }
}

toggle.onclick = () => {
  isLogin = !isLogin;
  if (isLogin) {
    title.innerText = 'Iniciar Sesión';
    submitBtn.innerText = 'Ingresar';
    toggle.innerText = '¿No tienes cuenta? Regístrate';
    regFields.style.display = 'none';
    setRegisterRequired(false);
  } else {
    title.innerText = 'Registrarse';
    submitBtn.innerText = 'Registrarse';
    toggle.innerText = '¿Ya tienes cuenta? Inicia Sesión';
    regFields.style.display = 'block';
    setRegisterRequired(true);
  }
};

form.onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  if (isLogin) {
    try {
      const res = await Auth.login(email, pass);
      if (res.success) {
        showToast('✅ Sesión iniciada', 'success');
        window.location.href = '/eventos.html';
      } else {
        showToast('❌ ' + (res.error || 'Credenciales incorrectas'), 'error');
      }
    } catch(err) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  } else {
    const nombre = regNombre.value;
    if (!nombre) {
      showToast('Ingresa tu nombre completo', 'warning');
      return;
    }
    const edad = regEdad.value;
    const telefono = regTelefono.value;
    try {
      await Auth.register(nombre, edad, telefono, email, pass);
      showToast('✅ Registro exitoso. Ahora inicia sesión', 'success');
      isLogin = true;
      title.innerText = 'Iniciar Sesión';
      submitBtn.innerText = 'Ingresar';
      toggle.innerText = '¿No tienes cuenta? Regístrate';
      regFields.style.display = 'none';
      setRegisterRequired(false);
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
    } catch(err) {
      showToast('❌ Error en registro: ' + err.message, 'error');
    }
  }
};

setRegisterRequired(false);
if (typeof createStarField === 'function') createStarField();