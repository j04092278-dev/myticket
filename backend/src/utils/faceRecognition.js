const { RekognitionClient, CompareFacesCommand } = require('@aws-sdk/client-rekognition');
const fs = require('fs');

let rekognitionClient = null;

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  rekognitionClient = new RekognitionClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log('✅ AWS Rekognition inicializado');
} else {
  console.log('⚠️ AWS Rekognition no configurado. Usando simulación.');
}

async function compararCaras(imagenINE, imagenSelfie) {
  if (!rekognitionClient) {
    console.log('🔄 Usando simulación de verificación facial');
    return { 
      match: true, 
      similarity: 85, 
      mensaje: '✅ Verificación facial simulada exitosa' 
    };
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

    return {
      match: false,
      similarity: 0,
      mensaje: '❌ No se detectaron rostros coincidentes.'
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