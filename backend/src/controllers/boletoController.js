const pool = require('../config/database');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { encrypt } = require('../utils/encrypt');

// ===== GENERAR HTML DEL BOLETO (EXPORTADO PARA WEBHOOK) =====
const generarBoletoHTML = async (data) => {
  const { codigo, evento, nombre_usuario, fecha, ubicacion, zona, asiento, precio, imagen_url } = data;
  let qrBase64 = '';
  try {
    qrBase64 = await QRCode.toDataURL(JSON.stringify({
      codigo, evento, usuario: nombre_usuario, fecha, zona, asiento
    }));
  } catch (err) { /* ignorar */ }

  const colors = {
    primary: '#ff0000',
    secondary: '#cc0000',
    light: '#ff3333',
    dark: '#1A0505',
    bg: '#0A0A0A',
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
  };

  let fondoStyle = `background: linear-gradient(145deg, ${colors.dark}, ${colors.bg});`;
  let overlay = '';
  if (imagen_url) {
    fondoStyle = `background-image: url('${imagen_url}'); background-size: cover; background-position: center;`;
    overlay = `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10,10,10,0.7); z-index: 0; border-radius: 16px;"></div>`;
  }

  return `
    <div style="${fondoStyle} color: ${colors.text}; padding: 24px; border-radius: 16px; border: 2px solid ${colors.primary}; max-width: 400px; margin: 0 auto; font-family: 'Poppins', sans-serif; box-shadow: 0 0 40px rgba(255,0,0,0.3); position: relative; overflow: hidden; min-height: 400px; display: flex; flex-direction: column; justify-content: center;">
      ${overlay}
      <div style="position: relative; z-index: 1;">
        <div style="text-align: center; margin-bottom: 15px;">
          <h2 style="color: ${colors.light}; font-size: 1.8rem; margin: 0; font-family: 'Orbitron', sans-serif;">🚀 MyTicket</h2>
          <div style="border-bottom: 2px dashed ${colors.primary}; margin: 10px 0;"></div>
        </div>
        <div style="padding: 10px;">
          <p><strong style="color: ${colors.light};">Evento:</strong> ${evento}</p>
          <p><strong style="color: ${colors.light};">Fecha:</strong> ${new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
          <p><strong style="color: ${colors.light};">Ubicación:</strong> ${ubicacion}</p>
          <p><strong style="color: ${colors.light};">Zona:</strong> ${zona || 'General'} | <strong>Asiento:</strong> ${asiento || 'Libre'}</p>
          <p><strong style="color: ${colors.light};">Comprador:</strong> ${nombre_usuario}</p>
          <p><strong style="color: ${colors.light};">Precio pagado:</strong> $${precio}</p>
        </div>
        <div style="text-align: center; margin: 15px 0;">
          ${qrBase64 ? `<img src="${qrBase64}" alt="QR" style="width: 120px; height: 120px; border: 3px solid ${colors.primary}; border-radius: 12px; padding: 0.2rem; background: white;"/>` : `<div style="width:120px;height:120px;background:rgba(255,255,255,0.1);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#666;">QR</div>`}
        </div>
        <div style="text-align: center; margin-top: 5px;">
          <p style="font-size: 0.8rem; color: ${colors.textSecondary}; letter-spacing: 1px;">Código: ${codigo}</p>
          <p style="font-size: 0.7rem; color: ${colors.textSecondary};">Presenta este boleto en el acceso</p>
        </div>
      </div>
    </div>
  `;
};

// ===== COMPRAR BOLETOS (simulación, ahora se usa Stripe) =====
const comprarBoletos = async (req, res) => {
  // Mantenemos esta función por compatibilidad, pero ya no se usa con Stripe
  res.status(400).json({ error: 'Este método está obsoleto. Use Stripe Checkout.' });
};

// ===== OBTENER BOLETOS DEL USUARIO =====
const getMisBoletos = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id_boleto, b.codigo_unico, b.zona, b.asiento, b.estatus, b.tipo_precio, b.boleto_html,
              e.nombre_evento, e.fecha_evento, e.ubicacion, v.precio_pagado,
              c.nombre as nombre_usuario, e.imagen_url
       FROM boletos b
       JOIN evento e ON b.id_evento = e.id_evento
       JOIN venta v ON b.id_boleto = v.id_boleto
       JOIN cliente c ON b.id_cliente = c.id_cliente
       WHERE b.id_cliente = $1
       ORDER BY v.fecha_venta DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en getMisBoletos:', error);
    res.status(500).json({ error: 'Error al obtener boletos' });
  }
};

// ===== DESCARGAR BOLETO =====
const descargarBoleto = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT boleto_html, codigo_unico FROM boletos WHERE id_boleto = $1 AND id_cliente = $2',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Boleto no encontrado' });
    }
    const boleto = result.rows[0];
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="boleto_${boleto.codigo_unico}.html"`);
    res.send(boleto.boleto_html);
  } catch (error) {
    console.error('❌ Error al descargar boleto:', error);
    res.status(500).json({ error: 'Error al descargar boleto' });
  }
};

module.exports = { generarBoletoHTML, comprarBoletos, getMisBoletos, descargarBoleto };