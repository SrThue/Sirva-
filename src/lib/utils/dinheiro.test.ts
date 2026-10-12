import { describe, expect, it } from "vitest";
import { formatarCentavos } from "./dinheiro";

describe("formatarCentavos", () => {
  it("formata centavos em reais", () => {
    expect(formatarCentavos(1990).replace(/\s/g, " ")).toBe("R$ 19,90");
  });
  it("rejeita valores não inteiros", () => {
    expect(() => formatarCentavos(10.5)).toThrow();
  });
});
