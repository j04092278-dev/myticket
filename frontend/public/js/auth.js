class Auth {
  static async register(nombre, edad, telefono, correo_usuario, contrasena) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, edad, telefono, correo_usuario, contrasena }),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en registro');
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
    if (!res.ok) throw new Error(data.error || 'Error en login');
    return data;
  }

  static async logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.warn('Error en logout:', e);
    }
  }

  static async getCurrentUser() {
    try {
      console.log('🔍 getCurrentUser: llamando a /api/auth/me');
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      console.log('📡 Estado de /me:', res.status);
      
      if (res.status === 401) {
        console.log('⚠️ No autenticado (401)');
        return null;
      }
      
      if (!res.ok) {
        console.log('⚠️ Error en /me:', res.status);
        const text = await res.text();
        console.log('📄 Respuesta:', text);
        return null;
      }
      
      const data = await res.json();
      console.log('✅ Usuario obtenido:', data.user?.email || 'No user');
      return data;
    } catch (err) {
      console.error('❌ Error en getCurrentUser:', err.message);
      return null;
    }
  }
}