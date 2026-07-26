const Tesseract = require('tesseract.js');
const path = require('path');

/**
 * Extrae texto de una imagen usando Tesseract.js (OCR)
 * @param {string} imagenPath - Ruta de la imagen
 * @param {string} idioma - 'spa' para español, 'eng' para inglés
 * @returns {Promise<string>} - Texto extraído
 */
async function extraerTextoDeImagen(imagenPath, idioma = 'spa') {
  try {
    console.log('📖 Extrayendo texto de la imagen del INE...');
    console.log('📸 Ruta de la imagen:', imagenPath);

    const result = await Tesseract.recognize(imagenPath, idioma, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`📊 Progreso OCR: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    const texto = result.data.text;
    console.log('📝 Texto extraído (OCR):', texto);
    return texto;
  } catch (error) {
    console.error('❌ Error en OCR:', error);
    return null;
  }
}

/**
 * Extrae el CURP del texto del INE
 */
function extraerCURP(texto) {
  if (!texto) return null;
  // Busca patrones de CURP: 4 letras + 6 dígitos + 6 alfanuméricos + 1 dígito
  const regex = /[A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]/;
  const match = texto.match(regex);
  return match ? match[0] : null;
}

/**
 * Extrae el nombre del texto del INE
 */
function extraerNombre(texto) {
  if (!texto) return null;
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Buscar línea que contenga "NOMBRE" o "NOMBRE(S)"
  for (let line of lines) {
    if (line.includes('NOMBRE')) {
      const nombrePart = line.replace(/NOMBRE\s*[:.]?\s*/i, '');
      if (nombrePart.length > 3) return nombrePart.trim();
    }
  }
  
  // Si no, buscar líneas con mayúsculas que parezcan nombre (3+ palabras)
  for (let line of lines) {
    if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/)) {
      return line;
    }
  }
  
  return null;
}

/**
 * Extrae la fecha de nacimiento del texto del INE
 */
function extraerFechaNacimiento(texto) {
  if (!texto) return null;
  // Busca patrones de fecha: DD/MM/AAAA o DD-MM-AAAA
  const regex = /(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*\d{4})/;
  const match = texto.match(regex);
  if (match) {
    // Convertir a formato YYYY-MM-DD
    const partes = match[1].replace(/\s/g, '').split(/[/-]/);
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return match[1];
  }
  return null;
}

/**
 * Extrae el sexo del texto del INE
 */
function extraerSexo(texto) {
  if (!texto) return null;
  const textoUpper = texto.toUpperCase();
  if (textoUpper.includes('SEXO') || textoUpper.includes('SEX')) {
    const lines = texto.split('\n').map(l => l.trim());
    for (let line of lines) {
      if (line.toUpperCase().includes('SEXO') || line.toUpperCase().includes('SEX')) {
        if (line.includes('M') || line.includes('H') || line.includes('MASC')) return 'M';
        if (line.includes('F') || line.includes('FEM')) return 'F';
      }
    }
  }
  return null;
}

/**
 * Valida los datos extraídos con OCR contra los datos ingresados por el usuario
 */
function validarDatosConOCR(textoOCR, datosUsuario) {
  const curpEncontrado = extraerCURP(textoOCR);
  const nombreEncontrado = extraerNombre(textoOCR);
  const fechaEncontrada = extraerFechaNacimiento(textoOCR);
  const sexoEncontrado = extraerSexo(textoOCR);
  
  console.log('🔍 Comparación OCR vs Usuario:');
  console.log(`   CURP OCR: ${curpEncontrado} vs Usuario: ${datosUsuario.curp}`);
  console.log(`   Nombre OCR: ${nombreEncontrado} vs Usuario: ${datosUsuario.nombre_completo}`);
  console.log(`   Fecha OCR: ${fechaEncontrada} vs Usuario: ${datosUsuario.fecha_nacimiento}`);
  console.log(`   Sexo OCR: ${sexoEncontrado} vs Usuario: ${datosUsuario.sexo || 'No especificado'}`);
  
  const curpCoincide = curpEncontrado && curpEncontrado === datosUsuario.curp;
  const nombreCoincide = nombreEncontrado && datosUsuario.nombre_completo.toUpperCase().includes(nombreEncontrado.toUpperCase());
  const fechaCoincide = fechaEncontrada && datosUsuario.fecha_nacimiento.includes(fechaEncontrada.replace(/\s/g, ''));
  const sexoCoincide = sexoEncontrado && (!datosUsuario.sexo || sexoEncontrado === datosUsuario.sexo);

  return {
    curpCoincide,
    nombreCoincide,
    fechaCoincide,
    sexoCoincide,
    curpEncontrado,
    nombreEncontrado,
    fechaEncontrada,
    sexoEncontrado,
    textoExtraido: textoOCR,
    // Porcentaje de coincidencia (para decidir si es válido)
    puntaje: (curpCoincide ? 40 : 0) + (nombreCoincide ? 30 : 0) + (fechaCoincide ? 20 : 0) + (sexoCoincide ? 10 : 0)
  };
}

module.exports = {
  extraerTextoDeImagen,
  extraerCURP,
  extraerNombre,
  extraerFechaNacimiento,
  extraerSexo,
  validarDatosConOCR
};