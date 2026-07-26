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
 * Extrae el CURP del texto (más robusto)
 */
function extraerCURP(texto) {
  if (!texto) return null;
  // Buscar la palabra "CURP" y capturar el siguiente token de 18 caracteres alfanuméricos (incluye Ñ)
  const regexCURP = /CURP\s*[:.]?\s*([A-ZÑ0-9]{18})/i;
  let match = texto.match(regexCURP);
  if (match) return match[1].toUpperCase();
  
  // Buscar el patrón clásico de CURP (4 letras, 6 dígitos, 6 alfanuméricos, 1 dígito)
  const regexPatron = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
  match = texto.match(regexPatron);
  if (match) return match[1].toUpperCase();
  
  return null;
}

/**
 * Extrae el nombre completo del texto (mejorado)
 */
function extraerNombre(texto) {
  if (!texto) return null;
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Buscar línea que contenga "NOMBRE" y capturar el texto después de "NOMBRE"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toUpperCase().includes('NOMBRE')) {
      // Si la línea tiene más texto después de NOMBRE, tomarlo
      const partes = line.split(/NOMBRE\s*[:.]?\s*/i);
      if (partes.length > 1 && partes[1].length > 3) {
        return partes[1].trim();
      }
      // Si no, buscar en las siguientes líneas que estén en mayúsculas y tengan más de 3 palabras
      let nombreCompleto = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const siguiente = lines[j];
        // Si la línea tiene mayúsculas y al menos 3 palabras, agregar
        if (siguiente.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/) && siguiente.split(/\s+/).length >= 2) {
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
  
  // Si no encontró con NOMBRE, buscar cualquier línea con mayúsculas y muchas palabras
  for (let line of lines) {
    if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{15,}$/) && line.split(/\s+/).length >= 3) {
      return line;
    }
  }
  
  return null;
}

/**
 * Extrae la fecha de nacimiento (mejorado)
 */
function extraerFechaNacimiento(texto) {
  if (!texto) return null;
  // Buscar "FECHA" o "NACIMIENTO" y luego capturar una fecha
  const regexFecha = /(?:FECHA\s*DE\s*NACIMIENTO|NACIMIENTO|FECHA)\s*[:.]?\s*(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*\d{4})/i;
  let match = texto.match(regexFecha);
  if (match) {
    const fecha = match[1].replace(/\s/g, '');
    const partes = fecha.split(/[/-]/);
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return fecha;
  }
  
  // Buscar cualquier fecha en formato DD/MM/AAAA o DD-MM-AAAA
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
 * Extrae el sexo (mejorado)
 */
function extraerSexo(texto) {
  if (!texto) return null;
  const textoUpper = texto.toUpperCase();
  // Buscar "SEXO" y luego M o F
  const regexSexo = /SEXO\s*[:.]?\s*([MF])/i;
  let match = texto.match(regexSexo);
  if (match) return match[1].toUpperCase();
  
  if (textoUpper.includes('MASCULINO')) return 'M';
  if (textoUpper.includes('FEMENINO')) return 'F';
  if (textoUpper.includes('HOMBRE')) return 'M';
  if (textoUpper.includes('MUJER')) return 'F';
  
  return null;
}

/**
 * Valida los datos extraídos con OCR contra los datos ingresados (más flexible)
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
  
  // Coincidencias (flexibles)
  const curpCoincide = curpEncontrado && curpEncontrado === datosUsuario.curp;
  
  // Nombre: si el OCR encontró algo y está contenido en el nombre del usuario (ignorando mayúsculas y espacios)
  const nombreCoincide = nombreEncontrado && datosUsuario.nombre_completo.toUpperCase().replace(/\s/g, '').includes(nombreEncontrado.toUpperCase().replace(/\s/g, ''));
  
  // Fecha: comparar sin espacios
  const fechaCoincide = fechaEncontrada && datosUsuario.fecha_nacimiento.replace(/\s/g, '').includes(fechaEncontrada.replace(/\s/g, ''));
  
  // Sexo: si el OCR encontró sexo, comparar
  const sexoCoincide = sexoEncontrado && (!datosUsuario.sexo || sexoEncontrado === datosUsuario.sexo);
  
  // Puntaje ponderado: CURP es lo más importante (50%), nombre (30%), fecha (15%), sexo (5%)
  let puntaje = 0;
  if (curpCoincide) puntaje += 50;
  if (nombreCoincide) puntaje += 30;
  if (fechaCoincide) puntaje += 15;
  if (sexoCoincide) puntaje += 5;
  
  // Si no se encontró sexo, redistribuir su peso
  if (!sexoEncontrado && (curpCoincide || nombreCoincide || fechaCoincide)) {
    puntaje = Math.min(puntaje + 5, 100);
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