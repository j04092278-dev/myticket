const pool = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
const { generarBoletoHTML } = require('./boletoController');

// ===== CREAR SESIÓN DE PAGO =====
const crearSesionPago = async (req, res) => {
  const { eventoId, cantidad, zona, asiento, tipoPrecio } = req.body;
  try {
    console.log('🔑 STRIPE_SECRET_KEY cargada:', process.env.STRIPE_SECRET_KEY ? '✅ Sí' : '❌ No');

    // Verificar INE
    const ineCheck = await pool.query(
      'SELECT validado, facial_verificado FROM ine_validacion WHERE id_cliente = $1',
      [req.userId]
    );
    if (ineCheck.rows.length === 0 || !ineCheck.rows[0].validado) {
      return res.status(403).json({ error: 'Debes validar tu INE antes de pagar' });
    }
    if (!ineCheck.rows[0].facial_verificado) {
      return res.status(403).json({ error: 'La verificación facial no ha sido exitosa.' });
    }

    // Obtener evento
    const evento = await pool.query('SELECT * FROM evento WHERE id_evento = $1', [eventoId]);
    if (evento.rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    const eventoData = evento.rows[0];

    // Calcular precio
    const precioUnitario = (tipoPrecio === 'preventa' && eventoData.es_preventa && eventoData.precio_preventa)
      ? eventoData.precio_preventa
      : eventoData.precio_normal;

    const total = precioUnitario * cantidad;
    const totalCentavos = Math.round(total * 100);

    // Validar imagen
    let imagenes = [];
    if (eventoData.imagen_url && eventoData.imagen_url.startsWith('http')) {
      imagenes = [eventoData.imagen_url];
    }

    const baseUrl = process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://myticket-wqrq.onrender.com';
    console.log(`🌐 URL base para redirección: ${baseUrl}`);

    // Crear sesión en Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: {
            name: eventoData.nombre_evento,
            description: `${cantidad} boleto(s) - Zona: ${zona || 'General'}`,
            images: imagenes,
          },
          unit_amount: totalCentavos,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${baseUrl}/mis-boletos?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/eventos`,
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

    console.log('✅ Sesión de Stripe creada:', session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Error al crear sesión de pago:', error);
    res.status(500).json({ error: 'Error al procesar el pago: ' + error.message });
  }
};

// ===== CONFIRMAR PAGO (LLAMADO DESDE EL FRONTEND) =====
const confirmarPago = async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) {
    return res.status(400).json({ error: 'session_id requerido' });
  }

  try {
    console.log(`🔍 Confirmando pago con session_id: ${session_id}`);

    // 1. Obtener la sesión de Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'El pago no está completado' });
    }

    // 2. Obtener los datos de la sesión
    let clientReference;
    try {
      clientReference = JSON.parse(session.client_reference_id);
    } catch (e) {
      // Si no se puede parsear, intentar obtener de metadata
      clientReference = {
        userId: parseInt(session.metadata.userId),
        eventoId: parseInt(session.metadata.eventoId),
        cantidad: parseInt(session.metadata.cantidad),
        zona: 'General',
        asiento: 'Libre',
        tipoPrecio: 'normal',
        precioUnitario: 0
      };
    }

    const { userId, eventoId, cantidad, zona, asiento, tipoPrecio, precioUnitario } = clientReference;

    // 3. Guardar el boleto en la base de datos
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar disponibilidad
      const evento = await client.query('SELECT * FROM evento WHERE id_evento = $1 FOR UPDATE', [eventoId]);
      if (evento.rows.length === 0) throw new Error('Evento no existe');
      const eventoData = evento.rows[0];
      if (eventoData.boletos_disponibles < cantidad) throw new Error('Boletos insuficientes');

      // Generar código único
      const codigoUnico = crypto.randomBytes(8).toString('hex').toUpperCase();

      // Obtener nombre del usuario
      const userData = await client.query('SELECT nombre FROM cliente WHERE id_cliente = $1', [userId]);
      if (userData.rows.length === 0) throw new Error('Usuario no encontrado');
      const nombre_usuario = userData.rows[0].nombre;

      // Generar HTML del boleto
      const imagen_url = eventoData.imagen_url || null;
      const precioFinal = precioUnitario || eventoData.precio_normal;
      const boletoHTML = await generarBoletoHTML({
        codigo: codigoUnico,
        evento: eventoData.nombre_evento,
        nombre_usuario: nombre_usuario,
        fecha: eventoData.fecha_evento,
        ubicacion: eventoData.ubicacion,
        zona: zona || 'General',
        asiento: asiento || 'Libre',
        precio: precioFinal,
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
        [userId, eventoId, boletoId, precioFinal * cantidad, referencia]
      );

      // Registrar transacción
      await client.query(
        `INSERT INTO transacciones (id_cliente, id_boleto, fecha_transaccion, monto, estado)
         VALUES ($1,$2,CURRENT_DATE,$3,'completado')`,
        [userId, boletoId, precioFinal * cantidad]
      );

      await client.query('COMMIT');
      console.log(`✅ Boleto ${codigoUnico} creado para usuario ${userId}`);

      res.json({ success: true, boletoId });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error al guardar boleto:', error);
      res.status(500).json({ error: 'Error al guardar el boleto: ' + error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error al confirmar pago:', error);
    res.status(500).json({ error: 'Error al confirmar el pago: ' + error.message });
  }
};

// ===== WEBHOOK DE STRIPE =====
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

  console.log(`📩 Webhook recibido: ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`✅ Webhook: sesión ${session.id} completada`);
    // Aquí puedes llamar a la misma lógica de guardado si quieres redundancia
    // Pero la confirmación manual ya debería funcionar
  }

  res.json({ received: true });
};

module.exports = { crearSesionPago, confirmarPago, webhook };