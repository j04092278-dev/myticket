const pool = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
const { generarBoletoHTML } = require('./boletoController');

// ===== CREAR SESIÓN DE PAGO =====
const crearSesionPago = async (req, res) => {
  const { eventoId, cantidad, zona, asiento, tipoPrecio } = req.body;
  try {
    // Verificar INE del usuario
    const ineCheck = await pool.query(
      'SELECT validado, facial_verificado FROM ine_validacion WHERE id_cliente = $1',
      [req.userId]
    );
    if (ineCheck.rows.length === 0 || !ineCheck.rows[0].validado) {
      return res.status(403).json({ error: 'Debes validar tu INE antes de pagar' });
    }
    if (!ineCheck.rows[0].facial_verificado) {
      return res.status(403).json({ error: 'La verificación facial no ha sido exitosa. Revalida tu INE.' });
    }

    // Obtener evento
    const evento = await pool.query('SELECT * FROM evento WHERE id_evento = $1', [eventoId]);
    if (evento.rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    const eventoData = evento.rows[0];

    const precioUnitario = (tipoPrecio === 'preventa' && eventoData.es_preventa && eventoData.precio_preventa)
      ? eventoData.precio_preventa
      : eventoData.precio_normal;

    const total = precioUnitario * cantidad;
    const totalCentavos = Math.round(total * 100); // Stripe trabaja en centavos

    // Crear sesión de Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn', // o 'usd' si prefieres
          product_data: {
            name: eventoData.nombre_evento,
            description: `${cantidad} boleto(s) - Zona: ${zona || 'General'}`,
            images: eventoData.imagen_url ? [eventoData.imagen_url] : [],
          },
          unit_amount: totalCentavos,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'https://myticket.onrender.com'}/mis-boletos?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://myticket.onrender.com'}/eventos`,
      client_reference_id: JSON.stringify({
        userId: req.userId,
        eventoId: eventoId,
        cantidad: cantidad,
        zona: zona || 'General',
        asiento: asiento || 'Libre',
        tipoPrecio: tipoPrecio || 'normal',
        precioUnitario: precioUnitario
      }),
      metadata: {
        userId: req.userId.toString(),
        eventoId: eventoId.toString(),
        cantidad: cantidad.toString(),
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Error al crear sesión de pago:', error);
    res.status(500).json({ error: 'Error al procesar el pago' });
  }
};

// ===== WEBHOOK PARA CONFIRMAR PAGO EXITOSO =====
const webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`❌ Error en webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento de pago exitoso
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const clientReference = JSON.parse(session.client_reference_id);

    // Aquí procesamos la compra real (guardar boleto en BD)
    const { userId, eventoId, cantidad, zona, asiento, tipoPrecio, precioUnitario } = clientReference;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar disponibilidad nuevamente
      const evento = await client.query('SELECT * FROM evento WHERE id_evento = $1 FOR UPDATE', [eventoId]);
      if (evento.rows.length === 0) throw new Error('Evento no existe');
      const eventoData = evento.rows[0];
      if (eventoData.boletos_disponibles < cantidad) throw new Error('Boletos insuficientes');

      // Generar código único
      const codigoUnico = crypto.randomBytes(8).toString('hex').toUpperCase();

      // Obtener nombre del usuario
      const userData = await client.query('SELECT nombre FROM cliente WHERE id_cliente = $1', [userId]);
      const nombre_usuario = userData.rows[0].nombre;

      // Generar HTML del boleto (usando la función exportada)
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

      // Insertar boleto
      const boleto = await client.query(
        `INSERT INTO boletos (id_evento, id_cliente, zona, asiento, codigo_unico, estatus, tipo_precio, boleto_html)
         VALUES ($1,$2,$3,$4,$5,'activo',$6,$7) RETURNING id_boleto`,
        [eventoId, userId, zona || 'General', asiento || 'Libre', codigoUnico, tipoPrecio || 'normal', boletoHTML]
      );
      const boletoId = boleto.rows[0].id_boleto;

      // Actualizar disponibilidad
      await client.query('UPDATE evento SET boletos_disponibles = boletos_disponibles - $1 WHERE id_evento = $2', [cantidad, eventoId]);

      // Registrar venta
      const referencia = `REF${codigoUnico.slice(0,6)}`;
      await client.query(
        `INSERT INTO venta (id_cliente, id_evento, id_boleto, fecha_venta, hora_venta, precio_pagado, referencia_boleto)
         VALUES ($1,$2,$3,CURRENT_DATE,CURRENT_TIME,$4,$5)`,
        [userId, eventoId, boletoId, precioUnitario * cantidad, referencia]
      );

      // Registrar transacción
      await client.query(
        `INSERT INTO transacciones (id_cliente, id_boleto, fecha_transaccion, monto, estado)
         VALUES ($1,$2,CURRENT_DATE,$3,'completado')`,
        [userId, boletoId, precioUnitario * cantidad]
      );

      await client.query('COMMIT');
      console.log(`✅ Boleto ${codigoUnico} creado para usuario ${userId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error al guardar boleto en webhook:', error);
    } finally {
      client.release();
    }
  }

  res.json({ received: true });
};

module.exports = { crearSesionPago, webhook };