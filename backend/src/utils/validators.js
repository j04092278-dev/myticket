/**
 * ============================================================
 * VALIDACIÓN REAL DE CURP (México) 
 * ============================================================
 * Formato: 18 caracteres alfanuméricos (A-Z, Ñ, 0-9)
 * Ejemplo: MAHJ061219HDFRRNA6
 * ============================================================
 */
function validateCURP(curp) {
  if (!curp || typeof curp !== 'string') {
    console.log('❌ CURP vacío o no es string');
    return false;
  }

  // Limpiar: solo letras (A-Z, Ñ) y números
  const clean = curp.trim().toUpperCase().replace(/[^A-ZÑ0-9]/g, '');
  console.log('🧹 CURP original:', curp);
  console.log('🧹 CURP limpia:', clean);

  // Validar: exactamente 18 caracteres alfanuméricos
  if (clean.length !== 18) {
    console.log(`❌ Longitud CURP incorrecta: ${clean.length} (debe ser 18)`);
    return false;
  }

  // Verificar que todos los caracteres sean válidos
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
 * VALIDACIÓN REAL DE INE / CLAVE DE ELECTOR (México)
 * ============================================================
 * Formato: 18 caracteres alfanuméricos (A-Z, 0-9)
 * Ejemplo: MRHRJN06121909H900
 * ============================================================
 */
function validateINE(numero) {
  if (!numero || typeof numero !== 'string') {
    console.log('❌ INE vacío o no es string');
    return false;
  }

  // Limpiar: solo letras (A-Z) y números
  const clean = numero.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  console.log('🧹 INE original:', numero);
  console.log('🧹 INE limpia:', clean);

  // Validar: exactamente 18 caracteres alfanuméricos
  if (clean.length !== 18) {
    console.log(`❌ Longitud INE incorrecta: ${clean.length} (debe ser 18)`);
    return false;
  }

  // Verificar que todos los caracteres sean válidos
  const esValido = /^[A-Z0-9]{18}$/.test(clean);
  
  if (esValido) {
    console.log('✅ INE válida (18 caracteres alfanuméricos)');
  } else {
    console.log('❌ INE inválida: contiene caracteres no permitidos');
  }
  
  return esValido;
}

module.exports = { validateCURP, validateINE };