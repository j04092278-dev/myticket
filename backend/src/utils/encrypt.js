const crypto = require('crypto');

// La clave debe ser de 32 bytes para AES-256-GCM
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'mi-clave-secreta-32-caracteres-largos!!';
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  if (!text) return null;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'utf-8'), iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return { iv: iv.toString('hex'), encrypted, authTag: authTag.toString('hex') };
  } catch (error) {
    console.error('❌ Error al encriptar:', error);
    return null;
  }
}

function decrypt(encryptedData) {
  if (!encryptedData || !encryptedData.iv || !encryptedData.encrypted) return null;
  try {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const encryptedText = Buffer.from(encryptedData.encrypted, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'utf-8'), iv);
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