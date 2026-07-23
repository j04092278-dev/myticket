class API {
  static async request(endpoint, options = {}) {
    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'include'  // Envía cookies
    });
    if (!res.ok) {
      let errorMsg = `Error ${res.status}`;
      try {
        const data = await res.json();
        errorMsg = data.error || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Respuesta inválida del servidor');
    }
  }

  static getEventos() { return this.request('/eventos'); }
  static comprarBoleto(eventoId, cantidad, zona, asiento, datosTarjeta, tipoPrecio) {
    return this.request('/boletos/comprar', {
      method: 'POST',
      body: JSON.stringify({ eventoId, cantidad, zona, asiento, tipoPrecio, ...datosTarjeta })
    });
  }
  static getMisBoletos() { return this.request('/boletos/mis-boletos'); }
  static crearEvento(data) { return this.request('/eventos', { method: 'POST', body: JSON.stringify(data) }); }
}