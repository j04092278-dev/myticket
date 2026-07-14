class Auth {
  static async register(nombre, edad, telefono, correo_usuario, contrasena) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, edad, telefono, correo_usuario, contrasena })
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
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  static async logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  }

  static async getCurrentUser() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }
}