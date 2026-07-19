const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  console.log('✅ Email configurado');
} else {
  console.log('⚠️ Email no configurado');
}

const sendTicketEmail = async (email, nombre, boletoHTML, boletoURL, eventoNombre, codigo) => {
  if (!transporter) {
    console.log('⚠️ Email no enviado: no hay configuración');
    return;
  }
  const html = `
    <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0A0A0A; color: #FFFFFF; padding: 20px; border-radius: 10px; border: 1px solid #ff0000;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #ff3333; font-family: 'Orbitron', sans-serif;">🎫 MyTicket</h1>
        <p style="color: #9CA3AF; border-bottom: 1px solid #2D2D2D; padding-bottom: 15px;">¡Tu boleto está listo!</p>
      </div>
      
      <p style="color: #9CA3AF;">Hola <strong style="color: #ff3333;">${nombre}</strong>,</p>
      <p style="color: #9CA3AF;">Has comprado un boleto para <strong style="color: #ff3333;">${eventoNombre}</strong>.</p>
      <p style="color: #9CA3AF;">Código de boleto: <strong style="color: #ff0000; font-size: 1.2rem; letter-spacing: 2px;">${codigo}</strong></p>
      
      <div style="margin: 20px 0; padding: 15px; background: #1A0505; border-radius: 10px; border-left: 4px solid #ff0000;">
        <p style="color: #9CA3AF; margin: 5px 0;">📌 <strong>Presenta este boleto en la entrada del evento.</strong></p>
        <p style="color: #6B7280; font-size: 0.8rem; margin: 5px 0;">Puedes descargarlo o mostrarlo desde tu dispositivo móvil.</p>
      </div>

      <!-- BOLETO VISUAL -->
      <div style="margin: 20px 0; background: transparent;">
        ${boletoHTML}
      </div>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${boletoURL}" style="display: inline-block; background: linear-gradient(135deg, #cc0000, #ff0000); color: white; padding: 12px 30px; border-radius: 30px; text-decoration: none; font-weight: bold; font-family: 'Poppins', sans-serif;">⬇️ Descargar Boleto</a>
      </div>
      
      <p style="color: #6B7280; font-size: 0.8rem; border-top: 1px solid #2D2D2D; padding-top: 15px; margin-top: 20px;">
        Este es un correo automático. No respondas a este mensaje.<br>
        © 2025 MyTicket – Tu plataforma de confianza
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `🎫 Tu boleto para ${eventoNombre}`,
      html,
    });
    console.log(`✅ Email enviado a ${email}`);
  } catch (error) {
    console.error('❌ Error enviando email:', error);
  }
};

module.exports = { sendTicketEmail };