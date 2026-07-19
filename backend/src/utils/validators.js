function validateCURP(curp) {
  if (!curp) return false;
  const clean = curp.trim().toUpperCase();
  // Formato: 4 letras, 6 dígitos, 6 alfanuméricos, 1 dígito
  const regex = /^[A-Z]{4}[0-9]{6}[A-Z0-9]{6}[0-9]{2}$/;
  if (!regex.test(clean)) return false;

  // Validación del dígito verificador (método oficial)
  const letras = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    const char = clean[i];
    const valor = letras.indexOf(char);
    if (valor === -1) return false;
    suma += valor * (18 - i);
  }
  const digitoVerificador = (10 - (suma % 10)) % 10;
  const dvCalculado = digitoVerificador === 10 ? '0' : digitoVerificador.toString();
  return clean[17] === dvCalculado;
}

function validateINE(numero) {
  if (!numero) return false;
  const clean = numero.trim().toUpperCase();
  // Formato INE: 4 dígitos, 3 letras, 6 dígitos, 1 letra, 2 dígitos
  const regex = /^[0-9]{4}[A-Z]{3}[0-9]{6}[A-Z][0-9]{2}$/;
  if (!regex.test(clean)) return false;

  // Validación sencilla de dígito verificador (método LUHN adaptado)
  const digitos = clean.substring(0, 15).split('');
  let suma = 0;
  let multiplicador = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    const val = parseInt(digitos[i], 36);
    if (isNaN(val)) return false;
    suma += val * multiplicador;
    multiplicador = multiplicador === 2 ? 1 : 2;
  }
  const digitoVerificador = (10 - (suma % 10)) % 10;
  return clean[15] === digitoVerificador.toString();
}

module.exports = { validateCURP, validateINE };