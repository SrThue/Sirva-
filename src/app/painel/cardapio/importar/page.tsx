import Link from "next/link";
import { Aviso, param } from "@/components/aviso";
import { classeBotao } from "@/components/campo";
import { importarCsv } from "../acoes";

export default async function ImportarPage({
  searchParams,
}: PageProps<"/painel/cardapio/importar">) {
  const sp = await searchParams;
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Link href="/painel/cardapio" className="text-primaria text-sm underline">
        ← Cardápio
      </Link>
      <h1 className="text-2xl font-semibold">Importar cardápio</h1>
      <p className="text-sm">
        Baixe o{" "}
        <a href="/painel/cardapio/modelo.csv" className="text-primaria underline" download>
          modelo de planilha
        </a>
        , preencha (colunas: categoria, nome, descricao, preco, selos) e envie. Salve como CSV no
        Excel ou Google Planilhas. Até 500 produtos.
      </p>
      <Aviso erro={param(sp.erro)} />
      <form action={importarCsv} className="flex flex-col gap-3">
        <input
          type="file"
          name="arquivo"
          accept=".csv,text/csv"
          required
          aria-label="Arquivo CSV"
        />
        <button className={classeBotao}>Importar</button>
      </form>
    </div>
  );
}
