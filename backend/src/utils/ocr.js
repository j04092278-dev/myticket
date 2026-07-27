const Tesseract = require('tesseract.js');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');

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
    
    if (imagenProcesada !== imagenPath && fs.existsSync(imagenProcesada)) {
      fs.unlinkSync(imagenProcesada);
    }
    
    return texto;
  } catch (error) {
    console.error('❌ Error en OCR:', error);
    return null;
  }
}

/**
 * LIMPIEZA DE TEXTO OCR: corrige caracteres comunes mal interpretados
 */
function limpiarTextoOCR(texto) {
  if (!texto) return '';
  let limpio = texto
    .replace(/0/g, 'O') // 0 -> O (puede ser letra O)
    .replace(/1/g, 'I') // 1 -> I
    .replace(/5/g, 'S') // 5 -> S (a veces)
    .replace(/2/g, 'Z') // 2 -> Z
    .replace(/4/g, 'A') // 4 -> A
    .replace(/6/g, 'G') // 6 -> G
    .replace(/7/g, 'T') // 7 -> T
    .replace(/8/g, 'B') // 8 -> B
    .replace(/9/g, 'P'); // 9 -> P
  // Pero los números son importantes, así que mejor solo aplicar a letras que parezcan números
  // En su lugar, hacemos una limpieza más suave: eliminar caracteres extraños
  return texto.replace(/[^A-Za-zÁÉÍÓÚÑ0-9\s\n\/-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * EXTRAE CURP: múltiples estrategias
 */
function extraerCURP(texto) {
  if (!texto) return null;
  const textoLimpio = limpiarTextoOCR(texto);
  
  // Estrategia 1: Buscar la palabra "CURP" y capturar los siguientes 18 caracteres alfanuméricos
  const regexCURP = /CURP\s*[:.]?\s*([A-Z0-9]{18})/i;
  let match = texto.match(regexCURP);
  if (match) return match[1].toUpperCase();
  
  // Estrategia 2: Buscar CURP en el texto con el patrón estándar (4 letras + 6 dígitos + 6 alfanuméricos + 1 dígito)
  const regexPatron = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
  match = texto.match(regexPatron);
  if (match) return match[1].toUpperCase();
  
  // Estrategia 3: Buscar en el texto limpio sin espacios
  const sinEspacios = texto.replace(/\s/g, '');
  const regexSinEspacios = /([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])/;
  match = sinEspacios.match(regexSinEspacios);
  if (match) return match[1].toUpperCase();
  
  return null;
}

/**
 * EXTRAE NOMBRE: múltiples estrategias
 */
function extraerNombre(texto) {
  if (!texto) return null;
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Estrategia 1: Buscar "NOMBRE" y capturar las siguientes líneas en mayúsculas
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    if (line.includes('NOMBRE') || line.includes('NOMBRES')) {
      let nombrePartes = [];
      const resto = lines[i].replace(/NOMBRE\s*[:.]?\s*/i, '');
      if (resto.length > 3 && resto.match(/^[A-ZÁÉÍÓÚÑ\s]+$/)) {
        nombrePartes.push(resto);
      }
      // Buscar en las siguientes líneas que sean mayúsculas y largas
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const sigLine = lines[j];
        if (sigLine.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/) && sigLine.split(/\s+/).length >= 2) {
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
  
  // Estrategia 2: Buscar líneas con mayúsculas y 3+ palabras
  for (let line of lines) {
    if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/)) {
      const palabras = line.split(/\s+/);
      if (palabras.length >= 3) {
        return line;
      }
    }
  }
  
  // Estrategia 3: Buscar cualquier línea con mayúsculas y que contenga apellidos comunes
  for (let line of lines) {
    if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/)) {
      return line;
    }
  }
  
  return null;
}

/**
 * EXTRAE FECHA: múltiples estrategias y corrección
 */
function extraerFechaNacimiento(texto) {
  if (!texto) return null;
  const textoLimpio = limpiarTextoOCR(texto);
  
  // Estrategia 1: Buscar "FECHA DE NACIMIENTO" o "NACIMIENTO" y capturar fecha cercana
  const regexFechaCerca = /(?:FECHA\s*DE\s*NACIMIENTO|NACIMIENTO|FECHA)\s*[:.]?\s*(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})/i;
  let match = texto.match(regexFechaCerca);
  if (match) {
    let dia = match[1].padStart(2, '0');
    let mes = match[2].padStart(2, '0');
    let anio = match[3];
    if (anio.length === 2) anio = '20' + anio;
    if (parseInt(mes) >= 1 && parseInt(mes) <= 12 && parseInt(dia) >= 1 && parseInt(dia) <= 31) {
      return `${anio}-${mes}-${dia}`;
    }
  }
  
  // Estrategia 2: Buscar cualquier fecha en el texto (DD/MM/AAAA)
  const regexFecha = /(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})/;
  match = texto.match(regexFecha);
  if (match) {
    let dia = match[1].padStart(2, '0');
    let mes = match[2].padStart(2, '0');
    let anio = match[3];
    if (anio.length === 2) anio = '20' + anio;
    if (parseInt(mes) >= 1 && parseInt(mes) <= 12 && parseInt(dia) >= 1 && parseInt(dia) <= 31) {
      return `${anio}-${mes}-${dia}`;
    }
  }
  
  // Estrategia 3: Buscar DD/MM/AA y convertir a 20xx
  const regexFechaCorta = /(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{2})/;
  match = texto.match(regexFechaCorta);
  if (match) {
    let dia = match[1].padStart(2, '0');
    let mes = match[2].padStart(2, '0');
    let anio = '20' + match[3];
    if (parseInt(mes) >= 1 && parseInt(mes) <= 12 && parseInt(dia) >= 1 && parseInt(dia) <= 31) {
      return `${anio}-${mes}-${dia}`;
    }
  }
  
  return null;
}

/**
 * EXTRAE SEXO: múltiples estrategias
 */
function extraerSexo(texto) {
  if (!texto) return null;
  const textoUpper = texto.toUpperCase();
  
  // Estrategia 1: Buscar "SEXO" y capturar la letra H/M/F cercana
  const regexSexo = /SEXO\s*[:.]?\s*([HMF])/i;
  let match = texto.match(regexSexo);
  if (match) {
    const sexo = match[1].toUpperCase();
    if (sexo === 'H') return 'M';
    return sexo;
  }
  
  // Estrategia 2: Buscar "SEXO" en línea y luego buscar H/M/F en la misma o siguiente línea
  const lines = texto.split('\n').map(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('SEXO')) {
      // Buscar en la misma línea
      const m = lines[i].match(/\b([HMF])\b/i);
      if (m) {
        const sexo = m[1].toUpperCase();
        if (sexo === 'H') return 'M';
        return sexo;
      }
      // Buscar en las siguientes 3 líneas
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const m2 = lines[j].match(/\b([HMF])\b/i);
        if (m2) {
          const sexo = m2[1].toUpperCase();
          if (sexo === 'H') return 'M';
          return sexo;
        }
      }
    }
  }
  
  // Estrategia 3: Buscar palabras clave
  if (textoUpper.includes('HOMBRE') || textoUpper.includes('MASCULINO')) return 'M';
  if (textoUpper.includes('MUJER') || textoUpper.includes('FEMENINO')) return 'F';
  
  // Estrategia 4: Buscar H o M aislada
  const matchH = texto.match(/\bH\b/);
  const matchM = texto.match(/\bM\b/);
  if (matchH && !matchM) return 'M';
  if (matchM && !matchH) return 'M'; // Por defecto, si aparece M, es masculino
  if (matchH && matchM) {
    // Si ambos aparecen, buscar contexto (cerca de SEXO)
    return null;
  }
  
  return null;
}

/**
 * VALIDA DATOS CON OCR: comparación flexible y puntaje
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
  
  // Nombre: si el nombre OCR está contenido en el nombre del usuario (ignorando mayúsculas y espacios)
  const nombreUsuarioClean = datosUsuario.nombre_completo.toUpperCase().replace(/\s/g, '');
  const nombreOCRclean = nombreEncontrado ? nombreEncontrado.toUpperCase().replace(/\s/g, '') : '';
  const nombreCoincide = nombreOCRclean && (nombreUsuarioClean.includes(nombreOCRclean) || nombreOCRclean.includes(nombreUsuarioClean));
  
  // Fecha: comparar sin espacios
  const fechaCoincide = fechaEncontrada && datosUsuario.fecha_nacimiento.replace(/\s/g, '').includes(fechaEncontrada.replace(/\s/g, ''));
  
  // Sexo: si el OCR encontró sexo, comparar
  const sexoCoincide = sexoEncontrado && (!datosUsuario.sexo || sexoEncontrado === datosUsuario.sexo);
  
  // Puntaje ponderado: CURP (50%), Nombre (30%), Fecha (15%), Sexo (5%)
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