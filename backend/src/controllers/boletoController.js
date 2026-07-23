const pool = require('../config/database');
const crypto = require('crypto');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { encrypt } = require('../utils/encrypt');

const generarBoletoPersonalizado = async (data) => {
  const { codigo, evento, nombre_usuario, fecha, ubicacion, zona, asiento, precio, imagen_url } = data;
  
  const qrBase64 = await QRCode.toDataURL(JSON.stringify({ 
    codigo, 
    evento, 
    usuario: nombre_usuario,
    fecha: fecha
  }));
  
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
  if (imagen_url) {
    fondoStyle = `background-image: url('${imagen_url}'); background-size: cover; background-position: center; position: relative;`;
  }
  
  const html = `
    <div style="${fondoStyle} color: ${colors.text}; padding: 24px; border-radius: 16px; border: 2px solid ${colors.primary}; max-width: 400px; margin: 0 auto; font-family: 'Poppins', sans-serif; box-shadow: 0 0 40px rgba(255,0,0,0.3); position: relative; overflow: hidden; ${imagen_url ? 'min-height: 450px; display: flex; flex-direction: column; justify-content: center;' : ''}">
      ${imagen_url ? `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10,10,10,0.7); z-index: 0;"></div>` : ''}
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
          <img src="${qrBase64}" alt="QR" style="width: 120px; height: 120px; border: 3px solid ${colors.primary}; border-radius: 12px; padding: 0.2rem; background: white;"/>
        </div>
        <div style="text-align: center; margin-top: 5px;">
          <p style="font-size: 0.8rem; color: ${colors.textSecondary}; letter-spacing: 1px;">Código: ${codigo}</p>
          <p style="font-size: 0.7rem; color: ${colors.textSecondary};">Presenta este boleto en el acceso</p>
        </div>
      </div>
    </div>
  `;
  
  const fileName = `boleto_${codigo}.html`;
  const filePath = path.join(__dirname, '../../public/boletos', fileName);
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  fs.writeFileSync(filePath, html);
  return { html, filePath: `/boletos/${fileName}` };
};

const comprarBoletos = async (req, res) => {
  const { eventoId, cantidad, zona, asiento, num_tarjeta, cv, factor_tarjeta, tipoPrecio } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const evento = await client.query('SELECT * FROM evento WHERE id_evento = $1 FOR UPDATE', [eventoId]);
    if (evento.rows.length === 0) throw new Error('Evento no existe');
    const eventoData = evento.rows[0];
    if (eventoData.boletos_disponibles < cantidad) throw new Error('Boletos insuficientes');

    const ineCheck = await client.query(
      'SELECT validado, facial_verificado FROM ine_validacion WHERE id_cliente = $1',
      [req.userId]
    );
    if (ineCheck.rows.length === 0 || !ineCheck.rows[0].validado) {
      throw new Error('Debes validar tu INE antes de comprar');
    }
    if (!ineCheck.rows[0].facial_verificado) {
      throw new Error('La verificación facial no ha sido exitosa. Revalida tu INE.');
    }

    const precioUnitario = (tipoPrecio === 'preventa' && eventoData.es_preventa && eventoData.precio_preventa)
      ? eventoData.precio_preventa
      : eventoData.precio_normal;

    const codigoUnico = crypto.randomBytes(8).toString('hex').toUpperCase();
    const qrCode = await QRCode.toDataURL(JSON.stringify({ 
      codigo: codigoUnico, 
      evento: eventoData.nombre_evento, 
      usuario: req.userEmail 
    }));

    const boleto = await client.query(
      `INSERT INTO boletos (id_evento, id_cliente, zona, asiento, codigo_unico, qr_codigo, estatus, tipo_precio)
       VALUES ($1,$2,$3,$4,$5,$6,'activo',$7) RETURNING *`,
      [eventoId, req.userId, zona || 'General', asiento || 'Libre', codigoUnico, qrCode, tipoPrecio || 'normal']
    );

    await client.query('UPDATE evento SET boletos_disponibles = boletos_disponibles - $1 WHERE id_evento = $2', [cantidad, eventoId]);

    // ===== CORRECCIÓN: Referencia más corta (8 caracteres) =====
    const referencia = `REF${codigoUnico.slice(0,6)}`; // Ej: REFABC123 (10 caracteres)
    
    await client.query(
      `INSERT INTO venta (id_cliente, id_evento, id_boleto, fecha_venta, hora_venta, precio_pagado, referencia_boleto)
       VALUES ($1,$2,$3,CURRENT_DATE,CURRENT_TIME,$4,$5)`,
      [req.userId, eventoId, boleto.rows[0].id_boleto, precioUnitario * cantidad, referencia]
    );

    await client.query(
      `INSERT INTO transacciones (id_cliente, id_boleto, fecha_transaccion, monto, estado)
       VALUES ($1,$2,CURRENT_DATE,$3,'completado')`,
      [req.userId, boleto.rows[0].id_boleto, precioUnitario * cantidad]
    );

    // Guardar datos de tarjeta (encriptados) - SEGURO
    if (num_tarjeta && cv && factor_tarjeta) {
      try {
        const encryptedCard = encrypt(num_tarjeta);
        const encryptedCV = encrypt(cv);
        const encryptedFactor = encrypt(factor_tarjeta);
        
        if (encryptedCard && encryptedCV && encryptedFactor) {
          await client.query(
            `UPDATE cliente SET num_tarjeta = $1, cv = $2, factor_tarjeta = $3, fecha_inf = CURRENT_DATE, valida_inf = true
             WHERE id_cliente = $4`,
            [JSON.stringify(encryptedCard), JSON.stringify(encryptedCV), JSON.stringify(encryptedFactor), req.userId]
          );
        }
      } catch (err) {
        console.warn('⚠️ No se pudieron encriptar los datos de la tarjeta:', err.message);
        // No detenemos la transacción, solo logueamos
      }
    }

    await client.query('COMMIT');

    const userData = await pool.query('SELECT nombre FROM cliente WHERE id_cliente = $1', [req.userId]);
    const nombre_usuario = userData.rows[0].nombre;

    const imagen_url = eventoData.imagen_url || null;
    const boletoPersonalizado = await generarBoletoPersonalizado({
      codigo: codigoUnico,
      evento: eventoData.nombre_evento,
      nombre_usuario,
      fecha: eventoData.fecha_evento,
      ubicacion: eventoData.ubicacion,
      zona: zona || 'General',
      asiento: asiento || 'Libre',
      precio: precioUnitario,
      imagen_url: imagen_url
    });

    res.json({
      success: true,
      boleto: {
        codigo: codigoUnico,
        qr: qrCode,
        evento: eventoData.nombre_evento,
        cantidad,
        total: precioUnitario * cantidad,
        zona: zona || 'General',
        asiento: asiento || 'Libre',
        tipoPrecio,
        personalizado: boletoPersonalizado.html,
        url: boletoPersonalizado.filePath
      },
      mensaje: '✅ Compra realizada con éxito'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en comprarBoletos:', error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

const getMisBoletos = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id_boleto, b.codigo_unico, b.zona, b.asiento, b.estatus, b.qr_codigo, b.tipo_precio,
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

module.exports = { comprarBoletos, getMisBoletos };