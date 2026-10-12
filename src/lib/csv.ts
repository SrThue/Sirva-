/** Parser de CSV mínimo (RFC 4180): aspas, vírgula/ponto e vírgula, quebras de linha. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const sep =
    (t.split("\n", 1)[0].match(/;/g)?.length ?? 0) > (t.split("\n", 1)[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
  return linhas;
}
