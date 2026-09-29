import SemBarbearia from "./SemBarbearia";
import { caminhoDaLoja } from "../lib/barbearia";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { useServices } from "../hooks/useServices";
import type { Service } from "../services";
import "../styles-home.css";

type View = "home" | "services";

export default function HomePage() {
  const navigate = useNavigate();
  const { config, error: configError } = useSiteConfig();
  const { services, loading: servicesLoading, error: servicesError } = useServices();
  const [view, setView] = useState<View>("home");
  const [filter, setFilter] = useState<string>("all");
  const [homeFading, setHomeFading] = useState(false);
  const servicesListRef = useRef<HTMLUListElement>(null);
  const prevViewRef = useRef<View>("home");
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryTabsRef = useRef<HTMLDivElement>(null);
  const categoryLineRef = useRef<HTMLDivElement>(null);
  const categoryBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const filterFadeReadyRef = useRef(false);

  const pillRef = useRef<HTMLDivElement>(null);
  const navListRef = useRef<HTMLUListElement>(null);
  const homeTabRef = useRef<HTMLAnchorElement>(null);
  const servicesTabRef = useRef<HTMLAnchorElement>(null);
  const navMountedRef = useRef(false);

  const displayConfig = config;
  const displayServices = services;
  const effectiveFiltersEnabled = displayConfig.filtersEnabled;
  const activeCategories = displayConfig.categories.filter((c) => c.active);
  const validFilter =
    filter === "all" || activeCategories.some((c) => c.id === filter)
      ? filter
      : "all";

  const softVibrate = () => {
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const goToServices = () => {
    if (view === "services") return;
    softVibrate();
    setHomeFading(true);
    fadeTimerRef.current = setTimeout(() => {
      setView("services");
    }, 100);
  };

  const goToHome = () => {
    softVibrate();
    setHomeFading(false);
    setView("home");
  };

  const handleAgendar = (service: Service) => {
    softVibrate();
    navigate(`${caminhoDaLoja("/agendar")}?servico=${encodeURIComponent(service.slug)}`, {
      state: { servico: service.name, serviceSlug: service.slug, service },
    });
  };

  useLayoutEffect(() => {
    const pill = pillRef.current;
    const el = homeTabRef.current;
    const list = navListRef.current;
    if (!pill || !el || !list) return;
    const lr = list.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    gsap.set(pill, {
      x: er.left - lr.left,
      y: er.top - lr.top,
      width: er.width,
      height: er.height,
    });
  }, []);

  useEffect(() => {
    if (!navMountedRef.current) { navMountedRef.current = true; return; }
    const pill = pillRef.current;
    const el = (view === "home" ? homeTabRef : servicesTabRef).current;
    const list = navListRef.current;
    if (!pill || !el || !list) return;
    const lr = list.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    gsap.to(pill, {
      x: er.left - lr.left,
      y: er.top - lr.top,
      width: er.width,
      height: er.height,
      duration: 0.4,
      ease: "power2.inOut",
      overwrite: true,
    });
  }, [view]);

  useLayoutEffect(() => {
    if (view !== "services") return;
    const line = categoryLineRef.current;
    const activeButton = categoryBtnRefs.current[validFilter];
    const tabs = categoryTabsRef.current;
    if (!line || !activeButton || !tabs) return;

    const tabsRect = tabs.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const targetWidth = Math.min(45, buttonRect.width);

    gsap.to(line, {
      x: buttonRect.left - tabsRect.left + (buttonRect.width - targetWidth) / 2,
      width: targetWidth,
      duration: 0.32,
      ease: "power2.out",
      overwrite: true,
    });
  }, [validFilter, view]);

  useLayoutEffect(() => {
    if (view !== "services") {
      filterFadeReadyRef.current = false;
      return;
    }

    const list = servicesListRef.current;
    if (!list) return;

    if (!filterFadeReadyRef.current) {
      filterFadeReadyRef.current = true;
      return;
    }

    gsap.fromTo(
      list,
      { opacity: 0.55 },
      { opacity: 1, duration: 0.22, ease: "power1.out", overwrite: true }
    );
  }, [validFilter, view]);

  useEffect(() => {
    if (view === "services" && prevViewRef.current === "home") {
      const list = servicesListRef.current;
      if (!list) return;
      const items = list.querySelectorAll<HTMLLIElement>(".service-item");
      if (items.length === 0) return;
      gsap.fromTo(
        Array.from(items),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.65, ease: "power2.out", stagger: 0.1, delay: 0.65 }
      );
    }
    prevViewRef.current = view;
  }, [view]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const filteredServices = !effectiveFiltersEnabled || validFilter === "all"
    ? displayServices
    : displayServices.filter((s) => s.category === validFilter);

  // Endereço sem barbearia válida: nem a página inicial, nem os serviços têm de quem
  // ser. Mostrar a home genérica aqui pareceria site quebrado.
  if (configError === "barbearia-desconhecida" || servicesError === "barbearia-desconhecida") {
    return <SemBarbearia />;
  }

  return (
    <div className="content-wrapper">
      <nav className="nav" aria-label="Principal">
        <ul className="nav-list" ref={navListRef}>
          <div ref={pillRef} className="nav-pill" />
          <li>
            <a
              ref={homeTabRef}
              className={`nav-item${view === "home" ? " active" : ""}`}
              href="#"
              onClick={(e) => { e.preventDefault(); goToHome(); }}
            >
              Início
            </a>
          </li>
          <li>
            <a
              ref={servicesTabRef}
              className={`nav-item${view === "services" ? " active" : ""}`}
              href="#"
              onClick={(e) => { e.preventDefault(); goToServices(); }}
            >
              Serviços
            </a>
          </li>
        </ul>
      </nav>

      {view === "home" && (
        <section
          id="home-view"
          className={homeFading ? "home-fade-out" : undefined}
        >
          <header className="hero">
            <div className="hero-inner">
              <h1 className="hero-title fade-in-title">
                <span className="hero-title-line1">{displayConfig.heroLine1}</span>
                <br />
                <span className="hero-title-line2">{displayConfig.heroName}</span>
              </h1>
              <div className="cta-wrap fade-in-button">
                <a
                  className="shimmer-btn"
                  href="#"
                  onClick={(e) => { e.preventDefault(); goToServices(); }}
                >
                  <span className="shimmer-label">{displayConfig.ctaLabel}</span>
                </a>
              </div>
            </div>
          </header>

          <footer className="site-footer" aria-label="Rodapé">
            <nav className="footer-links">
              <a href="/privacidade" rel="nofollow">Política de privacidade</a>
              <span className="footer-sep">•</span>
              <a href="/termos" rel="nofollow">Termos de uso</a>
            </nav>
          </footer>
        </section>
      )}

      {view === "services" && (
        <section id="services-view">
          <h1 className="services-title">Escolha seu serviço</h1>

          {effectiveFiltersEnabled && (
            <div className="category-tabs" ref={categoryTabsRef}>
              <div className="cat-indicator" ref={categoryLineRef} />
              <button
                ref={(el) => { categoryBtnRefs.current["all"] = el; }}
                type="button"
                className={`cat-btn${validFilter === "all" ? " active" : ""}`}
                aria-pressed={validFilter === "all"}
                onClick={() => setFilter("all")}
              >
                Todos
              </button>
              {activeCategories.map((cat) => (
                <button
                  key={cat.id}
                  ref={(el) => { categoryBtnRefs.current[cat.id] = el; }}
                  type="button"
                  className={`cat-btn${validFilter === cat.id ? " active" : ""}`}
                  aria-pressed={validFilter === cat.id}
                  onClick={() => setFilter(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {servicesLoading ? (
            <div className="services-status">Carregando serviÃ§os...</div>
          ) : servicesError || configError ? (
            <div className="services-status">
              NÃ£o foi possÃ­vel carregar os serviÃ§os agora.
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="services-status">Nenhum serviÃ§o disponÃ­vel.</div>
          ) : (
          <ul className="services-list" ref={servicesListRef}>
            {filteredServices.map((service) => (
              <li
                key={service.id}
                className="service-item"
                data-category={service.category}
              >
                <div>
                  <h2 className="service-name">{service.name}</h2>
                  <p className="service-desc">{service.desc}</p>
                </div>
                <div className="service-right">
                  {service.price && service.price !== 'Consultar' && (
                    <span className="service-price">R$ {service.price}</span>
                  )}
                  <button
                    className="service-btn"
                    onClick={() => handleAgendar(service)}
                  >
                    Agendar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          )}
        </section>
      )}
    </div>
  );
}
