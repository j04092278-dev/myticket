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
 * Extrae el CURP del texto (BUSCA EN TODO EL TEXTO)
 */
function extraerCURP(texto) {
  if (!texto) return null;
  // Buscar cualquier patrón de CURP: 4 letras + 6 dígitos + 6 alfanuméricos + 1 dígito
  const regex = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
  const match = texto.match(regex);
  if (match) {
    console.log(`🔍 CURP encontrado: ${match[1]}`);
    return match[1].toUpperCase();
  }
  console.log('❌ CURP no encontrado en el texto');
  return null;
}

/**
 * Extrae el nombre completo (BUSCA NOMBRE Y LINEAS CON MAYUSCULAS)
 */
function extraerNombre(texto) {
  if (!texto) return null;
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Buscar línea que contenga "NOMBRE" y capturar lo que sigue
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    if (line.includes('NOMBRE')) {
      // La línea después de "NOMBRE" puede tener el nombre
      let nombrePart = lines[i].replace(/NOMBRE/i, '').trim();
      if (nombrePart.length > 3) {
        // Si el nombre está en la misma línea, devolverlo
        return nombrePart;
      }
      // Si no, buscar en las siguientes líneas (máximo 5)
      let nombreCompleto = '';
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const sigLine = lines[j];
        // Si la línea tiene mayúsculas y al menos 2 palabras
        if (sigLine.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/) && sigLine.split(/\s+/).length >= 2) {
          nombreCompleto += (nombreCompleto ? ' ' : '') + sigLine;
        } else {
          break;
        }
      }
      if (nombreCompleto.trim().length > 3) {
        return nombreCompleto.trim();
      }
    }
  }
  
  // 2. Si no encontró con "NOMBRE", buscar líneas con muchas mayúsculas
  for (let line of lines) {
    if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{15,}$/) && line.split(/\s+/).length >= 3) {
      // Limpiar caracteres extraños
      const clean = line.replace(/[^A-ZÁÉÍÓÚÑ\s]/g, '').trim();
      if (clean.length > 10) {
        return clean;
      }
    }
  }
  
  console.log('❌ Nombre no encontrado en el texto');
  return null;
}

/**
 * Extrae la fecha de nacimiento (BUSCA FECHA O PATRÓN DD/MM/AAAA)
 */
function extraerFechaNacimiento(texto) {
  if (!texto) return null;
  // Buscar patrón de fecha en todo el texto
  const regex = /(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})/;
  const match = texto.match(regex);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    const fecha = `${year}-${month}-${day}`;
    console.log(`🔍 Fecha encontrada: ${fecha}`);
    return fecha;
  }
  // Buscar con año de 2 dígitos
  const regex2 = /(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{2})/;
  const match2 = texto.match(regex2);
  if (match2) {
    const day = match2[1].padStart(2, '0');
    const month = match2[2].padStart(2, '0');
    const year = '20' + match2[3];
    const fecha = `${year}-${month}-${day}`;
    console.log(`🔍 Fecha encontrada (2 dígitos): ${fecha}`);
    return fecha;
  }
  console.log('❌ Fecha no encontrada en el texto');
  return null;
}

/**
 * Extrae el sexo (BUSCA SEXO, MASCULINO, FEMENINO)
 */
function extraerSexo(texto) {
  if (!texto) return null;
  const textoUpper = texto.toUpperCase();
  // Buscar "SEXO" seguido de M o F
  const regex = /SEXO\s*[:.]?\s*([MF])/i;
  const match = texto.match(regex);
  if (match) {
    const sexo = match[1].toUpperCase();
    console.log(`🔍 Sexo encontrado: ${sexo}`);
    return sexo;
  }
  // Buscar palabras clave
  if (textoUpper.includes('MASCULINO')) return 'M';
  if (textoUpper.includes('FEMENINO')) return 'F';
  if (textoUpper.includes('HOMBRE')) return 'M';
  if (textoUpper.includes('MUJER')) return 'F';
  console.log('❌ Sexo no encontrado en el texto');
  return null;
}

/**
 * Valida los datos extraídos con OCR contra los datos ingresados
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
  
  // Nombre: flexible (el nombre OCR debe estar contenido en el nombre del usuario)
  const nombreCoincide = nombreEncontrado && datosUsuario.nombre_completo.toUpperCase().replace(/\s/g, '').includes(nombreEncontrado.toUpperCase().replace(/\s/g, ''));
  
  // Fecha: comparar sin espacios
  const fechaCoincide = fechaEncontrada && datosUsuario.fecha_nacimiento.replace(/\s/g, '').includes(fechaEncontrada.replace(/\s/g, ''));
  
  const sexoCoincide = sexoEncontrado && (!datosUsuario.sexo || sexoEncontrado === datosUsuario.sexo);
  
  // Puntaje: CURP (50%), nombre (30%), fecha (15%), sexo (5%)
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