/* ------------------------------------------------------------------
   Moteur de calcul + rendu
   Tout est ramené à un coût mensuel sur une base de 30 jours.
   Chaque calcul expose son détail : l'utilisateur doit pouvoir vérifier
   d'où sort le prix, pas seulement le lire.
   ------------------------------------------------------------------ */

const DAYS_PER_MONTH = 30;
const WEEKS_PER_MONTH = DAYS_PER_MONTH / 7;

/* ----------------------------- Formats ---------------------------- */

function euros(n) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function num(n, decimals = 0) {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Accord du pluriel sans dépendance : « 1 pass » / « 3 pass ». */
function plural(n, singular, pluralForm = singular + "s") {
  return `${num(n)} ${n > 1 ? pluralForm : singular}`;
}

/* ---------------------------- Calculs ----------------------------- */

/**
 * Prix d'un trajet et durée couverte, pour un forfait à prix fixe par trajet.
 * Les paliers (LimePrime) sont ordonnés par durée croissante ; au-delà du
 * dernier palier on garde son prix et le dépassement passe à la minute.
 */
function rideTier(plan, duration) {
  if (!plan.tiers) return { price: plan.ridePrice, cap: plan.capMin };
  const tier = plan.tiers.find((t) => duration <= t.maxMin) ?? plan.tiers.at(-1);
  return { price: tier.price, cap: tier.maxMin };
}

/**
 * Coût mensuel d'un forfait pour un profil d'usage donné.
 * Renvoie le coût et les lignes de détail qui le composent.
 */
function computePlan(plan, operator, usage) {
  const { tripsPerWeek, avgDuration } = usage;
  const tripsPerMonth = tripsPerWeek * WEEKS_PER_MONTH;
  const minutesPerMonth = tripsPerMonth * avgDuration;
  const payg = operator.plans.find((p) => p.type === "payg");
  const trips = plural(Math.round(tripsPerMonth), "trajet");

  switch (plan.type) {
    case "payg": {
      const perTrip = plan.unlock + plan.rate * avgDuration;
      const unlockLabel = plan.unlock
        ? `${euros(plan.unlock)} de déblocage + `
        : "déblocage offert, ";
      return {
        cost: tripsPerMonth * perTrip,
        breakdown: [
          `${unlockLabel}${avgDuration} min × ${euros(plan.rate)} = ${euros(perTrip)} le trajet`,
          `${trips} par mois`,
        ],
      };
    }

    case "pass": {
      // On raisonne sur la fenêtre de validité du pass, pas sur le mois : un
      // pass de 400 min valable 90 jours s'amortit sur 3 mois, alors qu'un pass
      // de 30 min valable 24 h se rachète à chaque journée de trajet.
      // On ne compte que les fenêtres où l'on roule réellement : inutile
      // d'acheter un pass 24 h les jours où l'on ne prend pas de vélo.
      const ridingDays = Math.min(DAYS_PER_MONTH, tripsPerMonth);
      const windows = Math.min(DAYS_PER_MONTH / plan.days, ridingDays);
      const minutesPerWindow = minutesPerMonth / windows;
      const passes = Math.max(1, Math.ceil(minutesPerWindow / plan.minutes - 1e-9));
      const breakdown = [`${num(minutesPerMonth)} min consommées par mois`];

      if (plan.days > DAYS_PER_MONTH) {
        breakdown.push(
          `${plural(passes, "pass")} de ${euros(plan.price)} couvrent ${plan.days} jours`,
          `soit ${euros(passes * plan.price * (DAYS_PER_MONTH / plan.days))} par mois une fois lissé`
        );
      } else if (plan.days === 1) {
        breakdown.push(
          `1 pass de ${euros(plan.price)} par journée de trajet`,
          `${plural(Math.round(windows), "journée")} avec vélo par mois`
        );
      } else if (plan.days === DAYS_PER_MONTH) {
        breakdown.push(`${plural(passes, "pass")} de ${euros(plan.price)} par mois`);
      } else {
        const p = num(windows, windows % 1 ? 1 : 0);
        breakdown.push(
          `${plural(passes, "pass")} de ${euros(plan.price)} par période de ${plan.days} jours`,
          `${p} ${windows > 1 ? "périodes" : "période"} par mois`
        );
      }

      return { cost: windows * passes * plan.price, breakdown };
    }

    case "per_ride": {
      const periods = DAYS_PER_MONTH / plan.days;
      const tripsPerPeriod = tripsPerMonth / periods;
      const covered = plan.maxRides ? Math.min(tripsPerPeriod, plan.maxRides) : tripsPerPeriod;
      const extra = tripsPerPeriod - covered;
      const { price: ridePrice, cap } = rideTier(plan, avgDuration);
      const overMin = Math.max(0, avgDuration - cap);

      const perPeriod =
        plan.price +
        covered * (ridePrice + overMin * payg.rate) +
        extra * (payg.unlock + payg.rate * avgDuration);

      const breakdown = [
        `${euros(plan.price)} d'abonnement${plan.days === DAYS_PER_MONTH ? " par mois" : ` par ${plan.days} jours`}`,
        `${trips} × ${euros(ridePrice)} (jusqu'à ${cap} min)`,
      ];
      if (overMin > 0) {
        breakdown.push(
          `dépassement de ${num(overMin)} min × ${euros(payg.rate)} sur chaque trajet`
        );
      }
      if (extra > 0) {
        breakdown.push(`${plural(Math.round(extra * periods), "trajet")} hors quota, au tarif à la minute`);
      }

      return { cost: perPeriod * periods, breakdown };
    }

    default:
      return { cost: Infinity, breakdown: [] };
  }
}

/* ------------------------------ État ------------------------------ */

const PRESETS = [
  { id: "occasionnel", label: "Occasionnel", tripsPerWeek: 2, avgDuration: 10 },
  { id: "regulier", label: "Régulier", tripsPerWeek: 6, avgDuration: 12 },
  { id: "velotaf", label: "Vélotaf", tripsPerWeek: 10, avgDuration: 15 },
  { id: "intensif", label: "Intensif", tripsPerWeek: 16, avgDuration: 20 },
];

const usage = { tripsPerWeek: 6, avgDuration: 12 };
const activeOperators = new Set(OPERATORS.map((o) => o.id));

const els = {};

/* ---------------------------- Sélection --------------------------- */

function computeRows() {
  const rows = [];
  for (const op of OPERATORS) {
    if (!activeOperators.has(op.id)) continue;
    for (const plan of op.plans) {
      // Un forfait dont le prix n'a pas pu être relevé ne peut pas être classé.
      if (plan.type !== "payg" && plan.price == null) continue;
      rows.push({ op, plan, ...computePlan(plan, op, usage) });
    }
  }
  return rows.sort((a, b) => a.cost - b.cost);
}

/** Référence d'économie : le tarif à la minute le moins cher du panel. */
function baselineCost(rows) {
  const paygs = rows.filter((r) => r.plan.type === "payg");
  return paygs.length ? Math.min(...paygs.map((r) => r.cost)) : null;
}

/* ------------------------------ Rendu ----------------------------- */

function logo(op) {
  return `<img class="logo" src="logos/Logo-${op.file}.png" alt="" width="28" height="28">`;
}

function renderVerdict(rows) {
  if (!rows.length) {
    els.verdict.innerHTML = `
      <div class="empty">
        <p class="empty__title">Aucun opérateur sélectionné</p>
        <p class="empty__hint">Cochez au moins un opérateur ci-dessus pour lancer la comparaison.</p>
      </div>`;
    return;
  }

  const best = rows[0];
  const tripsPerMonth = usage.tripsPerWeek * WEEKS_PER_MONTH;
  const baseline = baselineCost(rows);
  const saved = baseline != null ? baseline - best.cost : 0;

  // Le meilleur forfait de chaque opérateur : répond à « quelle appli installer ».
  const perOperator = OPERATORS.filter((op) => activeOperators.has(op.id))
    .map((op) => ({ op, row: rows.find((r) => r.op.id === op.id) }))
    .sort((a, b) => a.row.cost - b.row.cost);
  const cheapest = Math.min(...perOperator.map((p) => p.row.cost));

  els.verdict.innerHTML = `
    <div class="verdict__main" style="--brand:${best.op.color}">
      <p class="eyebrow">Le meilleur choix pour cet usage</p>
      <div class="verdict__head">
        ${logo(best.op)}
        <h2>${best.op.name} <span>${best.plan.name}</span></h2>
      </div>
      <p class="verdict__price"><span class="amount">${euros(best.cost)}</span><span class="unit">par mois</span></p>
      <dl class="stats">
        <div><dt>Par trajet</dt><dd>${euros(best.cost / tripsPerMonth)}</dd></div>
        <div><dt>Trajets par mois</dt><dd>${num(Math.round(tripsPerMonth))}</dd></div>
        ${
          saved > 0.01
            ? `<div><dt>Économie vs. la minute</dt><dd class="pos">${euros(saved)}</dd></div>`
            : ""
        }
      </dl>
      ${
        best.plan.days > DAYS_PER_MONTH
          ? `<p class="callout">À sortir d'un coup : ${euros(best.plan.price)} pour ${best.plan.days} jours. Le montant mensuel est lissé.</p>`
          : ""
      }
    </div>

    <div class="verdict__side">
      <p class="eyebrow">Meilleure offre par opérateur</p>
      <ul class="best-list">
        ${perOperator
          .map(
            ({ op, row }) => `
          <li class="best-item ${row.cost === cheapest ? "is-top" : ""}" style="--brand:${op.color}">
            ${logo(op)}
            <div class="best-item__id">
              <span class="best-item__op">${op.name}</span>
              <span class="best-item__plan">${row.plan.name}</span>
            </div>
            <span class="best-item__cost">${euros(row.cost)}</span>
          </li>`
          )
          .join("")}
      </ul>
      <p class="verdict__hint">Écart entre le meilleur et le pire forfait du panel :
        <strong>${euros(rows.at(-1).cost - best.cost)}</strong> par mois.</p>
    </div>`;
}

function renderRanking(rows) {
  if (!rows.length) {
    els.ranking.innerHTML = "";
    return;
  }
  const max = rows.at(-1).cost || 1;

  els.ranking.innerHTML = rows
    .map(
      (r, i) => `
    <li class="rank ${i === 0 ? "is-best" : ""}" style="--brand:${r.op.color}; --i:${i}">
      <details>
        <summary>
          <span class="rank__pos">${i + 1}</span>
          ${logo(r.op)}
          <span class="rank__id">
            <span class="rank__op">${r.op.name}</span>
            <span class="rank__plan">${r.plan.name}</span>
          </span>
          <span class="rank__bar"><span class="rank__fill" style="--s:${Math.max(0.02, r.cost / max).toFixed(4)}"></span></span>
          <span class="rank__cost">${euros(r.cost)}</span>
          <span class="rank__chevron" aria-hidden="true"></span>
        </summary>
        <div class="rank__detail">
          <ul class="calc">
            ${r.breakdown.map((line) => `<li>${line}</li>`).join("")}
          </ul>
          ${r.plan.note ? `<p class="rank__note">${r.plan.note}</p>` : ""}
        </div>
      </details>
    </li>`
    )
    .join("");
}

function renderGrid() {
  els.grid.innerHTML = OPERATORS.map(
    (op) => `
    <article class="op" style="--brand:${op.color}">
      <header class="op__head">
        ${logo(op)}
        <h3>${op.name}</h3>
        <span class="badge">Relevé le ${op.updated}</span>
      </header>
      <ul class="op__plans">
        ${op.plans
          .map((p) => {
            const detail =
              p.type === "payg"
                ? `${p.unlock ? euros(p.unlock) + " de déblocage" : "déblocage offert"} + ${euros(p.rate)} / min`
                : p.type === "pass"
                ? `${p.minutes} min · valable ${p.days} ${p.days > 1 ? "jours" : "jour"}`
                : p.note;
            const price = p.type === "payg" ? "à l'usage" : p.price == null ? "—" : euros(p.price);
            return `<li>
              <span class="op__plan">
                <span class="op__name">${p.name}</span>
                <span class="op__detail">${detail}</span>
              </span>
              <span class="op__price">${price}</span>
            </li>`;
          })
          .join("")}
      </ul>
    </article>`
  ).join("");
}

function render() {
  const rows = computeRows();
  renderVerdict(rows);
  renderRanking(rows);
}

/* --------------------------- Interactions -------------------------- */

function syncPresetState() {
  const match = PRESETS.find(
    (p) => p.tripsPerWeek === usage.tripsPerWeek && p.avgDuration === usage.avgDuration
  );
  for (const btn of els.presets.querySelectorAll("button")) {
    const on = match?.id === btn.dataset.id;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", String(on));
  }
}

function readControls() {
  usage.tripsPerWeek = Number(els.trips.value);
  usage.avgDuration = Number(els.duration.value);
  els.tripsOut.textContent = `${usage.tripsPerWeek} ${usage.tripsPerWeek > 1 ? "trajets" : "trajet"} / semaine`;
  els.durationOut.textContent = `${usage.avgDuration} min / trajet`;
  syncPresetState();
  render();
}

function bind() {
  els.presets.innerHTML = PRESETS.map(
    (p) => `
    <button type="button" class="preset" data-id="${p.id}" data-trips="${p.tripsPerWeek}"
            data-duration="${p.avgDuration}" aria-pressed="false">
      <span class="preset__label">${p.label}</span>
      <span class="preset__meta">${p.tripsPerWeek} × ${p.avgDuration} min</span>
    </button>`
  ).join("");

  els.presets.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    els.trips.value = btn.dataset.trips;
    els.duration.value = btn.dataset.duration;
    readControls();
  });

  els.filters.innerHTML = OPERATORS.map(
    (op) => `
    <label class="chip" style="--brand:${op.color}">
      <input type="checkbox" value="${op.id}" checked>
      <img class="logo" src="logos/Logo-${op.file}.png" alt="" width="20" height="20">
      <span>${op.name}</span>
    </label>`
  ).join("");

  els.filters.addEventListener("change", (e) => {
    e.target.checked ? activeOperators.add(e.target.value) : activeOperators.delete(e.target.value);
    render();
  });

  els.trips.addEventListener("input", readControls);
  els.duration.addEventListener("input", readControls);
}

/**
 * Easter egg : au survol OU au clic sur le cluster de logos du hero, les trois
 * se réordonnent aléatoirement avec la même micro-animation — ils partent de
 * leur ancienne place, s'écartent et grossissent, puis se recomposent dans le
 * nouvel ordre. Chaque emplacement garde sa rotation (éventail) ; ce sont les
 * logos qui changent de slot.
 */
function initLogoPlay() {
  const cluster = document.querySelector(".hero__logos");
  if (!cluster) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const SPREAD = [-0.6, 0, 0.6]; // écartement par slot : gauche, centre, droite
  const DURATION = 950; // ms — l'animation, et la durée du verrou
  let busy = false; // ignore survol/clic tant que l'animation tourne

  const play = () => {
    if (busy) return;
    const imgs = [...cluster.children];
    if (imgs.length < 2) return;

    busy = true;
    setTimeout(() => (busy = false), DURATION);

    // Positions de départ (FLIP).
    const firstLeft = new Map(imgs.map((el) => [el, el.getBoundingClientRect().left]));

    // Nouvel ordre aléatoire, toujours différent de l'actuel.
    let order = imgs;
    do {
      order = [...imgs].sort(() => Math.random() - 0.5);
    } while (order.every((el, i) => el === imgs[i]));
    order.forEach((el) => cluster.appendChild(el));

    if (reduce.matches) return; // réordonne sans animer si mouvement réduit

    const em = parseFloat(getComputedStyle(cluster).fontSize);
    order.forEach((el, i) => {
      el.getAnimations().forEach((a) => a.cancel());
      const dx = firstLeft.get(el) - el.getBoundingClientRect().left;
      const rest = getComputedStyle(el).transform; // rotation du nouveau slot
      const base = rest === "none" ? "" : rest;
      el.animate(
        [
          { transform: `translateX(${dx}px) scale(1) ${base}` },
          { transform: `translateX(${SPREAD[i] * em}px) scale(1.2) ${base}`, offset: 0.5 },
          { transform: `translateX(0px) scale(1) ${base}` },
        ],
        { duration: DURATION, easing: "cubic-bezier(0.34, 1.3, 0.5, 1)" }
      );
    });
  };

  cluster.addEventListener("click", play);
  cluster.addEventListener("mouseenter", play);
}

for (const id of ["presets", "filters", "trips", "duration", "verdict", "ranking", "grid"]) {
  els[id] = document.getElementById(id);
}
els.tripsOut = document.getElementById("trips-out");
els.durationOut = document.getElementById("duration-out");

bind();
initLogoPlay();
renderGrid();
readControls();
