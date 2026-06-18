// Garante que um valor de coluna JSONB seja tratado como array, independente de o
// driver retornar string JSON ou objeto já parseado (varia conforme o tipo declarado
// na query, presença de cast, etc.) — evita bugs sutis de spread em string.
function comoArray(valor) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

module.exports = { comoArray };
