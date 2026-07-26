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
 * Extrae el CURP del texto (muy flexible)
 * Busca cualquier secuencia de 18 caracteres que sea letras/números/Ñ y que coincida con el patrón de CURP
 * además busca explícitamente "CURP" y captura lo que venga después
 */
function extraerCURP(texto) {
  if (!texto) return null;
  
  // 1. Buscar después de "CURP" (caso más común)
  const regexCURP = /CURP\s*[:.]?\s*([A-ZÑ0-9]{18})/i;
  let match = texto.match(regexCURP);
  if (match) {
    const posible = match[1].toUpperCase();
    // Validar que tenga el formato correcto (4 letras, 6 dígitos, 6 alfanuméricos, 1 dígito)
    if (/^[A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]$/.test(posible)) {
      return posible;
    }
  }
  
  // 2. Buscar cualquier subcadena de 18 caracteres alfanuméricos que cumpla el patrón
  const regexPatron = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
  match = texto.match(regexPatron);
  if (match) {
    return match[1].toUpperCase();
  }
  
  // 3. Buscar en el texto completo cualquier secuencia de 18 caracteres que pueda ser CURP (incluyendo Ñ)
  const regexLax = /\b[A-ZÑ]{4}[0-9]{6}[A-ZÑ0-9]{6}[0-9X]\b/;
  match = texto.match(regexLax);
  if (match) {
    return match[0].toUpperCase();
  }
  
  // 4. Último intento: buscar "CURP" seguido de cualquier cosa que termine en un número o X
  const regexFallback = /CURP\s*[:.]?\s*([A-ZÑ0-9]{16,20})/i;
  match = texto.match(regexFallback);
  if (match) {
    // Tomar los primeros 18 caracteres
    let candidato = match[1].toUpperCase().replace(/[^A-ZÑ0-9]/g, '');
    if (candidato.length >= 18) {
      candidato = candidato.substring(0, 18);
      if (/^[A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]$/.test(candidato)) {
        return candidato;
      }
    }
  }
  
  return null;
}

/**
 * Extrae el nombre completo del texto (más robusto)
 * Busca "NOMBRE" y toma las siguientes líneas que sean mayúsculas y contengan al menos 2 palabras
 */
function extraerNombre(texto) {
  if (!texto) return null;
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Buscar la línea que contiene "NOMBRE"
  let idxNombre = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('NOMBRE')) {
      idxNombre = i;
      break;
    }
  }
  
  if (idxNombre !== -1) {
    // Recolectar las siguientes líneas que tengan mayúsculas y al menos 2 palabras
    let nombreCompleto = '';
    for (let j = idxNombre + 1; j < Math.min(idxNombre + 6, lines.length); j++) {
      const line = lines[j];
      // Si la línea es mayúscula y tiene al menos 2 palabras (ignorar líneas cortas o con números)
      if (/^[A-ZÁÉÍÓÚÑ\s]{5,}$/.test(line) && line.split(/\s+/).length >= 2) {
        nombreCompleto += ' ' + line;
      } else {
        // Si la línea tiene "DOMICILIO" o "CLAVE" o "FECHA", detener
        if (line.toUpperCase().includes('DOMICILIO') || 
            line.toUpperCase().includes('CLAVE') || 
            line.toUpperCase().includes('FECHA')) {
          break;
        }
      }
    }
    if (nombreCompleto.trim().length > 5) {
      return nombreCompleto.trim();
    }
  }
  
  // Si no encontró con "NOMBRE", buscar líneas con mayúsculas que contengan apellidos comunes
  for (let line of lines) {
    if (/^[A-ZÁÉÍÓÚÑ\s]{10,}$/.test(line) && line.split(/\s+/).length >= 3) {
      return line;
    }
  }
  
  return null;
}

/**
 * Extrae la fecha de nacimiento (muy flexible)
 * Busca patrones de fecha en el texto
 */
function extraerFechaNacimiento(texto) {
  if (!texto) return null;
  
  // Buscar "FECHA" o "NACIMIENTO" y luego un patrón de fecha
  const regexFechaConTexto = /(?:FECHA\s*DE\s*NACIMIENTO|NACIMIENTO|FECHA)\s*[:.]?\s*(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*\d{4})/i;
  let match = texto.match(regexFechaConTexto);
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
  
  // Buscar fecha con año de 2 dígitos (asumir 20xx)
  const regexFechaCorta = /(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*(\d{2}))/;
  match = texto.match(regexFechaCorta);
  if (match) {
    const partes = match[1].replace(/\s/g, '').split(/[/-]/);
    if (partes.length === 3) {
      const año = parseInt(partes[2]) < 30 ? '20' + partes[2] : '19' + partes[2];
      return `${año}-${partes[1]}-${partes[0]}`;
    }
  }
  
  return null;
}

/**
 * Extrae el sexo del texto (muy flexible)
 */
function extraerSexo(texto) {
  if (!texto) return null;
  const textoUpper = texto.toUpperCase();
  
  // Buscar "SEXO" y luego M o F
  const regexSexo = /SEXO\s*[:.]?\s*([MF])/i;
  let match = texto.match(regexSexo);
  if (match) return match[1].toUpperCase();
  
  // Buscar en el texto palabras clave
  if (textoUpper.includes('MASCULINO') || textoUpper.includes('HOMBRE')) return 'M';
  if (textoUpper.includes('FEMENINO') || textoUpper.includes('MUJER')) return 'F';
  
  // Buscar "SEXO |" y luego en la línea siguiente puede aparecer M o F
  const lines = texto.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('SEXO')) {
      // Buscar en las siguientes 2 líneas si hay M o F suelto
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const linea = lines[j].toUpperCase();
        if (linea.includes('M') && !linea.includes('MUJER') && !linea.includes('MASC')) {
          return 'M';
        }
        if (linea.includes('F') && !linea.includes('FEM') && !linea.includes('FEMENINO')) {
          return 'F';
        }
      }
    }
  }
  
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
  
  // Sexo
  const sexoCoincide = sexoEncontrado && (!datosUsuario.sexo || sexoEncontrado === datosUsuario.sexo);
  
  // Puntaje ponderado: CURP (60%), nombre (25%), fecha (10%), sexo (5%)
  let puntaje = 0;
  if (curpCoincide) puntaje += 60;
  if (nombreCoincide) puntaje += 25;
  if (fechaCoincide) puntaje += 10;
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