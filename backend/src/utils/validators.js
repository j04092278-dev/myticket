/**
 * VALIDACIÓN DE CURP (México)
 * Regla oficial: 4 letras (incluye Ñ), 6 dígitos (fecha), 6 caracteres (homoclave), 1 dígito verificador (0-9 o X)
 * Ejemplo: GODE561231HDFRRL09
 */
function validateCURP(curp) {
  if (!curp || typeof curp !== 'string') return false;

  // Limpiar: eliminar espacios, guiones, convertir a mayúsculas
  const clean = curp.trim().toUpperCase().replace(/[-\s]/g, '');

  // 1. Validar formato con expresión regular (incluye Ñ y dígito verificador 0-9 o X)
  const regex = /^[A-ZÑ]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]$/;
  if (!regex.test(clean)) return false;

  // 2. Validar dígito verificador (algoritmo oficial)
  const letras = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'; // Índice 0-36
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    const char = clean[i];
    const valor = letras.indexOf(char);
    if (valor === -1) return false; // Carácter no válido
    suma += valor * (18 - i); // Pesos de 18 a 2
  }

  const digitoCalculado = (10 - (suma % 10)) % 10;
  const digitoVerificador = digitoCalculado === 10 ? '0' : digitoCalculado.toString();

  return clean[17] === digitoVerificador || clean[17] === 'X' && digitoVerificador === '0';
}

/**
 * VALIDACIÓN DE INE (México)
 * Formato: 4 dígitos + 3 letras + 6 dígitos + 1 letra + 2 dígitos (16 caracteres)
 * Ejemplo: 1234ABC123456A12
 */
function validateINE(numero) {
  if (!numero || typeof numero !== 'string') return false;

  // Limpiar: eliminar espacios, guiones, convertir a mayúsculas
  const clean = numero.trim().toUpperCase().replace(/[-\s]/g, '');

  // 1. Validar formato
  const regex = /^[0-9]{4}[A-Z]{3}[0-9]{6}[A-Z][0-9]{2}$/;
  if (!regex.test(clean)) return false;

  // 2. Validar dígito verificador (los primeros 15 caracteres, usando factores 2 y 1)
  const digitos = clean.substring(0, 15).split('');
  let suma = 0;
  let multiplicador = 2; // Empieza en 2, alterna entre 2 y 1

  // Recorremos de derecha a izquierda
  for (let i = digitos.length - 1; i >= 0; i--) {
    const char = digitos[i];
    // Convertir carácter a número (base 36 para letras A-Z, 0-9)
    const val = parseInt(char, 36);
    if (isNaN(val)) return false; // Carácter inválido
    suma += val * multiplicador;
    // Alternar multiplicador: 2 → 1 → 2 → 1 ...
    multiplicador = multiplicador === 2 ? 1 : 2;
  }

  const digitoCalculado = (10 - (suma % 10)) % 10;
  const digitoVerificador = digitoCalculado === 10 ? '0' : digitoCalculado.toString();

  // El dígito verificador es el carácter en la posición 15 (16º)
  return clean[15] === digitoVerificador;
}

module.exports = { validateCURP, validateINE };