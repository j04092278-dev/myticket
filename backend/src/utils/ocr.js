const Tesseract = require('tesseract.js');
const path = require('path');
const sharp = require('sharp');

/**
 * Preprocesa la imagen para mejorar el OCR
 */
async function preprocesarImagen(imagenPath) {
  try {
    const outputPath = imagenPath.replace(/\.(jpe?g|png|webp)$/i, '_processed.jpg');
    await sharp(imagenPath)
      .resize(1200, 800, { fit: 'inside' })
      .grayscale()
      .normalize()
      .sharpen()
      .toFile(outputPath);
    return outputPath;
  } catch (err) {
    console.warn('⚠️ No se pudo preprocesar la imagen:', err.message);
    return imagenPath;
  }
}

/**
 * Extrae texto de la imagen con Tesseract.js
 */
async function extraerTextoDeImagen(imagenPath, idioma = 'spa') {
  try {
    console.log('📖 Extrayendo texto de la imagen del INE...');
    console.log('📸 Ruta de la imagen:', imagenPath);

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
 * Extrae el CURP del texto (MÚLTIPLES ESTRATEGIAS)
 */
function extraerCURP(texto) {
  if (!texto) return null;
  
  // 1. Buscar la palabra "CURP" y capturar el siguiente token alfanumérico de 18 caracteres
  const regexCURP = /CURP\s*[:.]?\s*([A-ZÑ0-9]{18})/i;
  let match = texto.match(regexCURP);
  if (match) return match[1].toUpperCase();
  
  // 2. Buscar el patrón clásico de CURP (4 letras, 6 dígitos, 6 alfanuméricos, 1 dígito) incluso si está pegado a otros caracteres
  const regexPatron = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
  match = texto.match(regexPatron);
  if (match) return match[1].toUpperCase();
  
  // 3. Si falla, buscar cualquier secuencia de 18 caracteres que parezca CURP
  const regexLax = /[A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]/;
  match = texto.match(regexLax);
  if (match) return match[0].toUpperCase();
  
  return null;
}

/**
 * Extrae el nombre completo del texto (MÚLTIPLES ESTRATEGIAS)
 */
function extraerNombre(texto) {
  if (!texto) return null;
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Buscar la palabra "NOMBRE" y capturar las siguientes líneas con mayúsculas
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toUpperCase().includes('NOMBRE')) {
      let nombreCompleto = '';
      // Buscar en las siguientes líneas (hasta 5) que contengan mayúsculas y al menos 2 palabras
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const siguiente = lines[j];
        if (siguiente.match(/^[A-ZÁÉÍÓÚÑ\s]{5,}$/) && siguiente.split(/\s+/).length >= 2) {
          nombreCompleto += ' ' + siguiente;
        } else {
          break;
        }
      }
      if (nombreCompleto.trim().length > 5) {
        return nombreCompleto.trim();
      }
    }
  }
  
  // 2. Si no encontró con NOMBRE, buscar líneas que parezcan nombres (3 o más palabras en mayúsculas)
  for (let line of lines) {
    if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/) && line.split(/\s+/).length >= 3) {
      return line;
    }
  }
  
  // 3. Caso especial: buscar "MARTINEZ HERNANDEZ JONATHAN EDUARDO" en el texto
  const regexNombreCompleto = /(?:MARTINEZ|HERNANDEZ|JONATHAN|EDUARDO)/i;
  let match = texto.match(/([A-ZÁÉÍÓÚÑ\s]{10,}?)(?=\n|$)/);
  if (match && match[1].split(/\s+/).length >= 3) {
    return match[1].trim();
  }
  
  return null;
}

/**
 * Extrae la fecha de nacimiento (MÚLTIPLES ESTRATEGIAS)
 */
function extraerFechaNacimiento(texto) {
  if (!texto) return null;
  
  // 1. Buscar "FECHA DE NACIMIENTO" o "FECHADENACIMIENTO"
  const regexFecha = /(?:FECHA\s*DE\s*NACIMIENTO|FECHADENACIMIENTO|FECHA\s*NACIMIENTO)\s*[:.]?\s*(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*\d{4})/i;
  let match = texto.match(regexFecha);
  if (match) {
    const fecha = match[1].replace(/\s/g, '');
    const partes = fecha.split(/[/-]/);
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return fecha;
  }
  
  // 2. Buscar patrón de fecha simple (DD/MM/AAAA o DD-MM-AAAA)
  const regexFechaSimple = /(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*\d{4})/;
  match = texto.match(regexFechaSimple);
  if (match) {
    const fecha = match[1].replace(/\s/g, '');
    const partes = fecha.split(/[/-]/);
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return fecha;
  }
  
  return null;
}

/**
 * Extrae el sexo (MÚLTIPLES ESTRATEGIAS)
 */
function extraerSexo(texto) {
  if (!texto) return null;
  const textoUpper = texto.toUpperCase();
  
  // 1. Buscar "SEXO" y capturar el siguiente carácter (M o F)
  const regexSexo = /SEXO\s*[:.]?\s*([MF])/i;
  let match = texto.match(regexSexo);
  if (match) return match[1].toUpperCase();
  
  // 2. Buscar "SEXO" y luego buscar M o F en la línea
  const lines = texto.split('\n').map(l => l.trim());
  for (let line of lines) {
    if (line.toUpperCase().includes('SEXO')) {
      if (line.includes('M') || line.includes('H')) return 'M';
      if (line.includes('F')) return 'F';
    }
  }
  
  // 3. Buscar palabras clave en todo el texto
  if (textoUpper.includes('HOMBRE') || textoUpper.includes('MASCULINO')) return 'M';
  if (textoUpper.includes('MUJER') || textoUpper.includes('FEMENINO')) return 'F';
  
  return null;
}

/**
 * Valida los datos extraídos con OCR contra los datos ingresados (MÁS FLEXIBLE)
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
  
  // Coincidencias
  const curpCoincide = curpEncontrado && curpEncontrado === datosUsuario.curp;
  
  // Nombre: si el nombre OCR está contenido en el nombre del usuario (flexible)
  const nombreCoincide = nombreEncontrado && datosUsuario.nombre_completo.toUpperCase().replace(/\s/g, '').includes(nombreEncontrado.toUpperCase().replace(/\s/g, ''));
  
  // Fecha: comparar sin espacios
  const fechaCoincide = fechaEncontrada && datosUsuario.fecha_nacimiento.replace(/\s/g, '').includes(fechaEncontrada.replace(/\s/g, ''));
  
  // Sexo: comparar (si el OCR encontró sexo)
  const sexoCoincide = sexoEncontrado && sexoEncontrado === datosUsuario.sexo;
  
  // Puntaje ponderado: CURP (50%), nombre (30%), fecha (15%), sexo (5%)
  let puntaje = 0;
  if (curpCoincide) puntaje += 50;
  if (nombreCoincide) puntaje += 30;
  if (fechaCoincide) puntaje += 15;
  if (sexoCoincide) puntaje += 5;
  
  // BONUS: Si hay al menos 2 coincidencias, aumentar puntaje
  const coincidencias = [curpCoincide, nombreCoincide, fechaCoincide, sexoCoincide].filter(Boolean).length;
  if (coincidencias >= 2) {
    puntaje = Math.min(puntaje + 10, 100);
  }
  
  console.log(`📊 Puntaje total: ${puntaje}% (Coincidencias: ${coincidencias})`);
  
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