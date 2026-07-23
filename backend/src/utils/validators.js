/**
 * ============================================================
 * VALIDACIÓN DE CURP - SOLO LONGITUD Y CARACTERES
 * ============================================================
 * Acepta: EXACTAMENTE 18 caracteres alfanuméricos (A-Z, Ñ, 0-9)
 * ============================================================
 */
function validateCURP(curp) {
  if (!curp || typeof curp !== 'string') {
    console.log('❌ CURP vacío o no es string');
    return false;
  }

  const clean = curp.trim().toUpperCase().replace(/[^A-ZÑ0-9]/g, '');
  console.log('🧹 CURP original:', curp);
  console.log('🧹 CURP limpia:', clean);

  if (clean.length !== 18) {
    console.log(`❌ Longitud CURP incorrecta: ${clean.length} (debe ser 18)`);
    return false;
  }

  const esValido = /^[A-ZÑ0-9]{18}$/.test(clean);
  if (esValido) {
    console.log('✅ CURP válida (18 caracteres alfanuméricos)');
  } else {
    console.log('❌ CURP inválida: contiene caracteres no permitidos');
  }
  return esValido;
}

/**
 * ============================================================
 * VALIDACIÓN DE INE - SOLO LONGITUD Y CARACTERES
 * ============================================================
 * Acepta: EXACTAMENTE 18 caracteres alfanuméricos (A-Z, 0-9)
 * ============================================================
 */
function validateINE(numero) {
  if (!numero || typeof numero !== 'string') {
    console.log('❌ INE vacío o no es string');
    return false;
  }

  const clean = numero.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  console.log('🧹 INE original:', numero);
  console.log('🧹 INE limpia:', clean);

  if (clean.length !== 18) {
    console.log(`❌ Longitud INE incorrecta: ${clean.length} (debe ser 18)`);
    return false;
  }

  const esValido = /^[A-Z0-9]{18}$/.test(clean);
  if (esValido) {
    console.log('✅ INE válida (18 caracteres alfanuméricos)');
  } else {
    console.log('❌ INE inválida: contiene caracteres no permitidos');
  }
  return esValido;
}

module.exports = { validateCURP, validateINE };