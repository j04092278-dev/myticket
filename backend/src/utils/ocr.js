const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const { RekognitionClient, DetectTextCommand } = require('@aws-sdk/client-rekognition');

// Inicializar AWS Rekognition para OCR
let rekognitionClient = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
  rekognitionClient = new RekognitionClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log('✅ AWS Rekognition inicializado para OCR');
} else {
  console.log('⚠️ AWS Rekognition no configurado, usando Tesseract.js');
}

// ========== OCR CON AWS ==========
async function ocrConAWS(imagenPath) {
  if (!rekognitionClient) return null;
  try {
    const imageBytes = fs.readFileSync(imagenPath);
    const command = new DetectTextCommand({ Image: { Bytes: imageBytes } });
    const response = await rekognitionClient.send(command);
    if (!response.TextDetections || response.TextDetections.length === 0) return null;
    const texto = response.TextDetections
      .filter(item => item.Type === 'LINE' || item.Type === 'WORD')
      .map(item => item.DetectedText)
      .join('\n');
    console.log('✅ AWS Rekognition OCR exitoso');
    return texto;
  } catch (error) {
    console.error('❌ Error en AWS Rekognition:', error);
    return null;
  }
}

// ========== PREPROCESAR PARA TESSERACT ==========
async function preprocesarImagen(imagenPath) {
  try {
    const outputPath = imagenPath.replace(/\.(jpe?g|png|webp)$/i, '_processed.jpg');
    await sharp(imagenPath)
      .resize(1600, 1200, { fit: 'inside', withoutEnlargement: false })
      .grayscale()
      .normalize()
      .sharpen({ sigma: 2 })
      .modulate({ brightness: 1.2, saturation: 1.2 })
      .toFile(outputPath);
    return outputPath;
  } catch (err) {
    return imagenPath;
  }
}

// ========== OCR CON TESSERACT ==========
async function ocrConTesseract(imagenPath) {
  try {
    const imagenProcesada = await preprocesarImagen(imagenPath);
    const result = await Tesseract.recognize(imagenProcesada, 'spa', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`📊 Progreso Tesseract: ${Math.round(m.progress * 100)}%`);
        }
      },
      tessedit_pageseg_mode: '6',
      tessedit_ocr_engine_mode: '3',
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789/-.: ',
    });
    if (imagenProcesada !== imagenPath && fs.existsSync(imagenProcesada)) {
      fs.unlinkSync(imagenProcesada);
    }
    return result.data.text;
  } catch (error) {
    console.error('❌ Error en Tesseract:', error);
    return null;
  }
}

// ========== OCR PRINCIPAL ==========
async function extraerTextoDeImagen(imagenPath) {
  console.log('📖 Extrayendo texto del INE...');
  let texto = null;

  // 1. AWS Rekognition
  if (rekognitionClient) {
    console.log('🔍 Intentando con AWS Rekognition...');
    texto = await ocrConAWS(imagenPath);
    if (texto && texto.length > 30) {
      console.log('✅ AWS Rekognition exitoso');
      return limpiarTexto(texto);
    }
  }

  // 2. Tesseract
  console.log('🔍 Intentando con Tesseract.js...');
  texto = await ocrConTesseract(imagenPath);
  if (texto && texto.length > 30) {
    console.log('✅ Tesseract exitoso');
    return limpiarTexto(texto);
  }

  // 3. Último intento sin preprocesar
  console.log('⚠️ Intentando Tesseract sin preprocesar...');
  texto = await ocrConTesseract(imagenPath);
  if (texto) return limpiarTexto(texto);

  console.log('❌ Todos los métodos de OCR fallaron');
  return null;
}

function limpiarTexto(texto) {
  if (!texto) return '';
  return texto.replace(/[^A-Za-zÁÉÍÓÚÑ0-9\s\n\/\-:.]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ========== EXTRACCIÓN INTELIGENTE DE DATOS ==========
function extraerDatosINE(textoOCR) {
  if (!textoOCR) return { curp: null, ine: null, fecha: null, sexo: null, nombre: null };
  const texto = textoOCR;

  // CURP
  let curp = null;
  const curpMatch = texto.match(/CURP\s*[:.]?\s*([A-Z0-9]{18})/i);
  if (curpMatch) curp = curpMatch[1].toUpperCase();
  if (!curp) {
    const regex = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
    const match = texto.match(regex);
    if (match) curp = match[1].toUpperCase();
  }

  // INE (Clave de Elector)
  let ine = null;
  const ineMatch = texto.match(/CLAVE\s*DE\s*ELECTOR\s*[:.]?\s*([A-Z0-9]{18})/i);
  if (ineMatch) ine = ineMatch[1].toUpperCase();

  // Fecha de nacimiento
  let fecha = null;
  const fMatch = texto.match(/(?:FECHA\s*DE\s*NACIMIENTO|NACIMIENTO)\s*[:.]?\s*(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})/i);
  if (fMatch) {
    let dia = fMatch[1].padStart(2, '0');
    let mes = fMatch[2].padStart(2, '0');
    let anio = fMatch[3];
    if (anio.length === 2) anio = '20' + anio;
    if (parseInt(mes) >= 1 && parseInt(mes) <= 12 && parseInt(dia) >= 1 && parseInt(dia) <= 31) {
      fecha = `${anio}-${mes}-${dia}`;
    }
  }
  if (!fecha) {
    const simple = texto.match(/(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})/);
    if (simple) {
      let dia = simple[1].padStart(2, '0');
      let mes = simple[2].padStart(2, '0');
      let anio = simple[3];
      if (anio.length === 2) anio = '20' + anio;
      if (parseInt(mes) >= 1 && parseInt(mes) <= 12 && parseInt(dia) >= 1 && parseInt(dia) <= 31) {
        fecha = `${anio}-${mes}-${dia}`;
      }
    }
  }

  // Sexo
  let sexo = null;
  const sMatch = texto.match(/SEXO\s*[:.]?\s*([HMF])/i);
  if (sMatch) {
    sexo = sMatch[1].toUpperCase();
    if (sexo === 'H') sexo = 'M';
  }
  if (!sexo) {
    if (texto.toUpperCase().includes('HOMBRE') || texto.toUpperCase().includes('MASCULINO')) sexo = 'M';
    if (texto.toUpperCase().includes('MUJER') || texto.toUpperCase().includes('FEMENINO')) sexo = 'F';
  }

  // Nombre completo
  let nombre = null;
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('NOMBRE')) {
      let partes = [];
      const resto = lines[i].replace(/NOMBRE\s*[:.]?\s*/i, '');
      if (resto.length > 3) partes.push(resto);
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const sig = lines[j];
        if (sig.match(/^[A-ZÁÉÍÓÚÑ\s]{5,}$/) && sig.split(/\s+/).length >= 2) {
          partes.push(sig);
        } else break;
      }
      if (partes.length > 0) {
        nombre = partes.join(' ').trim();
        break;
      }
    }
  }
  if (!nombre) {
    for (let line of lines) {
      if (line.match(/^[A-ZÁÉÍÓÚÑ\s]{10,}$/)) {
        const palabras = line.split(/\s+/);
        if (palabras.length >= 3) { nombre = line; break; }
      }
    }
  }

  return { curp, ine, fecha, sexo, nombre };
}

function validarDatosConOCR(textoOCR, datosUsuario) {
  const extraidos = extraerDatosINE(textoOCR);
  console.log('📊 Datos extraídos por OCR:', extraidos);

  const curpCoincide = extraidos.curp && extraidos.curp === datosUsuario.curp;
  const ineCoincide = extraidos.ine && extraidos.ine === datosUsuario.numero_ine;
  const nombreCoincide = extraidos.nombre && datosUsuario.nombre_completo.toUpperCase().replace(/\s/g, '').includes(extraidos.nombre.toUpperCase().replace(/\s/g, ''));
  const fechaCoincide = extraidos.fecha && datosUsuario.fecha_nacimiento.replace(/\s/g, '').includes(extraidos.fecha.replace(/\s/g, ''));
  const sexoCoincide = extraidos.sexo && (!datosUsuario.sexo || extraidos.sexo === datosUsuario.sexo);

  let puntaje = 0;
  if (curpCoincide) puntaje += 50;
  if (ineCoincide) puntaje += 30;
  if (nombreCoincide) puntaje += 15;
  if (fechaCoincide) puntaje += 5;
  if (sexoCoincide) puntaje += 0;

  console.log(`📊 Puntaje total: ${puntaje}%`);

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
    puntaje: Math.min(puntaje, 100)
  };
}

module.exports = { extraerTextoDeImagen, extraerDatosINE, validarDatosConOCR };