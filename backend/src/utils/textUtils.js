// utils/textUtils.js
// Utilidades mejoradas para extraer datos del INE desde OCR

function cleanText(text) {
  if (!text) return '';
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9ÑÁÉÍÓÚ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
 * Extrae CURP del texto OCR usando múltiples estrategias
 */
function extractCURP(text) {
  const clean = cleanText(text);
  // 1. Buscar etiqueta CURP seguida de 18 caracteres
  const curpLabel = /CURP\s*[:.]?\s*([A-Z0-9]{18})/i;
  let match = clean.match(curpLabel);
  if (match) return match[1].toUpperCase();

  // 2. Buscar patrón estándar: 4 letras + 6 dígitos + 6 alfanuméricos + 1 dígito/letra
  const regex = /\b([A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9X])\b/;
  match = clean.match(regex);
  if (match) return match[1].toUpperCase();

  // 3. Buscar cualquier bloque de 18 caracteres que parezca CURP (letras y números)
  const block = /\b([A-Z0-9]{18})\b/;
  const blocks = clean.match(block);
  if (blocks) {
    // Filtrar los que no sean solo números y que tengan al menos 4 letras
    const candidates = clean.match(/\b([A-Z0-9]{18})\b/g) || [];
    for (let c of candidates) {
      const letters = (c.match(/[A-Z]/g) || []).length;
      if (letters >= 4 && /[0-9]/.test(c)) {
        return c.toUpperCase();
      }
    }
  }
  return null;
}

/**
 * Extrae número de INE (Clave de Elector) del texto OCR
 */
function extractINE(text) {
  const clean = cleanText(text);
  // 1. Buscar etiqueta "CLAVE DE ELECTOR" o "CLAVE ELECTOR"
  const ineLabel = /CLAVE\s*(?:DE\s*)?ELECTOR\s*[:.]?\s*([A-Z0-9]{18})/i;
  let match = clean.match(ineLabel);
  if (match) return match[1].toUpperCase();

  // 2. Buscar "CLAVE" seguida de 18 caracteres
  const clave = /CLAVE\s*[:.]?\s*([A-Z0-9]{18})/i;
  match = clean.match(clave);
  if (match) return match[1].toUpperCase();

  // 3. Buscar cualquier bloque de 18 caracteres que no sea CURP (que tenga números y letras)
  const blocks = clean.match(/\b([A-Z0-9]{18})\b/g) || [];
  for (let b of blocks) {
    // Si tiene al menos 3 números y no es CURP (ya lo extrajimos aparte)
    const digits = (b.match(/[0-9]/g) || []).length;
    if (digits >= 3) {
      return b.toUpperCase();
    }
  }
  return null;
}

/**
 * Extrae fecha de nacimiento en formato YYYY-MM-DD
 */
function extractFecha(text) {
  const clean = cleanText(text);
  // 1. Buscar etiqueta "FECHA DE NACIMIENTO" o "NACIMIENTO"
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

  // 2. Buscar patrón suelto: DD MM YYYY o DD/MM/YYYY
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

  // 3. Buscar 8 dígitos consecutivos que parezca fecha (DDMMYYYY o YYYYMMDD)
  const digits = clean.match(/\b(\d{8})\b/);
  if (digits) {
    let d = digits[1];
    // Probar formatos: DDMMYYYY o YYYYMMDD
    let dia = d.substring(0,2);
    let mes = d.substring(2,4);
    let anio = d.substring(4,8);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && anio.length === 4) {
      return `${anio}-${mes}-${dia}`;
    }
    dia = d.substring(4,6);
    mes = d.substring(6,8);
    anio = d.substring(0,4);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && anio.length === 4) {
      return `${anio}-${mes}-${dia}`;
    }
  }
  return null;
}

/**
 * Extrae sexo (M/F) del texto OCR
 */
function extractSexo(text) {
  const clean = cleanText(text);
  // 1. Buscar etiqueta "SEXO" seguida de H/M/F
  const sexoLabel = /SEXO\s*[:.]?\s*([HMF])/i;
  let match = clean.match(sexoLabel);
  if (match) {
    let s = match[1].toUpperCase();
    if (s === 'H') return 'M';
    return s;
  }

  // 2. Buscar palabras clave
  if (clean.includes('HOMBRE') || clean.includes('MASCULINO')) return 'M';
  if (clean.includes('MUJER') || clean.includes('FEMENINO')) return 'F';

  // 3. Buscar "SEXO I" (en algunas INE aparece como "SEXO I" que significa "M" o "F"?)
  const sexoI = /SEXO\s*I/i;
  if (sexoI.test(clean)) {
    // En algunos casos "SEXO I" puede ser "M" o "F", pero no sabemos. Intentar inferir del CURP (dígito 10)
    // Devolvemos null para que se valide con otro método
    return null;
  }
  return null;
}

/**
 * Extrae nombre completo del texto OCR
 */
function extractNombre(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  // 1. Buscar línea que contenga "NOMBRE"
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('NOMBRE')) {
      let nombre = lines[i].replace(/NOMBRE\s*[:.]?\s*/i, '').trim();
      if (nombre.length > 5) {
        // Concatenar líneas siguientes que sean solo letras y espacios (sin CURP, FECHA, etc.)
        let j = i + 1;
        while (j < lines.length && 
               lines[j].match(/^[A-ZÁÉÍÓÚÑ\s]{5,}$/) && 
               !lines[j].toUpperCase().includes('CURP') && 
               !lines[j].toUpperCase().includes('CLAVE') &&
               !lines[j].toUpperCase().includes('FECHA') &&
               !lines[j].toUpperCase().includes('SEXO')) {
          nombre += ' ' + lines[j].trim();
          j++;
        }
        return cleanText(nombre);
      }
    }
  }

  // 2. Buscar líneas que parezcan nombre (3 palabras o más, sin etiquetas)
  for (let line of lines) {
    // Evitar líneas con etiquetas
    if (line.toUpperCase().includes('CURP') || 
        line.toUpperCase().includes('CLAVE') ||
        line.toUpperCase().includes('FECHA') ||
        line.toUpperCase().includes('SEXO') ||
        line.toUpperCase().includes('DOMICILIO')) {
      continue;
    }
    const words = line.split(/\s+/);
    if (words.length >= 3 && line.length > 10 && !line.match(/^\d/)) {
      return cleanText(line);
    }
  }

  // 3. Último intento: buscar cualquier línea de más de 5 caracteres sin números
  for (let line of lines) {
    if (line.length > 8 && !/\d/.test(line) && !line.toUpperCase().includes('ELECTOR')) {
      return cleanText(line);
    }
  }
  return null;
}

/**
 * Comparación difusa usando Levenshtein
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