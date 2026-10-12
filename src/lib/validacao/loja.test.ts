import { describe, expect, it } from "vitest";
import { areaSchema, definicaoDaArea, lojaSchema } from "./loja";

describe("lojaSchema", () => {
  it("normaliza telefone e aceita vazio", () => {
    expect(lojaSchema.parse({ nome: "Loja", telefone: "(85) 99999-8888" }).telefone).toBe(
      "85999998888",
    );
    expect(lojaSchema.parse({ nome: "Loja", telefone: "" }).telefone).toBeNull();
    expect(lojaSchema.safeParse({ nome: "Loja", telefone: "123" }).success).toBe(false);
  });
});

describe("areaSchema", () => {
  it("área por bairro", () => {
    const a = areaSchema.parse({
      tipo: "bairro",
      taxa: "5,00",
      minimo: "",
      prazo: "40",
      bairros: "Centro, Aldeota\nMeireles",
    });
    expect(a.taxa).toBe(500);
    expect(definicaoDaArea(a)).toEqual({ bairros: ["Centro", "Aldeota", "Meireles"] });
  });
  it("área por raio exige valor positivo", () => {
    expect(
      areaSchema.safeParse({ tipo: "raio", taxa: "3", minimo: "", prazo: "", raio_km: "0" })
        .success,
    ).toBe(false);
    expect(
      areaSchema.safeParse({ tipo: "raio", taxa: "3", minimo: "", prazo: "", raio_km: "4.5" })
        .success,
    ).toBe(true);
  });
  it("polígono exige 3 pontos válidos", () => {
    const b = { tipo: "poligono", taxa: "3", minimo: "", prazo: "" };
    expect(areaSchema.safeParse({ ...b, pontos: "1,2\n3,4" }).success).toBe(false);
    expect(areaSchema.safeParse({ ...b, pontos: "1,2\n3,4\n95,4" }).success).toBe(false);
    expect(
      areaSchema.safeParse({ ...b, pontos: "-3.7,-38.5\n-3.8,-38.5\n-3.8,-38.6" }).success,
    ).toBe(true);
  });
  it("rejeita taxa inválida e tipo desconhecido", () => {
    expect(
      areaSchema.safeParse({ tipo: "bairro", taxa: "x", minimo: "", prazo: "", bairros: "A" })
        .success,
    ).toBe(false);
    expect(areaSchema.safeParse({ tipo: "mágica", taxa: "1" }).success).toBe(false);
  });
});
