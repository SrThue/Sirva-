/** Valores monetários são sempre centavos inteiros; nunca float. */
export function formatarCentavos(centavos: number): string {
  if (!Number.isInteger(centavos)) {
    throw new Error("Valor deve ser um inteiro em centavos");
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );
}
