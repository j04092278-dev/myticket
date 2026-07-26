// backend/src/utils/ocr.js
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
 * Función experta para extraer datos del INE desde texto OCR ruidoso.
 * Busca patrones específicos en lugar de depender de la estructura exacta.
 */
function extraerDatosINE(textoOCR) {
  if (!textoOCR) return { curp: null, ine: null, fecha: null, sexo: null, nombre: null };

  // Limpiar texto: unir líneas, reemplazar múltiples espacios
  const texto = textoOCR.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  console.log('🧹 Texto limpio para análisis:', texto);

  // 1. Extraer CURP (18 caracteres: 4 mayúsculas, 6 dígitos, 6 alfanuméricos, 1 dígito)
  const curpMatch = texto.match(/\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/);
  const curp = curpMatch ? curpMatch[1] : null;

  // 2. Extraer INE / Clave de Elector (18 caracteres, combinación de letras y números)
  const ineMatch = texto.match(/\b([A-Z0-9]{18})\b/);
  const ine = ineMatch ? ineMatch[1] : null;

  // 3. Extraer fecha de nacimiento (buscar cerca de "FECHA" o "NACIMIENTO")
  let fecha = null;
  const fechaIndex = texto.search(/FECHA\s*(DE\s*)?NACIMIENTO|FECHADENACIMIENTO|NACIMIENTO/i);
  if (fechaIndex !== -1) {
    const fragmento = texto.substring(fechaIndex, fechaIndex + 50);
    const fechaMatch = fragmento.match(/(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/);
    if (fechaMatch) {
      fecha = `${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}`;
    } else {
      const fechaSimple = texto.match(/\b(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})\b/);
      if (fechaSimple) {
        fecha = `${fechaSimple[3]}-${fechaSimple[2]}-${fechaSimple[1]}`;
      }
    }
  } else {
    const fechaSimple = texto.match(/\b(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})\b/);
    if (fechaSimple) {
      fecha = `${fechaSimple[3]}-${fechaSimple[2]}-${fechaSimple[1]}`;
    }
  }

  // 4. Extraer sexo (buscar "SEXO" o "SEX" y capturar H/M/F, o buscar H/M aislado)
  let sexo = null;
  const sexoIndex = texto.search(/SEXO|SEX/i);
  if (sexoIndex !== -1) {
    const fragmento = texto.substring(sexoIndex, sexoIndex + 20);
    const sexoMatch = fragmento.match(/\b(H|M|F)\b/i);
    if (sexoMatch) {
      sexo = sexoMatch[1].toUpperCase();
      if (sexo === 'H') sexo = 'M'; // Normalizar H a M (Masculino)
    }
  } else {
    const hMatch = texto.match(/\bH\b/);
    const mMatch = texto.match(/\bM\b/);
    if (hMatch && !mMatch) sexo = 'M';
    else if (mMatch && !hMatch) sexo = 'M';
    if (hMatch && mMatch) {
      if (texto.search(/HOMBRE/i) !== -1) sexo = 'M';
      else if (texto.search(/MUJER/i) !== -1) sexo = 'F';
      else sexo = 'M';
    }
  }

  // 5. Extraer nombre completo (buscar "NOMBRE" y tomar siguientes palabras en mayúsculas)
  let nombre = null;
  const nombreIndex = texto.search(/NOMBRE/i);
  if (nombreIndex !== -1) {
    let fragmento = texto.substring(nombreIndex + 6).trim();
    const palabras = fragmento.split(/\s+/);
    let nombrePartes = [];
    for (const p of palabras) {
      if (p.match(/^[A-ZÁÉÍÓÚÑ]+$/)) {
        nombrePartes.push(p);
      } else if (p.match(/^[A-ZÁÉÍÓÚÑ]+\d/)) {
        break;
      } else {
        break;
      }
    }
    if (nombrePartes.length >= 2) {
      nombre = nombrePartes.join(' ');
    } else {
      const lines = textoOCR.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (const line of lines) {
        if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/)) {
          nombre = line;
          break;
        }
      }
    }
  } else {
    const lines = textoOCR.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines) {
      if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/)) {
        nombre = line;
        break;
      }
    }
  }

  return { curp, ine, fecha, sexo, nombre };
}

/**
 * Compara los datos extraídos con los ingresados por el usuario.
 * Puntaje: CURP 40%, INE 30%, Nombre 20%, Fecha 10%.
 */
function validarDatosConOCRExtra(textoOCR, datosUsuario) {
  const extraidos = extraerDatosINE(textoOCR);
  
  console.log('📊 Datos extraídos por OCR experto:', extraidos);

  const curpCoincide = extraidos.curp && extraidos.curp === datosUsuario.curp;
  const ineCoincide = extraidos.ine && extraidos.ine === datosUsuario.numero_ine;
  const nombreUsuarioClean = datosUsuario.nombre_completo.toUpperCase().replace(/\s/g, '');
  const nombreOCRclean = extraidos.nombre ? extraidos.nombre.toUpperCase().replace(/\s/g, '') : '';
  const nombreCoincide = nombreOCRclean && (nombreUsuarioClean.includes(nombreOCRclean) || nombreOCRclean.includes(nombreUsuarioClean));
  const fechaCoincide = extraidos.fecha && datosUsuario.fecha_nacimiento.includes(extraidos.fecha);
  const sexoUsuario = datosUsuario.sexo ? datosUsuario.sexo.toUpperCase() : '';
  const sexoOCR = extraidos.sexo ? extraidos.sexo.toUpperCase() : '';
  const sexoCoincide = sexoOCR && (sexoOCR === sexoUsuario || (sexoOCR === 'M' && sexoUsuario === 'M') || (sexoOCR === 'H' && sexoUsuario === 'M'));

  let puntaje = 0;
  if (curpCoincide) puntaje += 40;
  if (ineCoincide) puntaje += 30;
  if (nombreCoincide) puntaje += 20;
  if (fechaCoincide) puntaje += 10;
  if (sexoCoincide) puntaje += 0; // Solo informativo

  console.log(`🔢 Puntaje final: ${puntaje}%`);

  return {
    curpCoincide,
    ineCoincide,
    nombreCoincide,
    fechaCoincide,
    sexoCoincide,
    curpEncontrado: extraidos.curp,
    ineEncontrado: extraidos.ine,
    nombreEncontrado: extraidos.nombre,
    fechaEncontrada: extraidos.fecha,
    sexoEncontrado: extraidos.sexo,
    textoExtraido: textoOCR,
    puntaje: Math.min(puntaje, 100),
  };
}

module.exports = {
  extraerTextoDeImagen,
  validarDatosConOCRExtra
};