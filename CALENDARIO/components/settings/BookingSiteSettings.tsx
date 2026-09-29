import { useEffect, useState } from "react";
import { Check, Globe2, LayoutTemplate, Pencil, Plus, Scissors, Tags, Trash2, X } from "lucide-react";
import { CAMPO, FUNDO_CAMPO_MODAL } from "../ui/campo";
import { NeonCheckbox } from "../ui/NeonCheckbox";
import {
  getBookingSiteSettings,
  saveBookingSiteSettings,
  type BookingSiteSettings as Settings,
  type ConfiguredService,
} from "../../services/calendarApi";

type Tab = "pagina" | "categorias" | "servicos";
const TABS = [
  { id: "pagina", label: "Página inicial", Icon: LayoutTemplate },
  { id: "categorias", label: "Categorias", Icon: Tags },
  { id: "servicos", label: "Serviços", Icon: Scissors },
] as const;

const inputClass = `${CAMPO} ${FUNDO_CAMPO_MODAL} min-h-12 min-w-0 px-4 py-3 text-base md:text-[15px]`;
const secondaryClass = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white/[0.06] px-4 text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.11] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";
const labelClass = "grid gap-2 text-[13px] font-medium text-white/75";
const slug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const formatPrice = (value?: string) => {
  const amount = Number(value?.replace(",", "."));
  return value && Number.isFinite(amount)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
    : "—";
};

interface Props {
  onClose: () => void;
}

export default function BookingSiteSettings({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("pagina");
  const [draft, setDraft] = useState<Settings | null>(null);
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void getBookingSiteSettings()
      .then((value) => {
        if (!active) return;
        setDraft(value);
        setInitial(JSON.stringify(value));
      })
      .catch(() => active && setFeedback("Não foi possível carregar as configurações do site."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const changed = draft !== null && JSON.stringify(draft) !== initial;
  const close = () => {
    if (changed && !window.confirm("Descartar alterações não salvas?")) return;
    onClose();
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const patchService = (id: number, patch: Partial<ConfiguredService>) => {
    setDraft((current) => current && ({
      ...current,
      services: current.services.map((service) => service.id === id ? { ...service, ...patch } : service),
    }));
  };
  const addCategory = () => {
    const label = newCategory.trim();
    const id = slug(label);
    if (!id || !draft || draft.categories.items.some((category) => category.id === id)) return;
    setDraft({ ...draft, categories: { ...draft.categories, items: [...draft.categories.items, { id, label, active: true }] } });
    setNewCategory("");
  };
  const addService = () => {
    if (!draft?.categories.items.length) {
      setFeedback("Crie uma categoria antes de adicionar um serviço.");
      setTab("categorias");
      return;
    }
    const id = Math.min(0, ...draft.services.map((service) => service.id ?? 0)) - 1;
    setDraft({ ...draft, services: [...draft.services, { id, slug: "", category: draft.categories.items[0].id, name: "", desc: "", price: "" }] });
    setEditingId(id);
  };
  const save = async () => {
    if (!draft) return;
    const invalid = draft.services.some((service) => !service.name.trim() || !service.desc?.trim() || !draft.categories.items.some((category) => category.id === service.category) || !/^\d+(?:[.,]\d{1,2})?$/.test(service.price?.trim() ?? ""));
    if (invalid) {
      setFeedback("Revise nome, descrição, categoria e preço dos serviços antes de salvar.");
      setTab("servicos");
      return;
    }
    if (!draft.home.heroName.trim() || !draft.home.ctaLabel.trim()) {
      setFeedback("Preencha o nome da barbearia e o botão principal.");
      setTab("pagina");
      return;
    }
    setSaving(true);
    setFeedback("");
    try {
      const normalized: Settings = { ...draft, services: draft.services.map((service) => ({
        ...service,
        name: service.name.trim(),
        desc: service.desc?.trim(),
        price: service.price?.trim().replace(",", "."),
        slug: service.slug || slug(service.name),
      })) };
      // O que volta do servidor, e não o rascunho: é o que carrega os ids reais dos
      // serviços novos (ver `saveBookingSiteSettings`).
      const salvo = await saveBookingSiteSettings(normalized);
      setDraft(salvo);
      setInitial(JSON.stringify(salvo));
      setEditingId(null);
      setFeedback("Configurações salvas.");
    } catch {
      setFeedback("Não foi possível salvar. Confira a conexão com a API e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[3px] md:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="flex max-h-[calc(100dvh-24px)] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl border border-white/[0.10] bg-[#191919] text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] md:max-h-[min(760px,calc(100dvh-48px))]" role="dialog" aria-modal="true" aria-label="Configurações do site de agendamento">
      <header className="flex flex-shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-7 md:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center text-accent-300"><Globe2 size={25} strokeWidth={1.8} /></span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight md:text-lg">Configurações</h1>
            <p className="truncate text-xs text-white/60 md:text-sm">Site público de agendamento</p>
          </div>
        </div>
        <button type="button" onClick={close} aria-label="Fechar configurações" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"><X size={18} /></button>
      </header>

      <div className="flex min-h-0 flex-col md:flex-row">
        <nav aria-label="Áreas de configuração" className="grid flex-shrink-0 grid-cols-3 gap-1 bg-[#1d1d1d] p-2 md:w-60 md:grid-cols-1 md:content-start md:gap-1 md:bg-transparent md:px-4 md:py-8">
          {TABS.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => { setTab(id); setFeedback(""); }} aria-current={tab === id ? "page" : undefined} className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-center text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 md:justify-start md:px-3 md:text-left md:text-sm ${tab === id ? "bg-accent/15 font-semibold text-accent-200" : "text-white/60 hover:bg-white/[0.05] hover:text-white"}`}><Icon size={16} strokeWidth={1.8} className="hidden flex-none sm:block" /><span className="whitespace-nowrap">{label}</span></button>)}
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
          {loading && <p className="text-sm text-white/50">Carregando configurações…</p>}
          {!loading && !draft && <p className="text-sm text-red-300">{feedback}</p>}
          {draft && <div className="mx-auto max-w-3xl space-y-6">
            {tab === "pagina" && <>
              <div><h2 className="text-xl font-semibold tracking-tight">Página de agendamento</h2><p className="mt-1 text-sm leading-relaxed text-white/60">Textos que o cliente vê antes de escolher um horário.</p></div>
              <div className="grid max-w-2xl gap-5 pt-1">
                {([ ["heroLine1", "Texto superior"], ["heroName", "Nome da barbearia"], ["ctaLabel", "Botão principal"] ] as const).map(([key, label]) => <label key={key} className={labelClass}>{label}<input className={inputClass} value={draft.home[key]} onChange={(event) => setDraft({ ...draft, home: { ...draft.home, [key]: event.target.value } })} /></label>)}
              </div>
            </>}
            {tab === "categorias" && <>
              <div><h2 className="text-xl font-semibold tracking-tight">Categorias</h2><p className="mt-1 text-sm leading-relaxed text-white/60">Organizam os serviços no site público.</p></div>
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#222222] px-4 py-3">
                  <NeonCheckbox
                    label="Mostrar filtro de categorias no site"
                    color="var(--color-accent-400)"
                    size={20}
                    className="min-h-11 text-sm text-white/85"
                    checked={draft.categories.filtersEnabled}
                    onChange={(event) => setDraft({ ...draft, categories: { ...draft.categories, filtersEnabled: event.target.checked } })}
                  />
                </div>
                <div className="space-y-2.5">
                  {draft.categories.items.map((category, index) => {
                    const hasServices = draft.services.some((service) => service.category === category.id);
                    return <div key={category.id} className="rounded-2xl bg-[#222222] p-3 sm:flex sm:items-center sm:gap-3">
                      <input aria-label={`Nome da categoria ${index + 1}`} className={inputClass} value={category.label} onChange={(event) => setDraft({ ...draft, categories: { ...draft.categories, items: draft.categories.items.map((item) => item.id === category.id ? { ...item, label: event.target.value } : item) } })} />
                      <div className="mt-2 flex items-center justify-between gap-2 sm:mt-0 sm:flex-none">
                        <NeonCheckbox
                          label="Ativa"
                          color="var(--color-accent-400)"
                          size={18}
                          className="min-h-11 text-sm text-white/70"
                          checked={category.active}
                          onChange={(event) => setDraft({ ...draft, categories: { ...draft.categories, items: draft.categories.items.map((item) => item.id === category.id ? { ...item, active: event.target.checked } : item) } })}
                        />
                        <button type="button" aria-label={`Remover categoria ${category.label}`} title={hasServices ? "Mova os serviços antes de remover" : "Remover categoria"} disabled={hasServices} onClick={() => setDraft({ ...draft, categories: { ...draft.categories, items: draft.categories.items.filter((item) => item.id !== category.id) } })} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white/55 hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={16} /></button>
                      </div>
                    </div>;
                  })}
                </div>
                <div className="flex flex-col gap-2 pt-1 sm:flex-row"><input aria-label="Nova categoria" placeholder="Nova categoria" className={inputClass} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCategory(); }} /><button type="button" className={secondaryClass} onClick={addCategory}><Plus size={16} />Adicionar</button></div>
              </div>
            </>}
            {tab === "servicos" && <>
              <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold tracking-tight">Serviços e preços</h2><p className="mt-1 text-sm leading-relaxed text-white/60">Valores exibidos ao cliente e usados pelo painel.</p></div><button type="button" className={secondaryClass} onClick={addService}><Plus size={16} />Novo serviço</button></div>
              <div className="space-y-2.5">{draft.services.map((service) => <div key={service.id} className="rounded-2xl bg-[#222222] p-4 md:px-5">
                {editingId === service.id ? <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Nome<input className={inputClass} value={service.name} onChange={(event) => patchService(service.id!, { name: event.target.value })} /></label><label className={labelClass}>Preço em R$<input className={inputClass} inputMode="decimal" value={service.price ?? ""} onChange={(event) => patchService(service.id!, { price: event.target.value })} /></label><label className={`${labelClass} sm:col-span-2`}>Descrição<textarea rows={2} className={inputClass} value={service.desc ?? ""} onChange={(event) => patchService(service.id!, { desc: event.target.value })} /></label><label className={labelClass}>Categoria<select className={inputClass} value={service.category ?? ""} onChange={(event) => patchService(service.id!, { category: event.target.value })}>{draft.categories.items.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><div className="flex items-end gap-2"><button type="button" className={secondaryClass} onClick={() => setEditingId(null)}><Check size={16} />Concluir</button><button type="button" className={secondaryClass} aria-label={`Remover ${service.name || "novo serviço"}`} onClick={() => { setDraft({ ...draft, services: draft.services.filter((item) => item.id !== service.id) }); setEditingId(null); }}><Trash2 size={16} /></button></div></div>
                : <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><div className="min-w-0"><h3 className="text-sm font-semibold leading-snug">{service.name || "Novo serviço"}</h3><p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/60">{draft.categories.items.find((category) => category.id === service.category)?.label ?? "Sem categoria"} · {service.desc}</p></div><div className="flex flex-shrink-0 items-center justify-between gap-3 sm:justify-end"><span className="text-sm font-semibold tabular-nums">{formatPrice(service.price)}</span><button type="button" className={secondaryClass} onClick={() => setEditingId(service.id ?? null)}><Pencil size={14} />Editar</button></div></div>}
              </div>)}</div>
            </>}
          </div>}
        </main>
      </div>
      {draft && <footer className="flex flex-shrink-0 items-center justify-end gap-4 border-t border-white/[0.06] bg-[#191919] px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-7 md:pb-3">{(feedback || changed) && <p role="status" className={`mr-auto min-w-0 text-xs leading-snug ${feedback.includes("salvas") ? "text-green-300" : "text-white/65"}`}>{feedback || "Alterações não salvas"}</p>}<button type="button" disabled={!changed || saving} onClick={save} className="min-h-11 flex-shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-white/40 md:px-5">{saving ? "Salvando…" : "Salvar alterações"}</button></footer>}
    </div>
    </div>
  );
}
