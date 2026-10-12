import { describe, expect, it } from "vitest";
import { centavosParaReais, formatarCentavos, reaisParaCentavos } from "./dinheiro";

describe("formatarCentavos", () => {
  it("formata centavos em reais", () => {
    expect(formatarCentavos(1990).replace(/\s/g, " ")).toBe("R$ 19,90");
  });
  it("rejeita valores não inteiros", () => {
    expect(() => formatarCentavos(10.5)).toThrow();
  });
});

describe("reaisParaCentavos", () => {
  it.each([
    ["45,90", 4590],
    ["45.90", 4590],
    ["45", 4500],
    ["1.234,50", 123450],
    ["R$ 12,5", 1250],
    ["0,99", 99],
  ])("converte %s", (entrada, esperado) => {
    expect(reaisParaCentavos(entrada)).toBe(esperado);
  });
  it.each(["", "abc", "-5", "1,234", "10,999", "99999999"])("rejeita %s", (entrada) => {
    expect(reaisParaCentavos(entrada)).toBeNull();
  });
  it("formata de volta", () => {
    expect(centavosParaReais(4590)).toBe("45,90");
  });
});
