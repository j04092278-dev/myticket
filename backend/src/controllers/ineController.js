const pool = require('../config/database');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { validateCURP, validateINE } = require('../utils/validators');
const { extraerTextoDeImagen, validarDatosConOCR } = require('../utils/ocr');
const { compararCaras } = require('../utils/faceRecognition');

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

// ===== FUNCIÓN PARA LIMPIAR NOMBRE =====
const limpiarNombre = (nombre) => {
  if (!nombre) return '';
  return nombre
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const validarINEConImagen = async (req, res) => {
  const { numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, entidad_emision } = req.body;
  try {
    console.log('📥 Datos recibidos del formulario:', { numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, entidad_emision });

    // Validar CURP y formato de INE
    const curpValido = validateCURP(curp);
    if (!curpValido) {
      console.log(`❌ CURP inválida: ${curp}`);
      return res.status(400).json({ error: 'CURP inválida. Verifica el formato.' });
    }

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

    // ===== OCR MEJORADO =====
    console.log('🔍 Iniciando OCR (versión mejorada con AWS + Tesseract)...');
    const textoOCR = await extraerTextoDeImagen(imagenPath, 'spa');
    
    let datosExtraidos = null;
    let coincidenciaOCR = false;
    let mensajeOCR = 'No se pudo leer el texto del INE con OCR.';
    
    if (textoOCR) {
      datosExtraidos = validarDatosConOCR(textoOCR, {
        curp,
        nombre_completo,
        fecha_nacimiento,
        sexo
      });
      
      console.log('📊 Resultado OCR:', datosExtraidos);
      
      const puntajeMinimo = 30;
      if (datosExtraidos.puntaje >= puntajeMinimo) {
        coincidenciaOCR = true;
        mensajeOCR = `✅ OCR verificó los datos del INE (${datosExtraidos.puntaje}% coincidencia)`;
        console.log('✅ OCR: Datos verificados correctamente');
      } else {
        mensajeOCR = `❌ OCR: Los datos no coinciden (${datosExtraidos.puntaje}% coincidencia, mínimo ${puntajeMinimo}%)`;
        console.log('❌ OCR: Datos no coinciden');
      }
    } else {
      mensajeOCR = '❌ No se pudo extraer texto de la imagen del INE. Asegúrate de que la foto sea clara.';
      console.log('❌ OCR: No se pudo extraer texto');
    }

    // ===== VERIFICACIÓN FACIAL =====
    console.log('🔍 Iniciando verificación facial con AWS Rekognition...');
    const resultadoFacial = await compararCaras(imagenPath, selfiePath);
    console.log('📊 Resultado facial:', resultadoFacial);

    // Si la validación OCR falla, NO guardar en BD y devolver error
    if (!coincidenciaOCR || !resultadoFacial.match) {
      if (imagenPath && fs.existsSync(imagenPath)) {
        try { fs.unlinkSync(imagenPath); } catch(e) {}
      }
      if (selfiePath && fs.existsSync(selfiePath)) {
        try { fs.unlinkSync(selfiePath); } catch(e) {}
      }
      
      const errorMsg = !coincidenciaOCR 
        ? 'Los datos de la imagen no coinciden con los ingresados. Verifica que la foto sea clara y los datos correctos.'
        : 'La verificación facial no fue exitosa. Asegúrate de que la selfie sea clara y coincida con la foto del INE.';
      
      return res.status(400).json({
        error: errorMsg,
        ocr: {
          textoExtraido: textoOCR || 'No se pudo extraer texto',
          datosExtraidos: datosExtraidos || null,
          coincidencia: coincidenciaOCR,
          mensaje: mensajeOCR
        },
        facial: {
          match: resultadoFacial.match,
          similarity: resultadoFacial.similarity || 0,
          mensaje: resultadoFacial.mensaje
        }
      });
    }

    // ===== LIMPIAR Y TRUNCAR NOMBRE =====
    let curpFinal = datosExtraidos?.curpEncontrado || curp;
    let nombreFinal = limpiarNombre(datosExtraidos?.nombreEncontrado || nombre_completo);
    let fechaFinal = datosExtraidos?.fechaEncontrada || fecha_nacimiento;
    let sexoFinal = datosExtraidos?.sexoEncontrado || sexo || '';

    // Truncar nombre a 200 caracteres (seguro)
    if (nombreFinal && nombreFinal.length > 200) {
      nombreFinal = nombreFinal.substring(0, 200);
      console.log(`⚠️ Nombre truncado a 200 caracteres`);
    }

    console.log('📝 Datos a guardar:', { curpFinal, nombreFinal, fechaFinal, sexoFinal });

    // Guardar en BD
    const result = await pool.query(
      `INSERT INTO ine_validacion
       (id_cliente, numero_ine, curp, nombre_completo, fecha_nacimiento, sexo, 
        entidad_emision, documento_imagen, selfie_imagen, validado, facial_verificado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10) RETURNING *`,
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
        resultadoFacial.match
      ]
    );

    res.json({
      success: true,
      validacion: result.rows[0],
      mensaje: '✅ INE validado correctamente. OCR y verificación facial exitosos.',
      ocr: {
        textoExtraido: textoOCR,
        datosExtraidos: datosExtraidos,
        coincidencia: true,
        mensaje: mensajeOCR
      },
      facial: {
        match: resultadoFacial.match,
        similarity: resultadoFacial.similarity || 0,
        mensaje: resultadoFacial.mensaje
      }
    });

  } catch (error) {
    console.error('❌ Error en validarINEConImagen:', error);
    if (req.files) {
      if (req.files['ineImage'] && req.files['ineImage'][0] && fs.existsSync(req.files['ineImage'][0].path)) {
        try { fs.unlinkSync(req.files['ineImage'][0].path); } catch(e) {}
      }
      if (req.files['selfieImage'] && req.files['selfieImage'][0] && fs.existsSync(req.files['selfieImage'][0].path)) {
        try { fs.unlinkSync(req.files['selfieImage'][0].path); } catch(e) {}
      }
    }
    res.status(500).json({ error: 'Error al validar INE: ' + error.message });
  }
};

module.exports = { getEstadoINE, validarINEConImagen, upload };