class Auth {
  static async register(nombre, edad, telefono, correo_usuario, contrasena) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, edad, telefono, correo_usuario, contrasena }),
      credentials: 'include'
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
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  }

  static async getCurrentUser() {
    try {
      console.log('🔍 getCurrentUser: llamando a /api/auth/me');
      const res = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      console.log('📡 Respuesta /me:', res.status);
      if (res.status === 401) {
        console.log('⚠️ No autenticado (401)');
        return null;
      }
      if (!res.ok) {
        console.log('⚠️ Error en /me:', res.status);
        return null;
      }
      const data = await res.json();
      console.log('✅ Usuario obtenido:', data.user?.email);
      return data;
    } catch (err) {
      console.error('❌ Error en getCurrentUser:', err);
      return null;
    }
  }
}