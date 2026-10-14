
import { useLocation } from "react-router-dom";

const paginas = {
  "/admin": {
    titulo: "Dashboard",
    descricao: "Visão geral da Another World.",
  },
  "/admin/solicitacoes": {
    titulo: "Solicitações",
    descricao: "Acompanhe e gerencie as solicitações dos clientes.",
  },
  "/admin/orcamentos": {
    titulo: "Orçamentos",
    descricao: "Consulte e gerencie os orçamentos dos serviços.",
  },
  "/admin/usuarios": {
    titulo: "Usuários",
    descricao: "Consulte e gerencie os usuários da plataforma.",
  },
  "/admin/avaliacoes": {
    titulo: "Avaliações",
    descricao: "Acompanhe as avaliações dos clientes.",
  },
};

// Estado exibido enquanto os dados estão sendo carregados.
export function EstadoCarregando() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-[#43265b] bg-[#1d1028] p-8 text-center"
    >
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#43265b] border-t-[#cda5f2]" />

      <p className="text-sm text-[#cda5f2]">
        Carregando informações...
      </p>
    </div>
  );
}

// Estado exibido quando ocorre um erro.
export function EstadoErro({
  mensagem = "Ocorreu um erro ao carregar as informações.",
  tentarNovamente,
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-900/70 bg-[#241323] p-6"
    >
      <div className="mb-3 text-2xl text-red-300">
        !
      </div>

      <h3 className="font-semibold text-red-200">
        Não foi possível carregar os dados
      </h3>

      <p className="mt-2 text-sm leading-relaxed text-[#d8c7df]">
        {mensagem}
      </p>

      {tentarNovamente && (
        <button
          type="button"
          onClick={tentarNovamente}
          className="mt-5 rounded-lg bg-[#7843ab] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#8554b3] focus:outline-none focus:ring-2 focus:ring-[#cda5f2]"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

// Estado exibido quando não existem registros.
export function EstadoVazio({
  titulo = "registros",
  mensagem,
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#624179] bg-[#1d1028] px-5 py-12 text-center">
      <div
        aria-hidden="true"
        className="mb-4 text-4xl text-[#cda5f2]"
      >
        ◇
      </div>

      <h3 className="text-lg font-semibold text-white">
        Nenhum registro encontrado
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#b9a9c7]">
        {mensagem ||
          `Ainda não existem dados para exibir em ${titulo.toLowerCase()}.`}
      </p>
    </div>
  );
}

// Cartão dos indicadores do Dashboard.
function CartaoIndicador({ titulo, valor, descricao }) {
  return (
    <article className="rounded-2xl border border-[#43265b] bg-[#1d1028] p-5 transition duration-200 hover:border-[#8554b3]">
      <p className="text-sm text-[#b9a9c7]">
        {titulo}
      </p>

      <p className="mt-4 text-3xl font-bold text-[#cda5f2]">
        {valor}
      </p>

      <p className="mt-2 text-xs text-[#9e8baa]">
        {descricao}
      </p>
    </article>
  );
}

// Página inicial do painel.
function Dashboard() {
  const indicadores = [
    {
      titulo: "Solicitações",
      valor: "—",
      descricao: "Total de solicitações",
    },
    {
      titulo: "Orçamentos",
      valor: "—",
      descricao: "Total de orçamentos",
    },
    {
      titulo: "Usuários",
      valor: "—",
      descricao: "Usuários cadastrados",
    },
    {
      titulo: "Avaliações",
      valor: "—",
      descricao: "Avaliações recebidas",
    },
  ];

  return (
    <div>
      <section
        aria-label="Indicadores administrativos"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {indicadores.map((item) => (
          <CartaoIndicador
            key={item.titulo}
            titulo={item.titulo}
            valor={item.valor}
            descricao={item.descricao}
          />
        ))}
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">
            Atividade recente
          </h2>

          <p className="mt-1 text-sm text-[#b9a9c7]">
            Acompanhe as movimentações da plataforma.
          </p>
        </div>

        <EstadoVazio
          titulo="atividade recente"
          mensagem="As atividades aparecerão aqui quando forem disponibilizadas pela API."
        />
      </section>
    </div>
  );
}

// Componente principal utilizado pelas cinco rotas administrativas.
export default function AdminPagina() {
  const { pathname } = useLocation();

  const pagina = paginas[pathname];

  // Evita apresentar o conteúdo de outra página caso a rota não exista.
  if (!pagina) {
    return (
      <EstadoErro
        mensagem="A página administrativa solicitada não foi encontrada."
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#cda5f2]">
          Another World / Admin
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {pagina.titulo}
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#b9a9c7] sm:text-base">
          {pagina.descricao}
        </p>
      </header>

      {pathname === "/admin" ? (
        <Dashboard />
      ) : (
        <EstadoVazio titulo={pagina.titulo} />
      )}
    </div>
  );
}