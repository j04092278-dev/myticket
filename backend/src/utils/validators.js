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
  //    [A-ZÑ]{4} - 4 letras (incluye Ñ)
  //    [0-9]{6}  - 6 dígitos (fecha)
  //    [A-Z0-9]{6} - 6 caracteres alfanuméricos (homoclave)
  //    [0-9X] - dígito verificador (0-9 o X)
  const regex = /^[A-ZÑ]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]$/;
  if (!regex.test(clean)) {
    console.log('❌ Formato inválido (caracteres no permitidos)');
    return false;
  }

  // 5. Validar dígito verificador (algoritmo oficial RENAPO)
  const alfabeto = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let suma = 0;
  
  // Recorrer los primeros 17 caracteres
  for (let i = 0; i < 17; i++) {
    const char = clean[i];
    const valor = alfabeto.indexOf(char);
    
    // Si el carácter no está en el alfabeto, es inválido
    if (valor === -1) {
      console.log(`❌ Carácter inválido en posición ${i}: ${char}`);
      return false;
    }
    
    // Peso: 18 - i (empieza en 18 y termina en 2)
    suma += valor * (18 - i);
  }

  // Calcular dígito esperado
  const digitoCalculado = (10 - (suma % 10)) % 10;
  const digitoEsperado = digitoCalculado === 10 ? '0' : digitoCalculado.toString();
  const digitoReal = clean[17];

  console.log(`🔢 Suma: ${suma} → Dígito esperado: ${digitoEsperado}, Dígito real: ${digitoReal}`);

  // 6. Comparar dígito real con el esperado
  //    Caso especial: si el cálculo da 0, se permite '0' o 'X'
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
 * Formato: 4 dígitos + 3 letras + 6 dígitos + 1 letra + 2 dígitos (16 caracteres)
 * Ejemplo: 1234ABC123456A12
 * ============================================================
 */
function validateINE(numero) {
  // 1. Validaciones básicas
  if (!numero || typeof numero !== 'string') {
    console.log('❌ INE vacío o no es string');
    return false;
  }

  // 2. Limpiar: eliminar espacios, guiones, convertir a mayúsculas
  const clean = numero.trim().toUpperCase().replace(/[-\s]/g, '');
  console.log('🧹 INE limpia:', clean);

  // 3. Validar longitud (debe ser 16 caracteres)
  if (clean.length !== 16) {
    console.log(`❌ Longitud INE incorrecta: ${clean.length} (debe ser 16)`);
    return false;
  }

  // 4. Validar formato
  const regex = /^[0-9]{4}[A-Z]{3}[0-9]{6}[A-Z][0-9]{2}$/;
  if (!regex.test(clean)) {
    console.log('❌ Formato INE inválido');
    return false;
  }

  // 5. Validar dígito verificador (algoritmo oficial)
  //    Los primeros 15 caracteres se usan para calcular el dígito 16
  const digitos = clean.substring(0, 15).split('');
  let suma = 0;
  let multiplicador = 2; // Empieza en 2, alterna entre 2 y 1

  // Recorrer de derecha a izquierda (como el algoritmo oficial)
  for (let i = digitos.length - 1; i >= 0; i--) {
    // Convertir carácter a número base 36 (A=10, B=11, ..., Z=35)
    const val = parseInt(digitos[i], 36);
    if (isNaN(val)) {
      console.log('❌ Carácter inválido en INE:', digitos[i]);
      return false;
    }
    suma += val * multiplicador;
    // Alternar multiplicador: 2 → 1 → 2 → 1 ...
    multiplicador = multiplicador === 2 ? 1 : 2;
  }

  // Calcular dígito esperado
  const digitoCalculado = (10 - (suma % 10)) % 10;
  const digitoEsperado = digitoCalculado === 10 ? '0' : digitoCalculado.toString();
  const digitoReal = clean[15]; // Último dígito

  console.log(`🔢 INE Suma: ${suma} → Dígito esperado: ${digitoEsperado}, Dígito real: ${digitoReal}`);

  // 6. Comparar dígito real con el esperado
  const esValido = digitoReal === digitoEsperado;

  if (esValido) {
    console.log('✅ INE válida');
  } else {
    console.log(`❌ INE inválida: dígito verificador incorrecto. Debe ser ${digitoEsperado}`);
  }

  return esValido;
}

module.exports = { validateCURP, validateINE };