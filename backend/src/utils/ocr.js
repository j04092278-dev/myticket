const Tesseract = require('tesseract.js');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');

// ========== PREPROCESAMIENTO AVANZADO DE IMAGEN ==========
async function preprocesarImagen(imagenPath) {
  try {
    const outputPath = imagenPath.replace(/\.(jpe?g|png|webp)$/i, '_processed.jpg');
    console.log('🔧 Preprocesando imagen para OCR...');

    await sharp(imagenPath)
      .resize(1600, 1200, { fit: 'inside', withoutEnlargement: false })
      .grayscale()
      .normalize()
      .sharpen({ sigma: 2 })
      .modulate({ brightness: 1.2, saturation: 1.2 })
      .toFile(outputPath);

    console.log('✅ Imagen preprocesada:', outputPath);
    return outputPath;
  } catch (err) {
    console.warn('⚠️ No se pudo preprocesar la imagen, se usará la original:', err.message);
    return imagenPath;
  }
}

// ========== EJECUTAR OCR CON CONFIGURACIÓN ÓPTIMA ==========
async function ejecutarOCR(imagenPath, idioma = 'spa') {
  try {
    const result = await Tesseract.recognize(imagenPath, idioma, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`📊 Progreso OCR: ${Math.round(m.progress * 100)}%`);
        }
      },
      tessedit_pageseg_mode: '6',
      tessedit_ocr_engine_mode: '3',
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789/-.: ',
      load_system_dawg: '0',
      load_freq_dawg: '0',
    });
    return result.data.text;
  } catch (error) {
    console.error('❌ Error en OCR:', error);
    return null;
  }
}

// ========== EXTRACCIÓN DE TEXTO (PRINCIPAL) ==========
async function extraerTextoDeImagen(imagenPath, idioma = 'spa') {
  try {
    console.log('📖 Extrayendo texto de la imagen del INE...');
    console.log('📸 Ruta de la imagen:', imagenPath);

    const imagenProcesada = await preprocesarImagen(imagenPath);
    let texto = await ejecutarOCR(imagenProcesada, idioma);

    if (!texto || texto.length < 20) {
      console.log('⚠️ El OCR con preprocesamiento dio poco texto, intentando sin preprocesar...');
      texto = await ejecutarOCR(imagenPath, idioma);
    }

    if (texto) {
      texto = limpiarTextoOCR(texto);
    }

    console.log('📝 Texto extraído (OCR):');
    console.log('--- INICIO DEL TEXTO ---');
    console.log(texto);
    console.log('--- FIN DEL TEXTO ---');

    if (imagenProcesada !== imagenPath && fs.existsSync(imagenProcesada)) {
      fs.unlinkSync(imagenProcesada);
    }

    return texto;
  } catch (error) {
    console.error('❌ Error en extraerTextoDeImagen:', error);
    return null;
  }
}

// ========== LIMPIEZA DE TEXTO OCR ==========
function limpiarTextoOCR(texto) {
  if (!texto) return '';
  return texto
    .replace(/[^A-Za-zÁÉÍÓÚÑ0-9\s\n\/\-:.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ========== EXTRACCIÓN DE CURP ==========
function extraerCURP(texto) {
  if (!texto) return null;
  const regexCURP = /CURP\s*[:.]?\s*([A-Z0-9]{18})/i;
  let match = texto.match(regexCURP);
  if (match) return match[1].toUpperCase();

  const regexPatron = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
  match = texto.match(regexPatron);
  if (match) return match[1].toUpperCase();

  return null;
}

// ========== EXTRACCIÓN DE NOMBRE ==========
function extraerNombre(texto) {
  if (!texto) return null;
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    if (line.includes('NOMBRE')) {
      let nombrePartes = [];
      const resto = lines[i].replace(/NOMBRE\s*[:.]?\s*/i, '');
      if (resto.length > 3) nombrePartes.push(resto);
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const sigLine = lines[j];
        if (sigLine.match(/^[A-ZÁÉÍÓÚÑ\s]{5,}$/) && sigLine.split(/\s+/).length >= 2) {
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

// ========== EXTRACCIÓN DE FECHA ==========
function extraerFechaNacimiento(texto) {
  if (!texto) return null;
  const regexFecha = /(?:FECHA\s*DE\s*NACIMIENTO|NACIMIENTO|FECHA)\s*[:.]?\s*(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})/i;
  let match = texto.match(regexFecha);
  if (match) {
    let dia = match[1].padStart(2, '0');
    let mes = match[2].padStart(2, '0');
    let anio = match[3];
    if (anio.length === 2) anio = '20' + anio;
    if (parseInt(mes) >= 1 && parseInt(mes) <= 12 && parseInt(dia) >= 1 && parseInt(dia) <= 31) {
      return `${anio}-${mes}-${dia}`;
    }
  }

  const regexFechaSimple = /(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})/;
  match = texto.match(regexFechaSimple);
  if (match) {
    let dia = match[1].padStart(2, '0');
    let mes = match[2].padStart(2, '0');
    let anio = match[3];
    if (anio.length === 2) anio = '20' + anio;
    if (parseInt(mes) >= 1 && parseInt(mes) <= 12 && parseInt(dia) >= 1 && parseInt(dia) <= 31) {
      return `${anio}-${mes}-${dia}`;
    }
  }

  return null;
}

// ========== EXTRACCIÓN DE SEXO ==========
function extraerSexo(texto) {
  if (!texto) return null;
  const textoUpper = texto.toUpperCase();
  const regexSexo = /SEXO\s*[:.]?\s*([HMF])/i;
  let match = texto.match(regexSexo);
  if (match) {
    const sexo = match[1].toUpperCase();
    if (sexo === 'H') return 'M';
    return sexo;
  }

  if (textoUpper.includes('HOMBRE') || textoUpper.includes('MASCULINO')) return 'M';
  if (textoUpper.includes('MUJER') || textoUpper.includes('FEMENINO')) return 'F';

  return null;
}

// ========== VALIDACIÓN DE DATOS CON OCR ==========
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
  const nombreCoincide = nombreEncontrado && datosUsuario.nombre_completo.toUpperCase().replace(/\s/g, '').includes(nombreEncontrado.toUpperCase().replace(/\s/g, ''));
  const fechaCoincide = fechaEncontrada && datosUsuario.fecha_nacimiento.replace(/\s/g, '').includes(fechaEncontrada.replace(/\s/g, ''));
  const sexoCoincide = sexoEncontrado && (!datosUsuario.sexo || sexoEncontrado === datosUsuario.sexo);

  let puntaje = 0;
  if (curpCoincide) puntaje += 50;
  if (nombreCoincide) puntaje += 30;
  if (fechaCoincide) puntaje += 15;
  if (sexoCoincide) puntaje += 5;
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