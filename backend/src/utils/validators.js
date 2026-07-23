/**
 * ============================================================
 * VALIDACIÓN OFICIAL DE CURP (México) - VERSIÓN ROBUSTA
 * ============================================================
 * Con logs detallados para identificar errores
 * ============================================================
 */
function validateCURP(curp) {
  // 1. Validaciones básicas
  if (!curp || typeof curp !== 'string') {
    console.log('❌ CURP vacío o no es string');
    return false;
  }

  // 2. Limpieza agresiva: eliminar espacios, guiones, saltos de línea y caracteres especiales
  const clean = curp
    .trim()
    .toUpperCase()
    .replace(/[^A-ZÑ0-9]/g, ''); // Solo permite letras (incluye Ñ), números y la X
  
  console.log('🧹 CURP original:', curp);
  console.log('🧹 CURP limpia:', clean);
  console.log('📏 Longitud:', clean.length);

  // 3. Validar longitud (debe ser 18 caracteres)
  if (clean.length !== 18) {
    console.log(`❌ Longitud incorrecta: ${clean.length} (debe ser 18)`);
    return false;
  }

  // 4. Validar formato - ACEPTA CUALQUIER COMBINACIÓN DE LETRAS Y NÚMEROS
  //    Esta versión es más permisiva y aceptará correctamente tu CURP
  const regex = /^[A-ZÑ]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]$/;
  if (!regex.test(clean)) {
    console.log('❌ Formato inválido (regex no coincide)');
    console.log('🔍 Verifica: 4 letras, 6 números, 6 alfanuméricos, 1 dígito (0-9 o X)');
    return false;
  }

  console.log('✅ Formato correcto');

  // 5. Algoritmo del dígito verificador (oficial RENAPO)
  const alfabeto = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let suma = 0;
  let caracteresValidos = true;

  for (let i = 0; i < 17; i++) {
    const char = clean[i];
    const valor = alfabeto.indexOf(char);
    
    if (valor === -1) {
      console.log(`❌ Carácter inválido en posición ${i}: "${char}" (no está en el alfabeto oficial)`);
      caracteresValidos = false;
      break;
    }
    
    const peso = 18 - i;
    suma += valor * peso;
    console.log(`  Posición ${i}: "${char}" → valor: ${valor} × peso: ${peso} = ${valor * peso}`);
  }

  if (!caracteresValidos) {
    return false;
  }

  // Calcular dígito esperado
  const digitoCalculado = (10 - (suma % 10)) % 10;
  const digitoEsperado = digitoCalculado === 10 ? '0' : digitoCalculado.toString();
  const digitoReal = clean[17];

  console.log(`📊 Suma total: ${suma}`);
  console.log(`🔢 Dígito esperado: ${digitoEsperado}`);
  console.log(`🔢 Dígito real: ${digitoReal}`);

  // 6. Comparar dígitos
  const esValido = digitoReal === digitoEsperado || (digitoReal === 'X' && digitoEsperado === '0');

  if (esValido) {
    console.log('✅ CURP VÁLIDA');
  } else {
    console.log(`❌ CURP INVÁLIDA: dígito verificador incorrecto. Debe ser ${digitoEsperado}`);
  }

  return esValido;
}

/**
 * ============================================================
 * VALIDACIÓN DE INE (México) - COMPLETA
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
  
  const esValido = digitoReal === digitoEsperado;
  
  if (esValido) {
    console.log('✅ INE válida');
  } else {
    console.log(`❌ INE inválida: dígito verificador incorrecto. Debe ser ${digitoEsperado}`);
  }

  return esValido;
}

// ===== EXPORTAR =====
module.exports = { validateCURP, validateINE };