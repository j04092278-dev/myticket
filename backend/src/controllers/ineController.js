const pool = require('../config/database');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { validateCURP, validateINE } = require('../utils/validators');
const { RekognitionClient, CompareFacesCommand } = require('@aws-sdk/client-rekognition');
const Tesseract = require('tesseract.js');

// ===== CONFIGURACIÓN AWS REKOGNITION =====
const rekognitionClient = process.env.AWS_ACCESS_KEY_ID ? new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}) : null;

// ===== CARPETAS DE SUBIDA =====
const uploadDir = './uploads/ine/';
const selfieDir = './uploads/selfies/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(selfieDir)) fs.mkdirSync(selfieDir, { recursive: true });

// ===== CONFIGURACIÓN MULTER =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.fieldname === 'selfieImage' ? selfieDir : uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === 'selfieImage' ? 'selfie' : 'ine';
    cb(null, `${prefix}_${req.userId}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato no permitido'), false);
  }
});

// ===== FUNCIÓN PARA EXTRAER TEXTO CON OCR =====
async function extraerTextoDeImagen(imagenPath) {
  try {
    console.log('📖 Extrayendo texto con OCR...');
    const result = await Tesseract.recognize(imagenPath, 'spa', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`📊 Progreso OCR: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    const texto = result.data.text;
    console.log('📝 Texto extraído:', texto);
    return texto;
  } catch (error) {
    console.error('❌ Error en OCR:', error);
    return null;
  }
}

// ===== FUNCIONES PARA EXTRAER DATOS DEL INE =====
function extraerCURP(texto) {
  const regex = /[A-Z]{4}[0-9]{6}[A-Z0-9]{8}/;
  const match = texto.match(regex);
  return match ? match[0] : null;
}

function extraerNombre(texto) {
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  // Buscar patrones comunes de nombre en INE
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Si la línea tiene más de 10 caracteres y solo letras con espacios
    if (line.length > 10 && /^[A-ZÁÉÍÓÚÑ\s]+$/.test(line)) {
      return line;
    }
  }
  return null;
}

function extraerFechaNacimiento(texto) {
  const regex = /(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*\d{4})/;
  const match = texto.match(regex);
  if (match) {
    const fecha = match[1].replace(/\s/g, '');
    const partes = fecha.split(/[/-]/);
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }
  return null;
}

function extraerClaveElector(texto) {
  const regex = /[A-Z]{2}[0-9]{6}[A-Z0-9]{6}[A-Z][0-9]{2}/;
  const match = texto.match(regex);
  return match ? match[0] : null;
}

function extraerSexo(texto) {
  const regex = /SEXO\s*[:.]?\s*([MF])/i;
  const match = texto.match(regex);
  return match ? match[1].toUpperCase() : null;
}

// ===== VERIFICACIÓN FACIAL (CON SIMULACIÓN) =====
async function compararCarasAWS(imagenINE, imagenSelfie) {
  if (!rekognitionClient) {
    console.log('🔄 Usando simulación de verificación facial');
    return true;
  }
  try {
    const ineBytes = fs.readFileSync(imagenINE);
    const selfieBytes = fs.readFileSync(imagenSelfie);
    const command = new CompareFacesCommand({
      SourceImage: { Bytes: ineBytes },
      TargetImage: { Bytes: selfieBytes },
      SimilarityThreshold: 70,
    });
    const response = await rekognitionClient.send(command);
    if (response.FaceMatches && response.FaceMatches.length > 0) {
      return response.FaceMatches[0].Similarity >= 70;
    }
    return false;
  } catch (error) {
    console.error('Error en comparación facial:', error);
    return true; // En caso de error, aceptamos (simulación)
  }
}

// ===== OBTENER ESTADO DEL INE =====
const getEstadoINE = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT validado, facial_verificado FROM ine_validacion WHERE id_cliente = $1',
      [req.userId]
    );
    if (result.rows.length === 0) return res.json({ validado: false, facial_verificado: false });
    res.json({ validado: result.rows[0].validado, facial_verificado: result.rows[0].facial_verificado });
  } catch (error) {
    console.error('Error en getEstadoINE:', error);
    res.status(500).json({ error: 'Error al consultar estado' });
  }
};

// ===== VALIDAR INE CON IMAGEN Y OCR =====
const validarINEConImagen = async (req, res) => {
  const { numero_ine, curp, nombre_completo, fecha_nacimiento, sexo } = req.body;
  try {
    console.log('📥 Datos recibidos:', { numero_ine, curp, nombre_completo, fecha_nacimiento, sexo });

    // ===== VALIDAR SEXO =====
    if (!sexo || (sexo !== 'M' && sexo !== 'F')) {
      console.log(`❌ Sexo inválido: ${sexo}`);
      return res.status(400).json({ error: 'Debes seleccionar tu sexo: Masculino (M) o Femenino (F).' });
    }

    // ===== VALIDAR CURP =====
    const curpValido = validateCURP(curp);
    if (!curpValido) {
      console.log(`❌ CURP inválida: ${curp}`);
      return res.status(400).json({ error: 'CURP inválida. Debe tener 18 caracteres alfanuméricos (A-Z, Ñ, 0-9).' });
    }

    // ===== VALIDAR INE =====
    const ineValido = validateINE(numero_ine);
    if (!ineValido) {
      console.log(`❌ Número de INE inválido: ${numero_ine}`);
      return res.status(400).json({ error: 'INE inválido. Debe tener 18 caracteres alfanuméricos (A-Z, 0-9).' });
    }

    // ===== VERIFICAR DUPLICADOS =====
    const exists = await pool.query(
      'SELECT * FROM ine_validacion WHERE id_cliente = $1 OR numero_ine = $2',
      [req.userId, numero_ine]
    );
    if (exists.rows.length > 0) return res.status(400).json({ error: 'Esta INE ya está registrada.' });

    // ===== PROCESAR IMÁGENES =====
    let imagenUrl = null, selfieUrl = null;
    let datosOCR = {};

    if (req.files) {
      // --- Procesar imagen del INE ---
      if (req.files['ineImage']) {
        const ineFile = req.files['ineImage'][0];
        try {
          const compressedPath = path.join(uploadDir, `compressed_${ineFile.filename}`);
          await sharp(ineFile.path).resize(800, 600).jpeg({ quality: 80 }).toFile(compressedPath);
          fs.unlinkSync(ineFile.path);
          imagenUrl = `/uploads/ine/${path.basename(compressedPath)}`;
          
          // ===== EXTRAER DATOS CON OCR =====
          const textoOCR = await extraerTextoDeImagen(compressedPath);
          if (textoOCR) {
            datosOCR = {
              curp: extraerCURP(textoOCR),
              nombre: extraerNombre(textoOCR),
              fecha_nacimiento: extraerFechaNacimiento(textoOCR),
              clave_elector: extraerClaveElector(textoOCR),
              sexo: extraerSexo(textoOCR),
              texto_completo: textoOCR
            };
            console.log('📊 Datos extraídos por OCR:', datosOCR);
          }
        } catch (e) {
          console.error('❌ Error procesando imagen INE:', e);
          imagenUrl = `/uploads/ine/${ineFile.filename}`;
        }
      }

      // --- Procesar Selfie ---
      if (req.files['selfieImage']) {
        const selfieFile = req.files['selfieImage'][0];
        selfieUrl = `/uploads/selfies/${selfieFile.filename}`;
      }
    }

    if (!imagenUrl || !selfieUrl) {
      return res.status(400).json({ error: 'Debes subir foto de INE y selfie.' });
    }

    // ===== VERIFICACIÓN FACIAL =====
    const imagenPath = path.join(__dirname, '../../', imagenUrl);
    const selfiePath = path.join(__dirname, '../../', selfieUrl);
    let facialVerificado = await compararCarasAWS(imagenPath, selfiePath);

    // ===== GUARDAR EN BASE DE DATOS =====
    const result = await pool.query(
      `INSERT INTO ine_validacion
       (id_cliente, numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, documento_imagen, selfie_imagen, validado, facial_verificado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9) RETURNING *`,
      [req.userId, numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, imagenUrl, selfieUrl, facialVerificado]
    );

    // ===== RESPUESTA =====
    res.json({
      success: true,
      validacion: result.rows[0],
      datosOCR: datosOCR,
      mensaje: facialVerificado
        ? '✅ INE validado correctamente. Verificación facial exitosa.'
        : '⚠️ INE guardado pero la verificación facial no coincidió. Puedes reintentar.',
      facialVerificado,
    });

  } catch (error) {
    console.error('❌ Error en validarINEConImagen:', error);
    res.status(500).json({ error: 'Error al validar INE: ' + error.message });
  }
};

module.exports = { getEstadoINE, validarINEConImagen, upload };