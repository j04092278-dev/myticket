/**
 * ============================================================
 * VALIDACIÓN DE CURP (México) - SOLO FORMATO (18 caracteres)
 * ============================================================
 * Acepta: 4 letras + 6 dígitos + 6 alfanuméricos + 2 dígitos (o X)
 * Ejemplo válido: MAHJ061219HDFRRNA6 (18 caracteres)
 * ============================================================
 */
function validateCURP(curp) {
  if (!curp || typeof curp !== 'string') {
    console.log('❌ CURP vacío o no es string');
    return false;
  }

  // Limpiar: eliminar espacios, guiones, caracteres especiales
  const clean = curp.trim().toUpperCase().replace(/[^A-ZÑ0-9]/g, '');
  console.log('🧹 CURP original:', curp);
  console.log('🧹 CURP limpia:', clean);

  // Validar longitud (debe ser 18 caracteres)
  if (clean.length !== 18) {
    console.log(`❌ Longitud incorrecta: ${clean.length} (debe ser 18)`);
    return false;
  }

  // Validar formato: 4 letras, 6 dígitos, 6 alfanuméricos, 2 dígitos (0-9 o X)
  const regex = /^[A-ZÑ]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]{2}$/;
  const esValido = regex.test(clean);

  if (esValido) {
    console.log('✅ CURP con formato válido (18 caracteres)');
  } else {
    console.log('❌ Formato de CURP inválido');
    console.log('   Requisitos: 4 letras, 6 números, 6 alfanuméricos, 2 dígitos (0-9 o X)');
    console.log('   Ejemplo: MAHJ061219HDFRRNA6');
  }

  return esValido; // Solo formato, SIN dígito verificador
}

/**
 * ============================================================
 * VALIDACIÓN DE INE (México) - COMPLETA (con dígito)
 * ============================================================
 */
function validateINE(numero) {
  if (!numero || typeof numero !== 'string') {
    console.log('❌ INE vacío o no es string');
    return false;
  }

  const clean = numero.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  console.log('🧹 INE limpia:', clean);

  if (clean.length !== 16) {
    console.log(`❌ Longitud INE incorrecta: ${clean.length} (debe ser 16)`);
    return false;
  }

 const regex = /^[A-ZÑ]{4}[0-9]{6}[A-Z0-9]{8}$/;
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