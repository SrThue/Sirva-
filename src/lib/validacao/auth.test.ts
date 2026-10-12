import { describe, expect, it } from "vitest";
import { cadastroSchema, loginSchema, slugDoNome } from "./auth";

describe("validação de autenticação", () => {
  it("normaliza e-mail no login", () => {
    expect(loginSchema.parse({ email: " A@B.com ", senha: "x" }).email).toBe("a@b.com");
  });
  it("rejeita campos desconhecidos", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "x", admin: true }).success).toBe(
      false,
    );
  });
  it("exige senha forte no cadastro", () => {
    const base = { nomeLoja: "Loja", slug: "loja", email: "a@b.com" };
    expect(cadastroSchema.safeParse({ ...base, senha: "curta" }).success).toBe(false);
    expect(cadastroSchema.safeParse({ ...base, senha: "umasenhalonga1" }).success).toBe(true);
  });
  it("rejeita slug inválido", () => {
    const dados = { nomeLoja: "Loja", email: "a@b.com", senha: "umasenhalonga1" };
    expect(cadastroSchema.safeParse({ ...dados, slug: "Ab c" }).success).toBe(false);
    expect(cadastroSchema.safeParse({ ...dados, slug: "-ab" }).success).toBe(false);
  });
  it("gera slug sem acentos", () => {
    expect(slugDoNome("Açaí do Zé & Cia!")).toBe("acai-do-ze-cia");
  });
});
