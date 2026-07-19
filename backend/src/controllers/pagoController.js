const pool = require('../config/database');
const { encrypt } = require('../utils/encrypt');

const procesarPago = async (req, res) => {
  const { eventoId, cantidad, zona, asiento, num_tarjeta, cv, factor_tarjeta, tipoPrecio } = req.body;
  try {
    // Verificar INE y facial
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

    // Cifrar datos de tarjeta
    const encryptedCard = encrypt(num_tarjeta);
    const encryptedCV = encrypt(cv);
    const encryptedFactor = encrypt(factor_tarjeta);

    // Guardar datos de tarjeta
    await pool.query(
      `UPDATE cliente SET num_tarjeta = $1, cv = $2, factor_tarjeta = $3, fecha_inf = CURRENT_DATE, valida_inf = true
       WHERE id_cliente = $4`,
      [JSON.stringify(encryptedCard), JSON.stringify(encryptedCV), JSON.stringify(encryptedFactor), req.userId]
    );

    res.json({ success: true, mensaje: 'Pago procesado correctamente' });
  } catch (error) {
    console.error('❌ Error en procesarPago:', error);
    res.status(500).json({ error: 'Error al procesar pago' });
  }
};

module.exports = { procesarPago };