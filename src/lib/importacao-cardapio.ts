import { lerCsv } from "@/lib/csv";
import { reaisParaCentavos } from "@/lib/utils/dinheiro";

export const MODELO_CSV =
  "categoria,nome,descricao,preco,selos\n" +
  'Pizzas,Calabresa,"Molho, mussarela e calabresa",45.90,\n' +
  "Pizzas,Marguerita,Molho tomate e manjericão,42.00,vegetariano\n" +
  "Bebidas,Refrigerante 2L,,12.00,\n";

export type LinhaImportada = {
  categoria: string;
  nome: string;
  descricao: string | null;
  preco_centavos: number;
  selos: string[];
};
export type ResultadoImportacao = { linhas: LinhaImportada[]; erros: string[] };

const SELOS_VALIDOS = new Set([
  "vegano",
  "vegetariano",
  "sem_gluten",
  "sem_lactose",
  "picante",
  "fit",
]);
export const MAX_LINHAS_IMPORTACAO = 500;

export function interpretarCsvCardapio(texto: string): ResultadoImportacao {
  const tabela = lerCsv(texto);
  const erros: string[] = [];
  if (tabela.length === 0) return { linhas: [], erros: ["O arquivo está vazio."] };

  const cab = tabela[0].map((c) => c.trim().toLowerCase());
  const idx = (n: string) => cab.indexOf(n);
  for (const obrigatoria of ["categoria", "nome", "preco"]) {
    if (idx(obrigatoria) < 0) erros.push(`Coluna obrigatória ausente: ${obrigatoria}.`);
  }
  if (erros.length) return { linhas: [], erros };
  if (tabela.length - 1 > MAX_LINHAS_IMPORTACAO) {
    return { linhas: [], erros: [`Máximo de ${MAX_LINHAS_IMPORTACAO} produtos por arquivo.`] };
  }

  const linhas: LinhaImportada[] = [];
  tabela.slice(1).forEach((l, i) => {
    const n = i + 2;
    const get = (nome: string) => (idx(nome) >= 0 ? (l[idx(nome)] ?? "").trim() : "");
    const nome = get("nome");
    const categoria = get("categoria");
    const preco = reaisParaCentavos(get("preco"));
    if (!nome || nome.length > 80)
      return void erros.push(`Linha ${n}: nome vazio ou longo demais.`);
    if (!categoria || categoria.length > 60)
      return void erros.push(`Linha ${n}: categoria inválida.`);
    if (preco === null) return void erros.push(`Linha ${n}: preço inválido.`);
    const selos = get("selos")
      .split(/[|;/]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const ruim = selos.find((s) => !SELOS_VALIDOS.has(s));
    if (ruim) return void erros.push(`Linha ${n}: selo desconhecido "${ruim}".`);
    linhas.push({
      categoria,
      nome,
      descricao: get("descricao").slice(0, 500) || null,
      preco_centavos: preco,
      selos,
    });
  });
  return { linhas, erros };
}
