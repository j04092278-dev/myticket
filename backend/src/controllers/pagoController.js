const pool = require('../config/database');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const crypto = require('crypto');
const { generarBoletoHTML } = require('./boletoController');

// Inicializar cliente de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// ===== CREAR PREFERENCIA DE PAGO (CHECKOUT PRO) =====
const crearPreferenciaPago = async (req, res) => {
  const { eventoId, cantidad, zona, asiento, tipoPrecio } = req.body;
  try {
    // 1. Verificar INE del usuario
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

    // 2. Obtener evento
    const evento = await pool.query('SELECT * FROM evento WHERE id_evento = $1', [eventoId]);
    if (evento.rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    const eventoData = evento.rows[0];

    // 3. Calcular precio
    const precioUnitario = (tipoPrecio === 'preventa' && eventoData.es_preventa && eventoData.precio_preventa)
      ? eventoData.precio_preventa
      : eventoData.precio_normal;

    const total = precioUnitario * cantidad;

    // 4. Obtener nombre del usuario
    const userData = await pool.query('SELECT nombre FROM cliente WHERE id_cliente = $1', [req.userId]);
    const nombre_usuario = userData.rows[0].nombre;

    // 5. Crear preferencia de pago
    const preference = new Preference(client);
    const preferenceRequest = {
      body: {
        items: [{
          id: `evento_${eventoId}`,
          title: eventoData.nombre_evento,
          description: `${cantidad} boleto(s) - Zona: ${zona || 'General'}`,
          quantity: cantidad,
          currency_id: 'MXN', // o 'ARS', 'BRL', 'COP', etc.
          unit_price: parseFloat(precioUnitario),
        }],
        payer: {
          email: req.userEmail,
          name: nombre_usuario,
        },
        // URLs de redirección después del pago
        back_urls: {
          success: `${process.env.FRONTEND_URL || 'https://myticket.onrender.com'}/mis-boletos`,
          failure: `${process.env.FRONTEND_URL || 'https://myticket.onrender.com'}/eventos`,
          pending: `${process.env.FRONTEND_URL || 'https://myticket.onrender.com'}/eventos`,
        },
        auto_return: 'approved', // Vuelve automáticamente si el pago es aprobado
        notification_url: process.env.MP_WEBHOOK_URL || '', // Opcional, para webhook
        external_reference: JSON.stringify({
          userId: req.userId,
          eventoId: eventoId,
          cantidad: cantidad,
          zona: zona || 'General',
          asiento: asiento || 'Libre',
          tipoPrecio: tipoPrecio || 'normal',
          precioUnitario: precioUnitario
        }),
        // Metadatos adicionales (opcional)
        metadata: {
          userId: req.userId.toString(),
          eventoId: eventoId.toString(),
        },
        // Configurar pago sin necesidad de tarjeta guardada
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12, // Máximo de cuotas
        },
      }
    };

    const response = await preference.create(preferenceRequest);
    
    // Devolver la URL de checkout
    // `init_point` es para producción, `sandbox_init_point` para pruebas
    const checkoutUrl = process.env.NODE_ENV === 'production' 
      ? response.init_point 
      : response.sandbox_init_point || response.init_point;

    res.json({ url: checkoutUrl });
  } catch (error) {
    console.error('❌ Error al crear preferencia de pago:', error);
    res.status(500).json({ error: 'Error al procesar el pago: ' + error.message });
  }
};

// ===== WEBHOOK PARA CONFIRMAR PAGO EXITOSO =====
const webhook = async (req, res) => {
  try {
    // Mercado Pago envía el body como JSON
    const { type, data, action } = req.body;

    console.log('📥 Webhook recibido:', { type, action, data });

    // Solo procesar pagos aprobados
    if (type === 'payment' && action === 'payment.updated') {
      const paymentId = data.id;
      
      // Opcional: Verificar el pago con la API de Mercado Pago
      // const payment = await getPayment(paymentId);
      // if (payment.status !== 'approved') return res.json({ received: true });

      // Por ahora, asumimos que el pago fue aprobado
      // Buscar la preferencia asociada al pago
      // Nota: En el webhook de Mercado Pago no viene el external_reference directamente
      // Tendrías que consultar el pago con el paymentId para obtenerlo.
      // Simplificamos: guardamos el external_reference en una variable temporal
      // o usamos un enfoque alternativo (como guardar en sesión).

      // Por ahora, respondemos OK
      console.log(`✅ Webhook procesado para pago ${paymentId}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(500).json({ error: 'Error al procesar webhook' });
  }
};

module.exports = { crearPreferenciaPago, webhook };