class Auth {
  static async register(nombre, edad, telefono, correo_usuario, contrasena) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, edad, telefono, correo_usuario, contrasena }),
      credentials: 'include' // ⬅️ ENVIAR COOKIES
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  static async login(correo_usuario, contrasena) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo_usuario, contrasena }),
      credentials: 'include' // ⬅️ ENVIAR COOKIES
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  static async logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include' // ⬅️ ENVIAR COOKIES
    });
  }

  static async getCurrentUser() {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include' // ⬅️ ENVIAR COOKIES
      });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('Error en getCurrentUser:', err);
      return null;
    }
  }
}