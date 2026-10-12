import { Aviso, param } from "@/components/aviso";
import { Campo, classeBotao } from "@/components/campo";
import { contextoPainel } from "@/lib/painel";
import { formatarCentavos } from "@/lib/utils/dinheiro";
import { DIAS, type Horarios } from "@/lib/validacao/loja";
import { criarArea, excluirArea, salvarHorarios, salvarLoja } from "./acoes";

const campo = "rounded-lg border border-current/30 bg-transparent px-3 py-2";
const mini = "rounded border border-current/30 px-2 py-1 text-xs";

function resumoArea(tipo: string, def: Record<string, unknown>) {
  if (tipo === "bairro") return `Bairros: ${(def.bairros as string[]).join(", ")}`;
  if (tipo === "raio") return `Raio de ${String(def.raio_km)} km`;
  return `Polígono (${(def.pontos as unknown[]).length} pontos)`;
}

export default async function ConfiguracoesPage({
  searchParams,
}: PageProps<"/painel/configuracoes">) {
  const sp = await searchParams;
  const { supabase, loja, podeEditar } = await contextoPainel();
  const [{ data: dados }, { data: areas }] = await Promise.all([
    supabase
      .from("lojas")
      .select("nome, telefone_whatsapp, aberta, horarios")
      .eq("id", loja.id)
      .single(),
    supabase.from("areas_entrega").select("*").eq("loja_id", loja.id).order("nome"),
  ]);
  const horarios: Horarios = Array.isArray(dados?.horarios)
    ? (dados.horarios as Horarios)
    : DIAS.map(() => ({ aberto: false, abre: "18:00", fecha: "23:00" }));
  const ro = !podeEditar;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <Aviso erro={param(sp.erro)} ok={param(sp.ok)} />
      {ro && <Aviso erro="Seu papel permite apenas visualizar as configurações." />}

      <form action={salvarLoja} className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold">Loja</h2>
        <Campo
          rotulo="Nome"
          id="nome"
          defaultValue={dados?.nome}
          required
          maxLength={80}
          disabled={ro}
        />
        <Campo
          rotulo="WhatsApp (DDD + número)"
          id="telefone"
          defaultValue={dados?.telefone_whatsapp ?? ""}
          inputMode="tel"
          disabled={ro}
        />
        <label className="flex items-center gap-2">
          <input type="checkbox" name="aberta" defaultChecked={dados?.aberta} disabled={ro} /> Loja
          aberta para pedidos agora
        </label>
        {!ro && <button className={classeBotao}>Salvar</button>}
      </form>

      <form action={salvarHorarios} className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Horários de funcionamento</h2>
        {DIAS.map((dia, i) => (
          <div key={dia} className="flex flex-wrap items-center gap-2">
            <label className="flex w-28 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`aberto_${i}`}
                defaultChecked={horarios[i]?.aberto}
                disabled={ro}
              />{" "}
              {dia}
            </label>
            <input
              type="time"
              name={`abre_${i}`}
              defaultValue={horarios[i]?.abre}
              aria-label={`${dia}: abre`}
              disabled={ro}
              className={campo}
            />
            <span aria-hidden>às</span>
            <input
              type="time"
              name={`fecha_${i}`}
              defaultValue={horarios[i]?.fecha}
              aria-label={`${dia}: fecha`}
              disabled={ro}
              className={campo}
            />
          </div>
        ))}
        {!ro && <button className={`${classeBotao} self-start`}>Salvar horários</button>}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Áreas e taxas de entrega</h2>
        {(areas ?? []).length === 0 && (
          <p className="text-sm opacity-70">
            Nenhuma área cadastrada: a loja só aceitará retirada.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {(areas ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-current/15 p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <strong>{a.nome || "Área"}</strong> · taxa {formatarCentavos(a.taxa_centavos)}
                {a.pedido_minimo_centavos > 0 &&
                  ` · mínimo ${formatarCentavos(a.pedido_minimo_centavos)}`}
                {a.prazo_minutos && ` · ${a.prazo_minutos} min`}
                <div className="opacity-70">{resumoArea(a.tipo, a.definicao)}</div>
              </div>
              {!ro && (
                <form action={excluirArea}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className={mini}>Excluir</button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {!ro && (
          <form
            action={criarArea}
            className="flex flex-col gap-3 rounded-lg border border-dashed border-current/30 p-3"
          >
            <div className="flex flex-wrap gap-2">
              <input
                name="nome"
                placeholder="Nome (opcional)"
                maxLength={60}
                aria-label="Nome da área"
                className={`${campo} min-w-0 flex-1`}
              />
              <select name="tipo" aria-label="Tipo de área" className={campo} defaultValue="bairro">
                <option value="bairro" className="text-black">
                  Por bairro
                </option>
                <option value="raio" className="text-black">
                  Por raio (km)
                </option>
                <option value="poligono" className="text-black">
                  Por polígono
                </option>
              </select>
            </div>
            <p className="text-xs opacity-70">Preencha só o campo do tipo escolhido.</p>
            <textarea
              name="bairros"
              rows={2}
              placeholder="Bairros, separados por vírgula"
              aria-label="Bairros"
              className={campo}
            />
            <input
              name="raio_km"
              placeholder="Raio em km (ex.: 4)"
              inputMode="decimal"
              aria-label="Raio em km"
              className={campo}
            />
            <textarea
              name="pontos"
              rows={3}
              placeholder={"Polígono: um ponto por linha\n-3.7319,-38.5267"}
              aria-label="Pontos do polígono"
              className={campo}
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                name="taxa"
                placeholder="Taxa (R$)"
                required
                inputMode="decimal"
                aria-label="Taxa de entrega"
                className={campo}
              />
              <input
                name="minimo"
                placeholder="Mínimo (R$)"
                inputMode="decimal"
                aria-label="Pedido mínimo"
                className={campo}
              />
              <input
                name="prazo"
                placeholder="Prazo (min)"
                inputMode="numeric"
                aria-label="Prazo em minutos"
                className={campo}
              />
            </div>
            <button className={`${classeBotao} self-start`}>Adicionar área</button>
          </form>
        )}
      </section>
    </div>
  );
}
