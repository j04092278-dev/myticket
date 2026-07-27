const pool = require('../config/database');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { encrypt } = require('../utils/encrypt');

const generarBoletoHTML = (data) => {
  const { codigo, evento, nombre_usuario, fecha, ubicacion, zona, asiento, precio, imagen_url } = data;
  
  const qrBase64 = QRCode.toDataURLSync(JSON.stringify({
    codigo: codigo,
    evento: evento,
    usuario: nombre_usuario,
    fecha: fecha,
    zona: zona,
    asiento: asiento
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
  
  return `
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
};

const comprarBoletos = async (req, res) => {
  const { eventoId, cantidad, zona, asiento, num_tarjeta, cv, factor_tarjeta, tipoPrecio } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Verificar evento
    const evento = await client.query('SELECT * FROM evento WHERE id_evento = $1 FOR UPDATE', [eventoId]);
    if (evento.rows.length === 0) throw new Error('Evento no existe');
    const eventoData = evento.rows[0];
    if (eventoData.boletos_disponibles < cantidad) throw new Error('Boletos insuficientes');

    // Verificar INE
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

    // Calcular precio
    const precioUnitario = (tipoPrecio === 'preventa' && eventoData.es_preventa && eventoData.precio_preventa)
      ? eventoData.precio_preventa
      : eventoData.precio_normal;

    // Generar código único
    const codigoUnico = crypto.randomBytes(8).toString('hex').toUpperCase();
    const qrCode = await QRCode.toDataURL(JSON.stringify({
      codigo: codigoUnico,
      evento: eventoData.nombre_evento,
      usuario: req.userEmail
    }));

    // Obtener datos del usuario
    const userData = await pool.query('SELECT nombre FROM cliente WHERE id_cliente = $1', [req.userId]);
    const nombre_usuario = userData.rows[0].nombre;

    // Generar HTML del boleto
    const imagen_url = eventoData.imagen_url || null;
    const boletoHTML = generarBoletoHTML({
      codigo: codigoUnico,
      evento: eventoData.nombre_evento,
      nombre_usuario: nombre_usuario,
      fecha: eventoData.fecha_evento,
      ubicacion: eventoData.ubicacion,
      zona: zona || 'General',
      asiento: asiento || 'Libre',
      precio: precioUnitario,
      imagen_url: imagen_url
    });

    // Insertar boleto en BD (con el HTML)
    const boleto = await client.query(
      `INSERT INTO boletos (id_evento, id_cliente, zona, asiento, codigo_unico, qr_codigo, estatus, tipo_precio, boleto_html)
       VALUES ($1,$2,$3,$4,$5,$6,'activo',$7,$8) RETURNING id_boleto`,
      [eventoId, req.userId, zona || 'General', asiento || 'Libre', codigoUnico, qrCode, tipoPrecio || 'normal', boletoHTML]
    );
    const boletoId = boleto.rows[0].id_boleto;

    // Actualizar disponibilidad
    await client.query('UPDATE evento SET boletos_disponibles = boletos_disponibles - $1 WHERE id_evento = $2', [cantidad, eventoId]);

    // Registrar venta
    const referencia = `REF${codigoUnico.slice(0,6)}`;
    await client.query(
      `INSERT INTO venta (id_cliente, id_evento, id_boleto, fecha_venta, hora_venta, precio_pagado, referencia_boleto)
       VALUES ($1,$2,$3,CURRENT_DATE,CURRENT_TIME,$4,$5)`,
      [req.userId, eventoId, boletoId, precioUnitario * cantidad, referencia]
    );

    // Registrar transacción
    await client.query(
      `INSERT INTO transacciones (id_cliente, id_boleto, fecha_transaccion, monto, estado)
       VALUES ($1,$2,CURRENT_DATE,$3,'completado')`,
      [req.userId, boletoId, precioUnitario * cantidad]
    );

    // Guardar datos de tarjeta (opcional)
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
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      boleto: {
        id: boletoId,
        codigo: codigoUnico,
        qr: qrCode,
        evento: eventoData.nombre_evento,
        cantidad,
        total: precioUnitario * cantidad,
        zona: zona || 'General',
        asiento: asiento || 'Libre',
        tipoPrecio,
        personalizado: boletoHTML,
        url: `/api/boletos/${boletoId}/descargar`
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
      `SELECT b.id_boleto, b.codigo_unico, b.zona, b.asiento, b.estatus, b.qr_codigo, b.tipo_precio, b.boleto_html,
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

const descargarBoleto = async (req, res) => {
  const { id } = req.params;
  try {
    // Verificar que el boleto pertenece al usuario autenticado
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

module.exports = { comprarBoletos, getMisBoletos, descargarBoleto };