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
    
    // Guardar token en localStorage como fallback
    if (data.token) {
      localStorage.setItem('token', data.token);
      console.log('✅ Token guardado en localStorage');
    }
    return data;
  }

  static async logout() {
    localStorage.removeItem('token');
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  }

  static async getCurrentUser() {
    // Primero intentar con cookie (con credentials)
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: this._getAuthHeaders()
      });
      if (res.status === 401) {
        // Si falla con cookie, intentar con token en localStorage
        return this._getUserFromToken();
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('Error en getCurrentUser (con cookie):', err);
      // Fallback: intentar con token en localStorage
      return this._getUserFromToken();
    }
  }

  // ===== MÉTODO PARA OBTENER USUARIO DESDE TOKEN EN LOCALSTORAGE =====
  static async _getUserFromToken() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include' // Aún así enviamos cookies si existen
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('Error en _getUserFromToken:', err);
      return null;
    }
  }

  // ===== OBTENER HEADERS DE AUTENTICACIÓN =====
  static _getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  }
}