const Tesseract = require('tesseract.js');
const path = require('path');
const sharp = require('sharp');

/**
 * Preprocesa la imagen para mejorar el OCR (aumenta contraste y escala)
 */
async function preprocesarImagen(imagenPath) {
  try {
    const outputPath = imagenPath.replace(/\.(jpe?g|png|webp)$/i, '_processed.jpg');
    await sharp(imagenPath)
      .resize(1200, 800, { fit: 'inside' })
      .grayscale()
      .normalize() // Aumenta contraste
      .sharpen()
      .toFile(outputPath);
    return outputPath;
  } catch (err) {
    console.warn('⚠️ No se pudo preprocesar la imagen, se usará la original:', err.message);
    return imagenPath;
  }
}

/**
 * Extrae texto de una imagen usando Tesseract.js (OCR)
 */
async function extraerTextoDeImagen(imagenPath, idioma = 'spa') {
  try {
    console.log('📖 Extrayendo texto de la imagen del INE...');
    console.log('📸 Ruta de la imagen:', imagenPath);

    // Preprocesar para mejorar OCR
    const imagenProcesada = await preprocesarImagen(imagenPath);
    console.log('🔧 Imagen preprocesada:', imagenProcesada);

    const result = await Tesseract.recognize(imagenProcesada, idioma, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`📊 Progreso OCR: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    const texto = result.data.text;
    console.log('📝 Texto extraído (OCR):');
    console.log('--- INICIO DEL TEXTO ---');
    console.log(texto);
    console.log('--- FIN DEL TEXTO ---');
    
    // Limpiar archivo procesado si es diferente al original
    if (imagenProcesada !== imagenPath && require('fs').existsSync(imagenProcesada)) {
      require('fs').unlinkSync(imagenProcesada);
    }
    
    return texto;
  } catch (error) {
    console.error('❌ Error en OCR:', error);
    return null;
  }
}

/**
 * Extrae el CURP del texto del INE (busca varios patrones)
 */
function extraerCURP(texto) {
  if (!texto) return null;
  // Busca patrones de CURP: 4 letras + 6 dígitos + 6 alfanuméricos + 1 dígito
  const regexes = [
    /[A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]/,
    /[A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9]/
  ];
  for (const regex of regexes) {
    const match = texto.match(regex);
    if (match) return match[0];
  }
  return null;
}

/**
 * Extrae el nombre del texto del INE (busca "NOMBRE" o líneas de mayúsculas)
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
  
  // Buscar líneas con mayúsculas que parezcan nombre (3+ palabras)
  for (let line of lines) {
    if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/)) {
      return line;
    }
  }
  
  // Si no, buscar cualquier línea con más de 3 palabras y mayúsculas
  for (let line of lines) {
    const palabras = line.split(/\s+/);
    if (palabras.length >= 3 && line.match(/^[A-ZÁÉÍÓÚÑ\s]+$/)) {
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
  // Busca patrones: DD/MM/AAAA, DD-MM-AAAA, DD/MM/AA
  const regexes = [
    /(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*\d{4})/,
    /(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*\d{2})/
  ];
  for (const regex of regexes) {
    const match = texto.match(regex);
    if (match) {
      let partes = match[1].replace(/\s/g, '').split(/[/-]/);
      if (partes.length === 3) {
        // Si el año tiene 2 dígitos, asumir 20xx
        if (partes[2].length === 2) {
          partes[2] = '20' + partes[2];
        }
        return `${partes[2]}-${partes[1]}-${partes[0]}`;
      }
      return match[1];
    }
  }
  return null;
}

/**
 * Extrae el sexo del texto del INE
 */
function extraerSexo(texto) {
  if (!texto) return null;
  const textoUpper = texto.toUpperCase();
  // Buscar palabras clave
  if (textoUpper.includes('SEXO') || textoUpper.includes('SEX')) {
    const lines = texto.split('\n').map(l => l.trim());
    for (let line of lines) {
      const upper = line.toUpperCase();
      if (upper.includes('SEXO') || upper.includes('SEX')) {
        if (upper.includes('M') || upper.includes('H') || upper.includes('MASC')) return 'M';
        if (upper.includes('F') || upper.includes('FEM')) return 'F';
      }
    }
  }
  // Buscar en todo el texto
  if (textoUpper.includes('MASCULINO')) return 'M';
  if (textoUpper.includes('FEMENINO')) return 'F';
  return null;
}

/**
 * Valida los datos extraídos con OCR contra los datos ingresados por el usuario
 * Usa coincidencia flexible (tolera diferencias en mayúsculas/minúsculas, espacios)
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
  
  // Comparación flexible
  const curpCoincide = curpEncontrado && curpEncontrado === datosUsuario.curp;
  
  // Nombre: coincide si el nombre OCR está contenido en el nombre del usuario (ignorando mayúsculas)
  const nombreCoincide = nombreEncontrado && datosUsuario.nombre_completo.toUpperCase().includes(nombreEncontrado.toUpperCase());
  
  // Fecha: comparar sin espacios
  const fechaCoincide = fechaEncontrada && datosUsuario.fecha_nacimiento.replace(/\s/g, '').includes(fechaEncontrada.replace(/\s/g, ''));
  
  // Sexo: si el OCR encontró sexo, comparar; si no, no se penaliza
  const sexoCoincide = sexoEncontrado && (!datosUsuario.sexo || sexoEncontrado === datosUsuario.sexo);

  // Puntaje ponderado (sexo solo si se encontró)
  let puntaje = 0;
  if (curpCoincide) puntaje += 40;
  if (nombreCoincide) puntaje += 30;
  if (fechaCoincide) puntaje += 20;
  if (sexoCoincide) puntaje += 10;
  // Si no se encontró sexo, repartir su peso entre los otros campos
  if (!sexoEncontrado && (curpCoincide || nombreCoincide || fechaCoincide)) {
    puntaje = Math.min(puntaje + 10, 100); // dar un pequeño bonus
  }

  console.log(`📊 Puntaje total: ${puntaje}%`);

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
    puntaje: Math.min(puntaje, 100)
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