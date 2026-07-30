const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const { RekognitionClient, DetectTextCommand } = require('@aws-sdk/client-rekognition');
const { extractCURP, extractINE, extractFecha, extractSexo, extractNombre, fuzzyMatch, cleanText } = require('./textUtils');

// Inicializar AWS Rekognition si está configurado
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

/**
 * Preprocesa la imagen para mejorar OCR: redimensiona, convierte a grises, aumenta contraste,
 * y aplica umbralización adaptativa.
 */
async function preprocesarImagen(imagenPath) {
  try {
    const outputPath = imagenPath.replace(/\.(jpe?g|png|webp)$/i, '_processed.png');
    await sharp(imagenPath)
      .resize(1600, 1200, { fit: 'inside', withoutEnlargement: false })
      .grayscale()
      .normalize() // Mejora contraste
      .sharpen({ sigma: 2, m1: 1, m2: 0.5 })
      .modulate({ brightness: 1.3, saturation: 1.2 })
      .png({ compressionLevel: 9 }) // Usar PNG para mejor calidad
      .toFile(outputPath);
    return outputPath;
  } catch (err) {
    console.error('❌ Error en preprocesamiento:', err);
    return imagenPath;
  }
}

/**
 * OCR con AWS Rekognition (retorna texto completo)
 */
async function ocrConAWS(imagenPath) {
  if (!rekognitionClient) return null;
  try {
    const imageBytes = fs.readFileSync(imagenPath);
    const command = new DetectTextCommand({ Image: { Bytes: imageBytes } });
    const response = await rekognitionClient.send(command);
    if (!response.TextDetections || response.TextDetections.length === 0) return null;
    const lines = response.TextDetections
      .filter(item => item.Type === 'LINE')
      .map(item => item.DetectedText)
      .join('\n');
    console.log('✅ AWS Rekognition OCR exitoso');
    return lines;
  } catch (error) {
    console.error('❌ Error en AWS Rekognition:', error);
    return null;
  }
}

/**
 * OCR con Tesseract.js usando múltiples configuraciones
 */
async function ocrConTesseract(imagenPath) {
  try {
    const imagenProcesada = await preprocesarImagen(imagenPath);
    // Configuraciones: psm 6 (bloque de texto), 3 (automático), 4 (vertical)
    const configs = [
      { psm: 6, language: 'spa' },
      { psm: 3, language: 'spa' },
      { psm: 6, language: 'spa+eng' },
      { psm: 4, language: 'spa' }, // para columnas
    ];
    let bestText = null;
    let bestConfidence = 0;

    for (const config of configs) {
      console.log(`🔍 Tesseract con psm=${config.psm}, lang=${config.language}`);
      const result = await Tesseract.recognize(imagenProcesada, config.language, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`📊 Progreso Tesseract: ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_pageseg_mode: config.psm,
        tessedit_ocr_engine_mode: '3',
        // Whitelist para caracteres comunes en INE
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789/-.: ',
      });
      const text = result.data.text;
      const confidence = result.data.confidence || 0;
      if (text.length > 30 && confidence > bestConfidence) {
        bestText = text;
        bestConfidence = confidence;
      }
    }

    // Limpiar archivo procesado si existe
    if (imagenProcesada !== imagenPath && fs.existsSync(imagenProcesada)) {
      fs.unlinkSync(imagenProcesada);
    }

    if (bestText && bestText.length > 30) {
      console.log(`✅ Tesseract exitoso con ${bestConfidence}% de confianza`);
      return bestText;
    }
    return null;
  } catch (error) {
    console.error('❌ Error en Tesseract:', error);
    return null;
  }
}

/**
 * Función principal de extracción de texto de imagen
 */
async function extraerTextoDeImagen(imagenPath) {
  console.log('📖 Extrayendo texto del INE...');
  let texto = null;

  // 1. Intentar con AWS Rekognition
  if (rekognitionClient) {
    console.log('🔍 Intentando con AWS Rekognition...');
    texto = await ocrConAWS(imagenPath);
    if (texto && texto.length > 30) {
      console.log('✅ AWS Rekognition exitoso');
      return cleanText(texto);
    }
  }

  // 2. Intentar con Tesseract
  console.log('🔍 Intentando con Tesseract.js...');
  texto = await ocrConTesseract(imagenPath);
  if (texto && texto.length > 30) {
    console.log('✅ Tesseract exitoso');
    return cleanText(texto);
  }

  // 3. Último intento sin preprocesar y con idioma español simple
  console.log('⚠️ Último intento con Tesseract sin preprocesar...');
  try {
    const result = await Tesseract.recognize(imagenPath, 'spa', {
      tessedit_pageseg_mode: '6',
    });
    if (result.data.text && result.data.text.length > 30) {
      return cleanText(result.data.text);
    }
  } catch (e) {}

  console.log('❌ Todos los métodos de OCR fallaron');
  return null;
}

/**
 * Extrae y valida datos del INE usando el texto OCR y los datos proporcionados por el usuario.
 * Devuelve un objeto con los campos extraídos y puntaje de coincidencia.
 */
function extraerYValidarDatosINE(textoOCR, datosUsuario) {
  if (!textoOCR) {
    return {
      curpCoincide: false,
      ineCoincide: false,
      nombreCoincide: false,
      fechaCoincide: false,
      sexoCoincide: false,
      curpEncontrado: null,
      ineEncontrado: null,
      nombreEncontrado: null,
      fechaEncontrada: null,
      sexoEncontrado: null,
      textoExtraido: textoOCR,
      puntaje: 0,
      mensaje: 'No se pudo extraer texto'
    };
  }

  // Extraer cada campo usando las funciones de textUtils
  const curpEncontrado = extractCURP(textoOCR);
  const ineEncontrado = extractINE(textoOCR);
  const nombreEncontrado = extractNombre(textoOCR);
  const fechaEncontrada = extractFecha(textoOCR);
  const sexoEncontrado = extractSexo(textoOCR);

  console.log('📊 Datos extraídos:', { curpEncontrado, ineEncontrado, nombreEncontrado, fechaEncontrada, sexoEncontrado });

  // Comparar con los datos del usuario usando fuzzy match
  const curpCoincide = curpEncontrado && fuzzyMatch(curpEncontrado, datosUsuario.curp, 0.9);
  const ineCoincide = ineEncontrado && fuzzyMatch(ineEncontrado, datosUsuario.numero_ine, 0.9);
  const nombreCoincide = nombreEncontrado && fuzzyMatch(nombreEncontrado, datosUsuario.nombre_completo, 0.6);
  const fechaCoincide = fechaEncontrada && fuzzyMatch(fechaEncontrada, datosUsuario.fecha_nacimiento, 0.8);
  const sexoCoincide = sexoEncontrado && (!datosUsuario.sexo || fuzzyMatch(sexoEncontrado, datosUsuario.sexo, 1.0));

  // Calcular puntaje ponderado
  let puntaje = 0;
  if (curpCoincide) puntaje += 40;
  if (ineCoincide) puntaje += 30;
  if (nombreCoincide) puntaje += 20;
  if (fechaCoincide) puntaje += 5;
  if (sexoCoincide) puntaje += 5;

  const resultado = {
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
    puntaje,
    mensaje: puntaje >= 60 ? '✅ Datos validados correctamente' : '❌ Los datos extraídos no coinciden suficientemente'
  };

  return resultado;
}

module.exports = {
  extraerTextoDeImagen,
  extraerYValidarDatosINE,
  preprocesarImagen,
  ocrConAWS,
  ocrConTesseract
};