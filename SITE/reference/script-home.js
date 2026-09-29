/* ============================================================
   HUE ANIMATION – anima o feColorMatrix (#feHue)
============================================================ */
const feHue = document.getElementById("feHue");

(function animateHue() {
  if (!feHue) return;

  const duration = 4000;
  let start = null;

  function frame(ts) {
    if (!start) start = ts;
    const t = ((ts - start) % duration) / duration;
    feHue.setAttribute("values", t * 360);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

/* ============================================================
   BOTÕES DO MENU
============================================================ */
const btnHome = document.querySelector("[data-action='go-home']");
const btnServices = document.querySelector("[data-action='go-services']");
const btnAgendarHome = document.querySelector(".shimmer-btn");

/* ============================================================
   VIBRAÇÃO SUAVE (HAPTIC FEEDBACK)
   - chamada apenas em interações de botão
============================================================ */
function softVibrate() {
  // só vibra se o navegador suportar
  if (navigator.vibrate) {
    navigator.vibrate(10); // 10ms: bem discreto
  }
}

/* ============================================================
   VIEWS
============================================================ */
const homeView = document.getElementById("home-view");
let servicesView = document.getElementById("services-view");

if (!servicesView) {
  servicesView = document.createElement("section");
  servicesView.id = "services-view";
  servicesView.style.display = "none";
  document.querySelector(".content-wrapper").appendChild(servicesView);
}

/* ============================================================
   MENU ACTIVE STATE
============================================================ */
function clearActive() {
  btnHome.classList.remove("active");
  btnServices.classList.remove("active");
}

/* ============================================================
   FUNÇÃO: ANIMAÇÃO EM CASCATA DOS CARDS DE SERVIÇO
   - Usa a classe .fade-cascade do CSS
   - Só mexe em opacity/translateY (posição base continua a mesma)
============================================================ */
function runServicesCascade() {
  const items = servicesView.querySelectorAll(".service-item");

  items.forEach((item, index) => {
    // só anima itens que estão visíveis (não filtrados)
    const computed = window.getComputedStyle(item);
    if (computed.display === "none") return;

    // define o delay progressivo (0.65s + 0.1s por card)
    const delay = 0.65 + index * 0.1;
    item.style.setProperty("--service-delay", `${delay}s`);

    // reinicia animação com hack de reflow
    item.classList.remove("fade-cascade");
    void item.offsetWidth;
    item.classList.add("fade-cascade");
  });
}

/* ============================================================
   LÊ A DURAÇÃO DO FADE DO CSS (#home-view)
   (pega transition-duration e converte para ms)
============================================================ */
function getHomeFadeDurationMs() {
  const style = window.getComputedStyle(homeView);
  const raw = (style.transitionDuration || "").split(",")[0].trim();

  let ms = 700; // fallback padrão

  if (raw.endsWith("ms")) {
    ms = parseFloat(raw);
  } else if (raw.endsWith("s")) {
    ms = parseFloat(raw) * 1000;
  }

  if (Number.isNaN(ms) || ms <= 0) {
    ms = 700;
  }

  return ms;
}

/* ============================================================
   MOSTRAR HOME
============================================================ */
function showHome() {
  clearActive();
  btnHome.classList.add("active");

  homeView.classList.remove("home-fade-out");

  servicesView.style.display = "none";
  homeView.style.display = "block";
}

/* ============================================================
   MOSTRAR SERVIÇOS (com fade simples da HOME + cascata 1ª vez)
============================================================ */
function showServices() {
  clearActive();
  btnServices.classList.add("active");

  const homeDisplay = window.getComputedStyle(homeView).display;

  // se já estou em Serviços, só mostra, sem cascata nova
  if (homeDisplay === "none") {
    homeView.classList.remove("home-fade-out");
    homeView.style.display = "none";
    servicesView.style.display = "block";
    return;
  }

  homeView.classList.add("home-fade-out");

  const delay = getHomeFadeDurationMs();

  setTimeout(() => {
    homeView.classList.remove("home-fade-out");
    homeView.style.display = "none";
    servicesView.style.display = "block";

    // 👉 aqui entra o efeito em cascata, só nessa transição
    runServicesCascade();
  }, delay);
}

/* ============================================================
   EVENTOS DO MENU (com vibração)
============================================================ */
btnHome.addEventListener("click", (e) => {
  e.preventDefault();
  softVibrate();
  showHome();
});

btnServices.addEventListener("click", (e) => {
  e.preventDefault();
  softVibrate();
  showServices();
});

/* ============================================================
   BOTÃO “AGENDAR” (HOME) → mesmo comportamento que clicar em Serviços
   + vibração
============================================================ */
if (btnAgendarHome) {
  btnAgendarHome.addEventListener("click", (e) => {
    e.preventDefault();
    softVibrate();
    showServices();
  });
}

/* ============================================================
   FILTRO DE SERVIÇOS
   (sem cascata — troca instantânea, como combinado)
============================================================ */
const filterBtns = document.querySelectorAll(".cat-btn");
const serviceItems = document.querySelectorAll(".service-item");

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    // estado visual dos filtros
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const filter = btn.dataset.filter;

    serviceItems.forEach((item) => {
      const category = item.dataset.category;

      // 🚫 garante que NENHUM card tenha mais cascata ao navegar
      item.classList.remove("fade-cascade");
      item.style.removeProperty("--service-delay");

      item.style.display =
        filter === "all" || category === filter ? "flex" : "none";
    });
  });
});

/* ============================================================
   BOTÕES “AGENDAR” DOS CARDS DE SERVIÇO
   - apenas vibração suave na interação
============================================================ */
const serviceCtaButtons = document.querySelectorAll(".service-btn");

serviceCtaButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const servico = btn.getAttribute("data-service");
    window.location.href = `./agendar.html?servico=${encodeURIComponent(
      servico
    )}`;
  });
});
