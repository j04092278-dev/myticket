/**
 * VALIDACIÓN DE CURP (México) - SOLO FORMATO (sin dígito verificador)
 * Para pruebas. En producción, usa la versión completa.
 */
function validateCURP(curp) {
  if (!curp || typeof curp !== 'string') {
    console.log('❌ CURP vacío o no es string');
    return false;
  }

  // Limpiar: eliminar espacios, guiones, convertir a mayúsculas
  const clean = curp.trim().toUpperCase().replace(/[-\s]/g, '');
  console.log('🧹 CURP recibida:', curp);
  console.log('🧹 CURP limpia (solo formato):', clean);

  // Validar longitud y formato (4 letras + 6 dígitos + 6 alfanuméricos + 1 dígito)
  if (clean.length !== 18) {
    console.log(`❌ Longitud incorrecta: ${clean.length} (debe ser 18)`);
    return false;
  }

  // Expresión regular que acepta letras A-Z, Ñ, números, y último dígito 0-9 o X
  const regex = /^[A-ZÑ]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]$/;
  const valido = regex.test(clean);

  if (valido) {
    console.log('✅ CURP con formato válido (sin validar dígito)');
  } else {
    console.log('❌ Formato de CURP inválido (caracteres no permitidos)');
  }

  return valido; // Solo valida formato, NO el dígito verificador
}

/**
 * VALIDACIÓN DE INE (México) - COMPLETA (incluye dígito)
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

  // Validación dígito verificador (se mantiene igual)
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