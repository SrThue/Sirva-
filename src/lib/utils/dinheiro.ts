/** Valores monetários são sempre centavos inteiros; nunca float. */
export function formatarCentavos(centavos: number): string {
  if (!Number.isInteger(centavos)) {
    throw new Error("Valor deve ser um inteiro em centavos");
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );
}

/** "45,90" | "45.90" | "1.234,50" -> centavos inteiros; null se inválido. */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(limpo)) return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const [inteiro, frac = ""] = normal.split(".");
  const centavos = Number(inteiro) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) && centavos <= 100_000_00 ? centavos : null;
}

export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}
