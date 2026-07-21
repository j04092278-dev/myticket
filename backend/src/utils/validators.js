function validateCURP(curp) {
  if (!curp || typeof curp !== 'string') return false;
  const clean = curp.trim().toUpperCase().replace(/[-\s]/g, '');
  if (clean.length !== 18) return false;
  
  const regex = /^[A-ZÑ]{4}[0-9]{6}[A-Z0-9]{6}[0-9X]$/;
  if (!regex.test(clean)) return false;

  const letras = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    const valor = letras.indexOf(clean[i]);
    if (valor === -1) return false;
    suma += valor * (18 - i);
  }
  const digitoCalculado = (10 - (suma % 10)) % 10;
  const digitoEsperado = digitoCalculado === 10 ? '0' : digitoCalculado.toString();
  const digitoReal = clean[17];

  return digitoReal === digitoEsperado || (digitoReal === 'X' && digitoEsperado === '0');
}

function validateINE(numero) {
  if (!numero || typeof numero !== 'string') return false;
  const clean = numero.trim().toUpperCase().replace(/[-\s]/g, '');
  if (clean.length !== 16) return false;

  const regex = /^[0-9]{4}[A-Z]{3}[0-9]{6}[A-Z][0-9]{2}$/;
  if (!regex.test(clean)) return false;

  const digitos = clean.substring(0, 15).split('');
  let suma = 0;
  let multiplicador = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    const val = parseInt(digitos[i], 36);
    if (isNaN(val)) return false;
    suma += val * multiplicador;
    multiplicador = multiplicador === 2 ? 1 : 2;
  }
  const digitoCalculado = (10 - (suma % 10)) % 10;
  const digitoEsperado = digitoCalculado === 10 ? '0' : digitoCalculado.toString();
  return clean[15] === digitoEsperado;
}

module.exports = { validateCURP, validateINE };