// backend/src/utils/faceRecognition.js
// ============================================================
// VERIFICACIÓN FACIAL CON AWS REKOGNITION
// ============================================================

const { RekognitionClient, CompareFacesCommand } = require('@aws-sdk/client-rekognition');
const fs = require('fs');

let rekognitionClient = null;

// Inicializar cliente de AWS solo si hay credenciales
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
  rekognitionClient = new RekognitionClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log('✅ AWS Rekognition inicializado correctamente');
} else {
  console.log('⚠️ AWS Rekognition no configurado. Usando simulación.');
}

// ===== COMPARAR CARAS (REAL O SIMULACIÓN) =====
async function compararCaras(imagenINE, imagenSelfie) {
  // Si no hay AWS, usar simulación básica
  if (!rekognitionClient) {
    console.log('🔄 Usando simulación de verificación facial');
    return { 
      match: true, 
      similarity: 85, 
      mensaje: '✅ Verificación facial simulada exitosa (sin AWS)' 
    };
  }

  try {
    console.log('🔍 Verificando caras con AWS Rekognition...');
    console.log(`📸 Imagen INE: ${imagenINE}`);
    console.log(`📸 Imagen Selfie: ${imagenSelfie}`);

    const ineBytes = fs.readFileSync(imagenINE);
    const selfieBytes = fs.readFileSync(imagenSelfie);

    console.log(`📊 Tamaño imagen INE: ${ineBytes.length} bytes`);
    console.log(`📊 Tamaño imagen Selfie: ${selfieBytes.length} bytes`);

    const command = new CompareFacesCommand({
      SourceImage: { Bytes: ineBytes },
      TargetImage: { Bytes: selfieBytes },
      SimilarityThreshold: 70,
    });

    console.log('⏳ Enviando petición a AWS Rekognition...');
    const response = await rekognitionClient.send(command);
    console.log('📥 Respuesta de AWS recibida');

    if (response.FaceMatches && response.FaceMatches.length > 0) {
      const similarity = response.FaceMatches[0].Similarity;
      console.log(`✅ Similitud facial: ${similarity}%`);
      return {
        match: similarity >= 70,
        similarity: similarity,
        mensaje: similarity >= 70 
          ? `✅ Verificación facial exitosa (${similarity}%)` 
          : `⚠️ Similitud baja (${similarity}%). Reintenta con mejor iluminación.`
      };
    }

    console.log('⚠️ No se detectaron rostros coincidentes');
    return {
      match: false,
      similarity: 0,
      mensaje: '❌ No se detectaron rostros coincidentes. Asegúrate de que ambas fotos tengan rostros visibles.'
    };

  } catch (error) {
    console.error('❌ Error en verificación facial:', error);
    return {
      match: false,
      similarity: 0,
      mensaje: '❌ Error en la verificación facial: ' + error.message
    };
  }
}

module.exports = { compararCaras };