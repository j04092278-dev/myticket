const crypto = require('crypto');

function getValidKey(rawKey) {
  if (!rawKey) {
    console.warn('⚠️ ENCRYPTION_KEY no definida. Usando clave por defecto (inseguro en producción).');
    return 'mi-clave-secreta-32-caracteres-largos!!';
  }
  if (rawKey.length < 32) {
    return rawKey.padEnd(32, '0');
  } else if (rawKey.length > 32) {
    return rawKey.substring(0, 32);
  }
  return rawKey;
}

const SECRET_KEY = getValidKey(process.env.ENCRYPTION_KEY);
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  if (!text) return null;
  try {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(SECRET_KEY, 'utf-8');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      encrypted: encrypted,
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('❌ Error al encriptar:', error);
    return null;
  }
}

function decrypt(encryptedData) {
  if (!encryptedData || !encryptedData.iv || !encryptedData.encrypted || !encryptedData.authTag) {
    console.error('❌ Datos de encriptación incompletos');
    return null;
  }
  try {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const encryptedText = Buffer.from(encryptedData.encrypted, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const key = Buffer.from(SECRET_KEY, 'utf-8');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  } catch (error) {
    console.error('❌ Error al desencriptar:', error);
    return null;
  }
}

module.exports = { encrypt, decrypt };