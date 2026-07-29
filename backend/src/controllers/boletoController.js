const pool = require('../config/database');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { encrypt } = require('../utils/encrypt');

// ===== GENERAR HTML DEL BOLETO CON QR =====
const generarBoletoHTML = async (data) => {
  const { codigo, evento, nombre_usuario, fecha, ubicacion, zona, asiento, precio, imagen_url } = data;

  // Generar QR como imagen base64
  let qrBase64 = '';
  try {
    qrBase64 = await QRCode.toDataURL(JSON.stringify({
      codigo: codigo,
      evento: evento,
      usuario: nombre_usuario,
      fecha: fecha,
      zona: zona,
      asiento: asiento
    }), { errorCorrectionLevel: 'H' });
  } catch (err) {
    console.error('❌ Error generando QR:', err);
    qrBase64 = '';
  }

  // Colores de la temática espacial
  const colors = {
    primary: '#ff0000',
    secondary: '#cc0000',
    light: '#ff3333',
    dark: '#1A0505',
    bg: '#0A0A0A',
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
  };

  // Fondo con imagen del evento o degradado
  let fondoStyle = `background: linear-gradient(145deg, ${colors.dark}, ${colors.bg});`;
  let overlay = '';
  if (imagen_url) {
    fondoStyle = `background-image: url('${imagen_url}'); background-size: cover; background-position: center;`;
    overlay = `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10,10,10,0.7); z-index: 0; border-radius: 16px;"></div>`;
  }

  // Construir HTML del boleto
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Boleto ${evento} - MyTicket</title>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #0A0A0A; font-family: 'Poppins', sans-serif; padding: 20px; }
        .boleto-container {
          width: 100%;
          max-width: 420px;
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          border: 2px solid ${colors.primary};
          box-shadow: 0 0 40px rgba(255,0,0,0.3);
          color: ${colors.text};
          padding: 24px;
          min-height: 480px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          ${fondoStyle}
        }
        .boleto-container .overlay {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(10,10,10,0.7);
          z-index: 0;
          border-radius: 16px;
        }
        .boleto-content {
          position: relative;
          z-index: 1;
        }
        .boleto-header {
          text-align: center;
          margin-bottom: 15px;
        }
        .boleto-header h2 {
          color: ${colors.light};
          font-size: 1.8rem;
          font-family: 'Orbitron', sans-serif;
          margin: 0;
        }
        .boleto-divider {
          border-bottom: 2px dashed ${colors.primary};
          margin: 10px 0;
        }
        .boleto-info p {
          margin: 5px 0;
          color: ${colors.text};
        }
        .boleto-info strong {
          color: ${colors.light};
        }
        .boleto-qr {
          text-align: center;
          margin: 15px 0;
        }
        .boleto-qr img {
          width: 140px;
          height: 140px;
          border: 3px solid ${colors.primary};
          border-radius: 12px;
          padding: 4px;
          background: white;
        }
        .boleto-footer {
          text-align: center;
          margin-top: 5px;
        }
        .boleto-footer p {
          font-size: 0.8rem;
          color: ${colors.textSecondary};
          letter-spacing: 1px;
        }
        .boleto-footer small {
          font-size: 0.7rem;
          color: ${colors.textSecondary};
        }
        @media print {
          body { background: white; padding: 0; }
          .boleto-container { box-shadow: none; border-color: #333; }
        }
      </style>
    </head>
    <body>
      <div class="boleto-container">
        ${imagen_url ? '<div class="overlay"></div>' : ''}
        <div class="boleto-content">
          <div class="boleto-header">
            <h2>🚀 MyTicket</h2>
            <div class="boleto-divider"></div>
          </div>
          <div class="boleto-info">
            <p><strong>Evento:</strong> ${evento}</p>
            <p><strong>Fecha:</strong> ${new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            <p><strong>Ubicación:</strong> ${ubicacion}</p>
            <p><strong>Zona:</strong> ${zona || 'General'} | <strong>Asiento:</strong> ${asiento || 'Libre'}</p>
            <p><strong>Comprador:</strong> ${nombre_usuario}</p>
            <p><strong>Precio pagado:</strong> $${precio}</p>
          </div>
          <div class="boleto-qr">
            ${qrBase64 ? `<img src="${qrBase64}" alt="QR Code" />` : '<div style="width:140px;height:140px;background:rgba(255,255,255,0.1);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#666;margin:0 auto;">QR</div>'}
          </div>
          <div class="boleto-footer">
            <p>Código: ${codigo}</p>
            <small>Presenta este boleto en el acceso</small>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ===== COMPRAR BOLETOS =====
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
      throw new Error('La verificación facial no ha sido exitosa');
    }

    const precioUnitario = (tipoPrecio === 'preventa' && eventoData.es_preventa && eventoData.precio_preventa)
      ? eventoData.precio_preventa
      : eventoData.precio_normal;

    const codigoUnico = crypto.randomBytes(8).toString('hex').toUpperCase();
    const userData = await client.query('SELECT nombre FROM cliente WHERE id_cliente = $1', [req.userId]);
    const nombre_usuario = userData.rows[0].nombre;

    // Generar HTML del boleto
    const imagen_url = eventoData.imagen_url || null;
    const boletoHTML = await generarBoletoHTML({
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
      `INSERT INTO boletos (id_evento, id_cliente, zona, asiento, codigo_unico, estatus, tipo_precio, boleto_html)
       VALUES ($1,$2,$3,$4,$5,'activo',$6,$7) RETURNING id_boleto`,
      [eventoId, req.userId, zona || 'General', asiento || 'Libre', codigoUnico, tipoPrecio || 'normal', boletoHTML]
    );
    const boletoId = boleto.rows[0].id_boleto;

    await client.query('UPDATE evento SET boletos_disponibles = boletos_disponibles - $1 WHERE id_evento = $2', [cantidad, eventoId]);

    const referencia = `REF${codigoUnico.slice(0,6)}`;
    await client.query(
      `INSERT INTO venta (id_cliente, id_evento, id_boleto, fecha_venta, hora_venta, precio_pagado, referencia_boleto)
       VALUES ($1,$2,$3,CURRENT_DATE,CURRENT_TIME,$4,$5)`,
      [req.userId, eventoId, boletoId, precioUnitario * cantidad, referencia]
    );

    await client.query(
      `INSERT INTO transacciones (id_cliente, id_boleto, fecha_transaccion, monto, estado)
       VALUES ($1,$2,CURRENT_DATE,$3,'completado')`,
      [req.userId, boletoId, precioUnitario * cantidad]
    );

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

// ===== OBTENER MIS BOLETOS =====
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