/**
 * ============================================================
 * VALIDACIÓN OFICIAL DE CURP (México)
 * ============================================================
 * Algoritmo oficial de RENAPO (2024)
 * Soporte: Ñ, dígito verificador 0-9 o X
 * ============================================================
 */
function validateCURP(curp) {
  // 1. Validaciones básicas
  if (!curp || typeof curp !== 'string') {
    console.log('❌ CURP vacío o no es string');
    return false;
  }

  // 2. Limpiar: eliminar espacios, guiones, convertir a mayúsculas
  const clean = curp.trim().toUpperCase().replace(/[-\s]/g, '');
  console.log('🧹 CURP recibida:', curp);
  console.log('🧹 CURP limpia:', clean);

  // 3. Validar longitud (debe ser 18 caracteres)
  if (clean.length !== 18) {
    console.log(`❌ Longitud incorrecta: ${clean.length} (debe ser 18)`);
    return false;
  }

  // 4. Validar formato con expresión regular
  const regex = /^[A-ZÑ]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]$/;
  if (!regex.test(clean)) {
    console.log('❌ Formato inválido (caracteres no permitidos)');
    return false;
  }

  // 5. Validar dígito verificador (algoritmo oficial RENAPO)
  const alfabeto = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let suma = 0;
  
  for (let i = 0; i < 17; i++) {
    const char = clean[i];
    const valor = alfabeto.indexOf(char);
    
    if (valor === -1) {
      console.log(`❌ Carácter inválido en posición ${i}: ${char}`);
      return false;
    }
    
    suma += valor * (18 - i);
  }

  const digitoCalculado = (10 - (suma % 10)) % 10;
  const digitoEsperado = digitoCalculado === 10 ? '0' : digitoCalculado.toString();
  const digitoReal = clean[17];

  console.log(`🔢 Suma: ${suma} → Dígito esperado: ${digitoEsperado}, Dígito real: ${digitoReal}`);

  const esValido = digitoReal === digitoEsperado || (digitoReal === 'X' && digitoEsperado === '0');

  if (esValido) {
    console.log('✅ CURP válida');
  } else {
    console.log(`❌ CURP inválida: dígito verificador incorrecto. Debe ser ${digitoEsperado}`);
  }

  return esValido;
}

/**
 * ============================================================
 * VALIDACIÓN OFICIAL DE INE (México)
 * ============================================================
 */
function validateINE(numero) {
  if (!numero || typeof numero !== 'string') {
    console.log('❌ INE vacío o no es string');
    return false;
  }

  const clean = numero.trim().toUpperCase().replace(/[-\s]/g, '');
  console.log('🧹 INE limpia:', clean);

  if (clean.length !== 16) {
    console.log(`❌ Longitud INE incorrecta: ${clean.length} (debe ser 16)`);
    return false;
  }

  const regex = /^[0-9]{4}[A-Z]{3}[0-9]{6}[A-Z][0-9]{2}$/;
  if (!regex.test(clean)) {
    console.log('❌ Formato INE inválido');
    return false;
  }

  const digitos = clean.substring(0, 15).split('');
  let suma = 0;
  let multiplicador = 2;

  for (let i = digitos.length - 1; i >= 0; i--) {
    const val = parseInt(digitos[i], 36);
    if (isNaN(val)) {
      console.log('❌ Carácter inválido en INE:', digitos[i]);
      return false;
    }
    suma += val * multiplicador;
    multiplicador = multiplicador === 2 ? 1 : 2;
  }

  const digitoCalculado = (10 - (suma % 10)) % 10;
  const digitoEsperado = digitoCalculado === 10 ? '0' : digitoCalculado.toString();
  const digitoReal = clean[15];

  console.log(`🔢 INE Suma: ${suma} → Dígito esperado: ${digitoEsperado}, Dígito real: ${digitoReal}`);

  const esValido = digitoReal === digitoEsperado;

  if (esValido) {
    console.log('✅ INE válida');
  } else {
    console.log(`❌ INE inválida: dígito verificador incorrecto. Debe ser ${digitoEsperado}`);
  }

  return esValido;
}

module.exports = { validateCURP, validateINE };