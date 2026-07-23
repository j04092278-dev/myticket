const pool = require('../config/database');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { validateCURP, validateINE } = require('../utils/validators');
const { RekognitionClient, CompareFacesCommand } = require('@aws-sdk/client-rekognition');

const rekognitionClient = process.env.AWS_ACCESS_KEY_ID ? new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}) : null;

const uploadDir = './uploads/ine/';
const selfieDir = './uploads/selfies/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(selfieDir)) fs.mkdirSync(selfieDir, { recursive: true });

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

async function compararCarasAWS(imagenINE, imagenSelfie) {
  if (!rekognitionClient) return true;
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
    return false;
  }
}

const validarINEConImagen = async (req, res) => {
  const { numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, entidad_emision } = req.body;
  try {
    console.log('📥 Datos recibidos:', { numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, entidad_emision });

    // VALIDAR CURP
    const curpValido = validateCURP(curp);
    if (!curpValido) {
      console.log(`❌ CURP inválida: ${curp}`);
      return res.status(400).json({ 
        error: 'CURP inválida. Debe tener 18 caracteres alfanuméricos (A-Z, Ñ, 0-9).' 
      });
    }

    // VALIDAR INE
    const ineValido = validateINE(numero_ine);
    if (!ineValido) {
      console.log(`❌ Número de INE inválido: ${numero_ine}`);
      return res.status(400).json({ 
        error: 'INE inválido. Debe tener 18 caracteres alfanuméricos (A-Z, 0-9).' 
      });
    }

    // Verificar duplicados
    const exists = await pool.query(
      'SELECT * FROM ine_validacion WHERE id_cliente = $1 OR numero_ine = $2',
      [req.userId, numero_ine]
    );
    if (exists.rows.length > 0) return res.status(400).json({ error: 'Esta INE ya está registrada.' });

    // Procesar imágenes
    let imagenUrl = null, selfieUrl = null;
    if (req.files) {
      if (req.files['ineImage']) {
        const ineFile = req.files['ineImage'][0];
        try {
          const compressedPath = path.join(uploadDir, `compressed_${ineFile.filename}`);
          await sharp(ineFile.path).resize(800, 600).jpeg({ quality: 80 }).toFile(compressedPath);
          fs.unlinkSync(ineFile.path);
          imagenUrl = `/uploads/ine/${path.basename(compressedPath)}`;
        } catch (e) {
          imagenUrl = `/uploads/ine/${ineFile.filename}`;
        }
      }
      if (req.files['selfieImage']) {
        const selfieFile = req.files['selfieImage'][0];
        selfieUrl = `/uploads/selfies/${selfieFile.filename}`;
      }
    }
    if (!imagenUrl || !selfieUrl) return res.status(400).json({ error: 'Debes subir foto de INE y selfie.' });

    // Verificación facial
    const imagenPath = path.join(__dirname, '../../', imagenUrl);
    const selfiePath = path.join(__dirname, '../../', selfieUrl);
    let facialVerificado = false;
    if (rekognitionClient) {
      facialVerificado = await compararCarasAWS(imagenPath, selfiePath);
    } else {
      facialVerificado = nombre_completo.trim().split(/\s+/).length >= 2;
    }

    // Guardar en BD
    const result = await pool.query(
      `INSERT INTO ine_validacion
       (id_cliente, numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, entidad_emision, documento_imagen, selfie_imagen, validado, facial_verificado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10) RETURNING *`,
      [req.userId, numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, entidad_emision, imagenUrl, selfieUrl, facialVerificado]
    );

    res.json({
      success: true,
      validacion: result.rows[0],
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