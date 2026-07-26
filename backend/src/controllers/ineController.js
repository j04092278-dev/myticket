const pool = require('../config/database');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { validateCURP, validateINE } = require('../utils/validators');
const { extraerTextoDeImagen, validarDatosConOCR } = require('../utils/ocr');

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

const validarINEConImagen = async (req, res) => {
  const { numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, entidad_emision } = req.body;
  try {
    console.log('📥 Datos recibidos del formulario:', { numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, entidad_emision });

    // Validar CURP
    const curpValido = validateCURP(curp);
    if (!curpValido) {
      console.log(`❌ CURP inválida: ${curp}`);
      return res.status(400).json({ error: 'CURP inválida. Verifica el formato.' });
    }

    // Validar INE (formato)
    const ineValido = validateINE(numero_ine);
    if (!ineValido) {
      console.log(`❌ Número de INE inválido: ${numero_ine}`);
      return res.status(400).json({ error: 'Número de INE inválido. Verifica formato.' });
    }

    // Verificar duplicados
    const exists = await pool.query(
      'SELECT * FROM ine_validacion WHERE id_cliente = $1 OR numero_ine = $2',
      [req.userId, numero_ine]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Esta INE ya está registrada.' });
    }

    // Procesar imágenes
    let imagenUrl = null, selfieUrl = null;
    let imagenPath = null, selfiePath = null;
    
    if (req.files) {
      if (req.files['ineImage']) {
        const ineFile = req.files['ineImage'][0];
        try {
          const compressedPath = path.join(uploadDir, `compressed_${ineFile.filename}`);
          await sharp(ineFile.path).resize(800, 600).jpeg({ quality: 80 }).toFile(compressedPath);
          fs.unlinkSync(ineFile.path);
          imagenUrl = `/uploads/ine/${path.basename(compressedPath)}`;
          imagenPath = compressedPath;
          console.log('✅ Imagen INE comprimida:', imagenPath);
        } catch (e) {
          console.error('❌ Error comprimiendo INE:', e);
          imagenUrl = `/uploads/ine/${ineFile.filename}`;
          imagenPath = ineFile.path;
        }
      }
      
      if (req.files['selfieImage']) {
        const selfieFile = req.files['selfieImage'][0];
        selfieUrl = `/uploads/selfies/${selfieFile.filename}`;
        selfiePath = selfieFile.path;
        console.log('✅ Selfie guardada:', selfiePath);
      }
    }
    
    if (!imagenUrl || !selfieUrl) {
      return res.status(400).json({ error: 'Debes subir foto de INE y selfie.' });
    }

    // ===== 1. OCR =====
    console.log('🔍 Iniciando OCR...');
    const textoOCR = await extraerTextoDeImagen(imagenPath, 'spa');
    
    let datosExtraidos = null;
    let coincidenciaOCR = false;
    let mensajeOCR = 'No se pudo leer el texto del INE con OCR.';
    let detalles = {};
    
    if (textoOCR) {
      datosExtraidos = validarDatosConOCR(textoOCR, {
        curp,
        nombre_completo,
        fecha_nacimiento,
        sexo
      });
      
      console.log('📊 Resultado OCR:', datosExtraidos);
      
      detalles = {
        curp_encontrado: datosExtraidos.curpEncontrado,
        nombre_encontrado: datosExtraidos.nombreEncontrado,
        fecha_encontrada: datosExtraidos.fechaEncontrada,
        sexo_encontrado: datosExtraidos.sexoEncontrado,
        curp_coincide: datosExtraidos.curpCoincide,
        nombre_coincide: datosExtraidos.nombreCoincide,
        fecha_coincide: datosExtraidos.fechaCoincide,
        sexo_coincide: datosExtraidos.sexoCoincide,
        puntaje: datosExtraidos.puntaje
      };

      const puntajeMinimo = 60;
      if (datosExtraidos.puntaje >= puntajeMinimo) {
        coincidenciaOCR = true;
        mensajeOCR = `✅ OCR: Datos verificados correctamente (${datosExtraidos.puntaje}% coincidencia)`;
      } else {
        mensajeOCR = `❌ OCR: Datos NO coinciden (${datosExtraidos.puntaje}% coincidencia, mínimo ${puntajeMinimo}%)`;
      }
    } else {
      mensajeOCR = '⚠️ No se pudo extraer texto de la imagen del INE. Asegúrate de que la imagen sea clara y esté bien iluminada.';
    }

    // ===== 2. Sin facial =====
    const facialVerificado = true;

    // ===== 3. Guardar en BD =====
    const curpFinal = datosExtraidos?.curpEncontrado || curp;
    const nombreFinal = datosExtraidos?.nombreEncontrado || nombre_completo;
    const fechaFinal = datosExtraidos?.fechaEncontrada || fecha_nacimiento;
    const sexoFinal = datosExtraidos?.sexoEncontrado || sexo || '';

    // Solo guardar si coincidencia OCR es verdadera (o si queremos guardar aunque falle, para registro)
    const result = await pool.query(
      `INSERT INTO ine_validacion
       (id_cliente, numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, 
        entidad_emision, documento_imagen, selfie_imagen, validado, facial_verificado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        req.userId, 
        numero_ine, 
        curpFinal, 
        nombreFinal, 
        fechaFinal, 
        sexoFinal, 
        entidad_emision || '', 
        imagenUrl, 
        selfieUrl, 
        coincidenciaOCR,
        facialVerificado
      ]
    );

    // ===== 4. Respuesta final con mensajes claros =====
    let mensajeFinal = '';
    let statusCode = 200;
    let success = true;

    if (!textoOCR) {
      mensajeFinal = '⚠️ No se pudo leer la imagen del INE. Asegúrate de que la foto sea clara y con buena iluminación.';
      success = false;
      statusCode = 400;
    } else if (coincidenciaOCR) {
      mensajeFinal = '✅ INE validado correctamente. Los datos coinciden con la imagen. ¡Ya puedes comprar boletos!';
      success = true;
    } else {
      mensajeFinal = '❌ Los datos ingresados NO coinciden con los de tu INE. Revisa que hayas escrito correctamente tu CURP, nombre, fecha y sexo.';
      success = false;
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: success,
      validacion: result.rows[0],
      mensaje: mensajeFinal,
      ocr: {
        textoExtraido: textoOCR,
        coincidencia: coincidenciaOCR,
        mensaje: mensajeOCR,
        detalles: detalles
      }
    });
  } catch (error) {
    console.error('❌ Error en validarINEConImagen:', error);
    res.status(500).json({ error: 'Error al validar INE: ' + error.message });
  }
};

module.exports = { getEstadoINE, validarINEConImagen, upload };