import { describe, expect, it } from "vitest";
import { lerCsv } from "./csv";
import { interpretarCsvCardapio, MODELO_CSV } from "./importacao-cardapio";

describe("lerCsv", () => {
  it("trata aspas, vírgulas e linhas CRLF", () => {
    expect(lerCsv('a,"b, c","d ""e"""\r\nx,y,z\r\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["x", "y", "z"],
    ]);
  });
  it("aceita ponto e vírgula (Excel pt-BR)", () => {
    expect(lerCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("interpretarCsvCardapio", () => {
  it("importa o modelo sem erros", () => {
    const r = interpretarCsvCardapio(MODELO_CSV);
    expect(r.erros).toEqual([]);
    expect(r.linhas).toHaveLength(3);
    expect(r.linhas[0]).toMatchObject({ nome: "Calabresa", preco_centavos: 4590 });
    expect(r.linhas[1].selos).toEqual(["vegetariano"]);
  });
  it("relata erros por linha", () => {
    const r = interpretarCsvCardapio("categoria,nome,preco\nPizzas,,10\nPizzas,Ok,abc\n");
    expect(r.erros).toHaveLength(2);
    expect(r.linhas).toHaveLength(0);
  });
  it("exige colunas obrigatórias", () => {
    expect(interpretarCsvCardapio("nome\nx").erros[0]).toMatch(/categoria/);
  });
});
