const Tesseract = require('tesseract.js');
const path = require('path');

async function extraerTextoDeImagen(imagenPath) {
  try {
    console.log('📖 Extrayendo texto de la imagen del INE...');
    const result = await Tesseract.recognize(imagenPath, 'spa', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`📊 Progreso OCR: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    const texto = result.data.text;
    console.log('📝 Texto extraído:', texto);
    return texto;
  } catch (error) {
    console.error('❌ Error en OCR:', error);
    return null;
  }
}

function extraerCURP(texto) {
  const regex = /[A-Z]{4}[0-9]{6}[A-Z0-9]{8}/;
  const match = texto.match(regex);
  return match ? match[0] : null;
}

function extraerNombre(texto) {
  // Busca patrones como "NOMBRE: ..." o "NOMBRE ..."
  const regex = /NOMBRE\s*[:.]?\s*([A-ZÁÉÍÓÚÑ\s]+)/i;
  const match = texto.match(regex);
  if (match) return match[1].trim();
  // Si no, intenta buscar una línea con mayúsculas y espacios
  const lines = texto.split('\n').map(l => l.trim());
  for (let line of lines) {
    if (line.length > 10 && line.match(/^[A-ZÁÉÍÓÚÑ\s]+$/)) {
      return line;
    }
  }
  return null;
}

function extraerFechaNacimiento(texto) {
  // Busca patrones de fecha como DD/MM/AAAA o DD-MM-AAAA
  const regex = /(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*\d{4})/;
  const match = texto.match(regex);
  if (match) return match[1];
  return null;
}

function validarDatosConOCR(textoOCR, datosUsuario) {
  const curpEncontrado = extraerCURP(textoOCR);
  const nombreEncontrado = extraerNombre(textoOCR);
  const fechaEncontrada = extraerFechaNacimiento(textoOCR);
  
  const curpCoincide = curpEncontrado && curpEncontrado === datosUsuario.curp;
  const nombreCoincide = nombreEncontrado && datosUsuario.nombre_completo.toLowerCase().includes(nombreEncontrado.toLowerCase());
  const fechaCoincide = fechaEncontrada && datosUsuario.fecha_nacimiento.includes(fechaEncontrada.replace(/\s/g, ''));

  return {
    curpCoincide,
    nombreCoincide,
    fechaCoincide,
    curpEncontrado,
    nombreEncontrado,
    fechaEncontrada,
    textoExtraido: textoOCR
  };
}

module.exports = { extraerTextoDeImagen, validarDatosConOCR };