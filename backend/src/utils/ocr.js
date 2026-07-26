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
 * EXTRAE CURP: busca un patrón de 18 caracteres (4 letras, 6 dígitos, 6 alfanuméricos, 1 dígito)
 * Ignora espacios, guiones y caracteres extra después del CURP.
 */
function extraerCURP(texto) {
  if (!texto) return null;
  const regex = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
  const match = texto.match(regex);
  return match ? match[1].toUpperCase() : null;
}

/**
 * EXTRAE INE (Clave de Elector): 18 caracteres alfanuméricos, generalmente comienza con letras
 */
function extraerINE(texto) {
  if (!texto) return null;
  // Buscar "CLAVE DE ELECTOR" y capturar el siguiente token de 18 caracteres
  const regexClave = /CLAVE\s*DE\s*ELECTOR\s*[:.]?\s*([A-Z0-9]{18})/i;
  let match = texto.match(regexClave);
  if (match) return match[1].toUpperCase();
  // Buscar cualquier token de 18 caracteres alfanuméricos que parezca INE
  const regexToken = /\b([A-Z0-9]{18})\b/;
  match = texto.match(regexToken);
  return match ? match[1].toUpperCase() : null;
}

/**
 * EXTRAE NOMBRE COMPLETO: busca "NOMBRE" y toma las siguientes líneas que parezcan nombre
 */
function extraerNombre(texto) {
  if (!texto) return null;
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Buscar "NOMBRE" y capturar el texto que sigue
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    if (line.includes('NOMBRE') || line.includes('NOMBRES')) {
      let nombrePartes = [];
      const resto = lines[i].replace(/NOMBRE\s*[:.]?\s*/i, '');
      if (resto.length > 3) nombrePartes.push(resto);
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const sigLine = lines[j];
        if (sigLine.match(/^[A-ZÁÉÍÓÚÑ\s]{3,}$/) && sigLine.split(/\s+/).length >= 2) {
          nombrePartes.push(sigLine);
        } else {
          break;
        }
      }
      if (nombrePartes.length > 0) {
        return nombrePartes.join(' ').trim();
      }
    }
  }
  
  // Si no encuentra, buscar líneas con mayúsculas y 3+ palabras
  for (let line of lines) {
    if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/)) {
      const palabras = line.split(/\s+/);
      if (palabras.length >= 3) {
        return line;
      }
    }
  }
  
  return null;
}

/**
 * EXTRAE FECHA DE NACIMIENTO
 */
function extraerFechaNacimiento(texto) {
  if (!texto) return null;
  // Buscar "FECHA" o "NACIMIENTO" y capturar la fecha cercana
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
  // Si no, buscar cualquier fecha en formato DD/MM/AAAA
  const regexSimple = /(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})/;
  match = texto.match(regexSimple);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return null;
}

/**
 * EXTRAE SEXO
 */
function extraerSexo(texto) {
  if (!texto) return null;
  // Buscar "SEXO" y capturar la letra H/M/F
  const regexSexo = /SEXO\s*[:.]?\s*([HMF])/i;
  let match = texto.match(regexSexo);
  if (match) {
    const sexo = match[1].toUpperCase();
    if (sexo === 'H') return 'M';
    return sexo;
  }
  // Buscar palabras clave
  const upper = texto.toUpperCase();
  if (upper.includes('HOMBRE') || upper.includes('MASCULINO')) return 'M';
  if (upper.includes('MUJER') || upper.includes('FEMENINO')) return 'F';
  return null;
}

/**
 * FUNCIÓN PRINCIPAL DE VALIDACIÓN: Recopila todos los datos extraídos y los compara
 */
function validarDatosConOCR(textoOCR, datosUsuario) {
  const curpEncontrado = extraerCURP(textoOCR);
  const ineEncontrado = extraerINE(textoOCR);
  const nombreEncontrado = extraerNombre(textoOCR);
  const fechaEncontrada = extraerFechaNacimiento(textoOCR);
  const sexoEncontrado = extraerSexo(textoOCR);
  
  console.log('🔍 RECOPILACIÓN DE DATOS OCR:');
  console.log(`   CURP OCR: ${curpEncontrado}`);
  console.log(`   INE OCR: ${ineEncontrado}`);
  console.log(`   Nombre OCR: ${nombreEncontrado}`);
  console.log(`   Fecha OCR: ${fechaEncontrada}`);
  console.log(`   Sexo OCR: ${sexoEncontrado}`);
  
  console.log('📝 Datos del Usuario:');
  console.log(`   CURP: ${datosUsuario.curp}`);
  console.log(`   INE: ${datosUsuario.numero_ine}`);
  console.log(`   Nombre: ${datosUsuario.nombre_completo}`);
  console.log(`   Fecha: ${datosUsuario.fecha_nacimiento}`);
  console.log(`   Sexo: ${datosUsuario.sexo}`);
  
  // Coincidencias
  const curpCoincide = curpEncontrado && curpEncontrado === datosUsuario.curp;
  const ineCoincide = ineEncontrado && ineEncontrado === datosUsuario.numero_ine;
  
  // Nombre: comparar normalizado (sin espacios, mayúsculas)
  const nombreUsuarioClean = datosUsuario.nombre_completo.toUpperCase().replace(/\s/g, '');
  const nombreOCRclean = nombreEncontrado ? nombreEncontrado.toUpperCase().replace(/\s/g, '') : '';
  const nombreCoincide = nombreOCRclean && (nombreUsuarioClean.includes(nombreOCRclean) || nombreOCRclean.includes(nombreUsuarioClean));
  
  // Fecha: comparar
  const fechaCoincide = fechaEncontrada && datosUsuario.fecha_nacimiento.replace(/\s/g, '').includes(fechaEncontrada.replace(/\s/g, ''));
  
  // Sexo: normalizar H a M
  const sexoUsuario = datosUsuario.sexo ? datosUsuario.sexo.toUpperCase() : '';
  let sexoOCR = sexoEncontrado ? sexoEncontrado.toUpperCase() : '';
  if (sexoOCR === 'H') sexoOCR = 'M';
  const sexoCoincide = sexoOCR && (sexoOCR === sexoUsuario || (sexoOCR === 'M' && sexoUsuario === 'M') || (sexoOCR === 'F' && sexoUsuario === 'F'));
  
  // Puntaje ponderado: CURP (40%), INE (30%), Nombre (20%), Fecha (10%)
  let puntaje = 0;
  if (curpCoincide) puntaje += 40;
  if (ineCoincide) puntaje += 30;
  if (nombreCoincide) puntaje += 20;
  if (fechaCoincide) puntaje += 10;
  if (sexoCoincide) puntaje += 0; // Solo informativo
  
  console.log(`📊 Puntaje total: ${puntaje}%`);
  
  return {
    curpCoincide,
    ineCoincide,
    nombreCoincide,
    fechaCoincide,
    sexoCoincide,
    curpEncontrado,
    ineEncontrado,
    nombreEncontrado,
    fechaEncontrada,
    sexoEncontrado,
    textoExtraido: textoOCR,
    puntaje: Math.min(puntaje, 100)
  };
}

module.exports = {
  extraerTextoDeImagen,
  validarDatosConOCR
};