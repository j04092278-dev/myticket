/**
 * VALIDACIÓN DE CURP (México) con logs detallados
 */
function validateCURP(curp) {
  if (!curp || typeof curp !== 'string') {
    console.log('❌ CURP vacío o no es string');
    return false;
  }

  // Limpiar: eliminar espacios, guiones, convertir a mayúsculas
  const clean = curp.trim().toUpperCase().replace(/[-\s]/g, '');
  console.log('🧹 CURP recibida:', curp);
  console.log('🧹 CURP limpia:', clean);

  if (clean.length !== 18) {
    console.log(`❌ Longitud incorrecta: ${clean.length} (debe ser 18)`);
    return false;
  }

  // Validar formato con regex (incluye Ñ y dígito verificador 0-9 o X)
  const regex = /^[A-ZÑ]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]$/;
  if (!regex.test(clean)) {
    console.log('❌ Formato inválido (regex no coincide)');
    return false;
  }

  // Algoritmo del dígito verificador
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

  // Comparación (permite X cuando el cálculo da 0)
  const valido = digitoReal === digitoEsperado || (digitoReal === 'X' && digitoEsperado === '0');

  if (!valido) {
    console.log(`❌ CURP inválida: dígito verificador incorrecto. Debe ser ${digitoEsperado}`);
  } else {
    console.log('✅ CURP válida');
  }

  // ===== OPCIÓN: solo valida formato (sin dígito) para pruebas =====
  // Descomenta la línea de abajo y comenta la de arriba para pruebas:
  // return true; // <-- Esto hará que todas las CURP con formato válido pasen
  // ===================================================================

  return valido;
}

/**
 * VALIDACIÓN DE INE (México) con logs
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

  // Validación dígito verificador
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
  return digitoReal === digitoEsperado;
}

module.exports = { validateCURP, validateINE };