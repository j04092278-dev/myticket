// utils/textUtils.js
// Utilidades para limpiar y comparar texto extraído por OCR

/**
 * Limpia un string eliminando espacios extra, caracteres especiales y normalizando mayúsculas
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9ÑÁÉÍÓÚ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Corrige caracteres comunes confusos en OCR (0 vs O, 1 vs I, etc.)
 */
function correctOcrChars(text) {
  if (!text) return '';
  const corrections = {
    '0': 'O',
    '1': 'I',
    '5': 'S',
    '8': 'B',
  };
  let corrected = '';
  for (let ch of text) {
    corrected += corrections[ch] || ch;
  }
  return corrected;
}

/**
 * Extrae el CURP de un texto OCR usando múltiples patrones
 */
function extractCURP(text) {
  const clean = cleanText(text);
  const regex = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
  const match = clean.match(regex);
  if (match) return match[1];
  const curpLabel = /CURP\s*[:.]?\s*([A-Z0-9]{18})/i;
  const matchLabel = clean.match(curpLabel);
  if (matchLabel) return matchLabel[1].toUpperCase();
  return null;
}

/**
 * Extrae el número de INE (Clave de Elector)
 */
function extractINE(text) {
  const clean = cleanText(text);
  const ineLabel = /CLAVE\s*(?:DE\s*)?ELECTOR\s*[:.]?\s*([A-Z0-9]{18})/i;
  const match = clean.match(ineLabel);
  if (match) return match[1].toUpperCase();
  const ineBlock = /\b([A-Z0-9]{18})\b/;
  const allBlocks = clean.match(ineBlock);
  if (allBlocks) return allBlocks[0].toUpperCase();
  return null;
}

/**
 * Extrae fecha de nacimiento (formato YYYY-MM-DD o DD/MM/YYYY)
 */
function extractFecha(text) {
  const clean = cleanText(text);
  const fechaLabel = /(?:FECHA\s*DE\s*NACIMIENTO|NACIMIENTO)\s*[:.]?\s*(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})/i;
  let match = clean.match(fechaLabel);
  if (match) {
    let dia = match[1].padStart(2, '0');
    let mes = match[2].padStart(2, '0');
    let anio = match[3];
    if (anio.length === 2) anio = '20' + anio;
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      return `${anio}-${mes}-${dia}`;
    }
  }
  const fechaSimple = /\b(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{4})\b/;
  match = clean.match(fechaSimple);
  if (match) {
    let dia = match[1].padStart(2, '0');
    let mes = match[2].padStart(2, '0');
    let anio = match[3];
    if (anio.length === 2) anio = '20' + anio;
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      return `${anio}-${mes}-${dia}`;
    }
  }
  return null;
}

/**
 * Extrae sexo (M/F)
 */
function extractSexo(text) {
  const clean = cleanText(text);
  const sexoLabel = /SEXO\s*[:.]?\s*([HMF])/i;
  const match = clean.match(sexoLabel);
  if (match) {
    let s = match[1].toUpperCase();
    if (s === 'H') return 'M';
    return s;
  }
  if (clean.includes('HOMBRE') || clean.includes('MASCULINO')) return 'M';
  if (clean.includes('MUJER') || clean.includes('FEMENINO')) return 'F';
  return null;
}

/**
 * Extrae nombre completo
 */
function extractNombre(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('NOMBRE')) {
      let nombre = lines[i].replace(/NOMBRE\s*[:.]?\s*/i, '').trim();
      if (nombre.length > 5) {
        let j = i + 1;
        while (j < lines.length && lines[j].match(/^[A-ZÁÉÍÓÚÑ\s]{5,}$/) && !lines[j].toUpperCase().includes('CURP')) {
          nombre += ' ' + lines[j].trim();
          j++;
        }
        return cleanText(nombre);
      }
    }
  }
  for (let line of lines) {
    const words = line.split(/\s+/);
    if (words.length >= 3 && line.length > 10 && !line.toUpperCase().includes('CURP') && !line.toUpperCase().includes('INE')) {
      return cleanText(line);
    }
  }
  return null;
}

/**
 * Compara dos strings con tolerancia (Jaro‑Winkler aproximado por Levenshtein)
 */
function fuzzyMatch(str1, str2, threshold = 0.7) {
  if (!str1 || !str2) return false;
  const s1 = cleanText(str1);
  const s2 = cleanText(str2);
  if (s1 === s2) return true;
  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return true;
  const similarity = 1 - (distance / maxLen);
  return similarity >= threshold;
}

/**
 * Distancia de Levenshtein
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i-1] === a[j-1]) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, matrix[i][j-1] + 1, matrix[i-1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

module.exports = {
  cleanText,
  correctOcrChars,
  extractCURP,
  extractINE,
  extractFecha,
  extractSexo,
  extractNombre,
  fuzzyMatch,
  levenshteinDistance
};