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
  // Buscar el patrón clásico de CURP: 4 letras, 6 números, 6 alfanuméricos, 1 número o X
  const regex = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
  const match = texto.match(regex);
  return match ? match[1].toUpperCase() : null;
}

/**
 * EXTRAE NOMBRE COMPLETO: busca "NOMBRE" y toma las siguientes líneas que parezcan nombre
 * También busca líneas con mayúsculas que contengan al menos 3 palabras.
 */
function extraerNombre(texto) {
  if (!texto) return null;
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Buscar "NOMBRE" y capturar el texto que sigue
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    if (line.includes('NOMBRE') || line.includes('NOMBRES')) {
      // El nombre puede estar en la misma línea o en las siguientes
      let nombrePartes = [];
      // Si la misma línea tiene texto después de "NOMBRE"
      const resto = lines[i].replace(/NOMBRE\s*[:.]?\s*/i, '');
      if (resto.length > 3) nombrePartes.push(resto);
      // Buscar en las siguientes líneas que estén en mayúsculas y tengan al menos 3 caracteres
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const sigLine = lines[j];
        // Si la línea es mayúscula y tiene al menos 3 palabras, es parte del nombre
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
  
  // 2. Si no encontró con "NOMBRE", buscar cualquier línea con mayúsculas y 3+ palabras
  for (let line of lines) {
    if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/)) {
      const palabras = line.split(/\s+/);
      if (palabras.length >= 3) {
        return line;
      }
    }
  }
  
  // 3. Si aún no, buscar líneas con mayúsculas y largo > 10
  for (let line of lines) {
    if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/)) {
      return line;
    }
  }
  
  return null;
}

/**
 * EXTRAE FECHA DE NACIMIENTO: busca patrones como DD/MM/AAAA, DD-MM-AAAA, DD/MM/AA
 * También busca palabras "FECHA" o "NACIMIENTO" y captura la fecha cercana.
 */
function extraerFechaNacimiento(texto) {
  if (!texto) return null;
  // Buscar patrones de fecha en todo el texto (priorizar el que tenga año completo)
  const regexes = [
    /(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})/, // DD/MM/AAAA
    /(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{2})/  // DD/MM/AA
  ];
  for (const regex of regexes) {
    const match = texto.match(regex);
    if (match) {
      let dia = match[1].padStart(2, '0');
      let mes = match[2].padStart(2, '0');
      let anio = match[3];
      if (anio.length === 2) anio = '20' + anio;
      // Validar que sea una fecha real
      if (parseInt(mes) >= 1 && parseInt(mes) <= 12 && parseInt(dia) >= 1 && parseInt(dia) <= 31) {
        return `${anio}-${mes}-${dia}`;
      }
    }
  }
  
  // Si no encuentra, buscar "FECHA" o "NACIMIENTO" y tomar el siguiente número con formato fecha
  const palabras = texto.split(/\s+/);
  for (let i = 0; i < palabras.length; i++) {
    const p = palabras[i].toUpperCase();
    if (p.includes('FECHA') || p.includes('NACIMIENTO')) {
      // Buscar en las siguientes 5 palabras un patrón de fecha
      for (let j = i + 1; j < Math.min(i + 6, palabras.length); j++) {
        const fechaCandidata = palabras[j].replace(/[^\d/-\s]/g, '');
        if (fechaCandidata.match(/\d{2}[\/-]\d{2}[\/-]\d{2,4}/)) {
          const partes = fechaCandidata.split(/[/-]/);
          if (partes.length === 3) {
            let dia = partes[0].padStart(2, '0');
            let mes = partes[1].padStart(2, '0');
            let anio = partes[2];
            if (anio.length === 2) anio = '20' + anio;
            if (parseInt(mes) >= 1 && parseInt(mes) <= 12 && parseInt(dia) >= 1 && parseInt(dia) <= 31) {
              return `${anio}-${mes}-${dia}`;
            }
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * EXTRAE SEXO: busca "SEXO" o "SEX" y captura la letra H/M/F
 * También busca la letra H o M aislada cerca de "SEXO"
 */
function extraerSexo(texto) {
  if (!texto) return null;
  const lines = texto.split('\n').map(l => l.trim());
  
  // 1. Buscar línea que contenga "SEXO" o "SEX"
  for (let line of lines) {
    const upper = line.toUpperCase();
    if (upper.includes('SEXO') || upper.includes('SEX')) {
      // Buscar H o M en la misma línea
      const matchH = line.match(/\b(H|M)\b/i);
      if (matchH) return matchH[1].toUpperCase();
      // Si no, buscar en las siguientes líneas
      for (let j = lines.indexOf(line) + 1; j < Math.min(lines.indexOf(line) + 4, lines.length); j++) {
        const sig = lines[j].toUpperCase();
        if (sig.includes('H') || sig.includes('M')) {
          const m = sig.match(/\b(H|M)\b/);
          if (m) return m[1];
        }
      }
    }
  }
  
  // 2. Buscar en todo el texto las palabras "HOMBRE", "MUJER", "MASCULINO", "FEMENINO"
  const upper = texto.toUpperCase();
  if (upper.includes('HOMBRE') || upper.includes('MASCULINO') || upper.includes('H')) return 'M';
  if (upper.includes('MUJER') || upper.includes('FEMENINO') || upper.includes('F')) return 'F';
  
  // 3. Buscar la letra H o M aislada (típico en INE)
  const matchH = texto.match(/\b(H|M)\b/);
  if (matchH) return matchH[1].toUpperCase();
  
  return null;
}

/**
 * VALIDA DATOS CON OCR (FLEXIBLE)
 * Puntaje: CURP (50%), Nombre (30%), Fecha (15%), Sexo (5%)
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
  
  // Nombre: comparar después de eliminar espacios y mayúsculas
  const nombreUsuarioClean = datosUsuario.nombre_completo.toUpperCase().replace(/\s/g, '');
  const nombreOCRclean = nombreEncontrado ? nombreEncontrado.toUpperCase().replace(/\s/g, '') : '';
  const nombreCoincide = nombreOCRclean && (nombreUsuarioClean.includes(nombreOCRclean) || nombreOCRclean.includes(nombreUsuarioClean));
  
  // Fecha: comparar sin espacios
  const fechaCoincide = fechaEncontrada && datosUsuario.fecha_nacimiento.replace(/\s/g, '').includes(fechaEncontrada.replace(/\s/g, ''));
  
  // Sexo: comparar (M/H)
  const sexoCoincide = sexoEncontrado && datosUsuario.sexo && (sexoEncontrado === datosUsuario.sexo.toUpperCase() || 
    (sexoEncontrado === 'H' && datosUsuario.sexo.toUpperCase() === 'M') || 
    (sexoEncontrado === 'M' && datosUsuario.sexo.toUpperCase() === 'M') ||
    (sexoEncontrado === 'F' && datosUsuario.sexo.toUpperCase() === 'F'));
  
  // Puntaje
  let puntaje = 0;
  if (curpCoincide) puntaje += 50;
  if (nombreCoincide) puntaje += 30;
  if (fechaCoincide) puntaje += 15;
  if (sexoCoincide) puntaje += 5;
  
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