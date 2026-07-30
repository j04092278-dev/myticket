function validateCURP(curp) {
  if (!curp || typeof curp !== 'string') return false;
  const clean = curp.trim().toUpperCase().replace(/[^A-ZÑ0-9]/g, '');
  return clean.length === 18 && /^[A-ZÑ0-9]{18}$/.test(clean);
}

function validateINE(numero) {
  if (!numero || typeof numero !== 'string') return false;
  const clean = numero.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length === 18 && /^[A-Z0-9]{18}$/.test(clean);
}

module.exports = { validateCURP, validateINE };