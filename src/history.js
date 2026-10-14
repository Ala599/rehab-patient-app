// Onglet "Historique" : chiffres clés, médailles, courbe d'amplitude et liste des séances.
import { el, svg } from "./dom.js";
import { frShortDate, hhmm } from "./format.js";

const deg = (v) => (v == null ? "–" : `${Math.round(v)}°`);

function amplitudeChart(sessions) {
  const points = sessions.filter((s) => s.avgRom != null).slice(-12);
  if (points.length < 2) return null;

  const W = 320;
  const H = 150;
  const pad = { left: 38, right: 12, top: 14, bottom: 26 };
  const values = points.map((s) => s.avgRom);
  const lo = Math.floor(Math.min(...values) / 5) * 5 - 5;
  const hi = Math.ceil(Math.max(...values) / 5) * 5 + 5;
  const x = (i) => pad.left + (i * (W - pad.left - pad.right)) / (points.length - 1);
  const y = (v) => pad.top + ((hi - v) * (H - pad.top - pad.bottom)) / (hi - lo);

  const chart = svg("svg", {
    viewBox: `0 0 ${W} ${H}`,
    class: "chart",
    role: "img",
    "aria-label": `Amplitude moyenne du coude sur les ${points.length} dernières séances, de ${Math.round(values[0])}° à ${Math.round(values[values.length - 1])}°`,
  });
  chart.append(
    svg("line", { x1: pad.left, y1: y(hi), x2: W - pad.right, y2: y(hi), stroke: "#e3eef3", "stroke-width": 1 }),
    svg("line", { x1: pad.left, y1: y(lo), x2: W - pad.right, y2: y(lo), stroke: "#e3eef3", "stroke-width": 1 }),
    svg("text", { x: 4, y: y(hi) + 4, text: `${hi}°` }),
    svg("text", { x: 4, y: y(lo) + 4, text: `${lo}°` }),
    svg("polyline", {
      points: points.map((s, i) => `${x(i)},${y(s.avgRom)}`).join(" "),
      fill: "none",
      stroke: "#2f6e9e",
      "stroke-width": 3,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }),
    ...points.map((s, i) => svg("circle", { cx: x(i), cy: y(s.avgRom), r: 4, fill: "#2f6e9e" })),
    svg("text", { x: pad.left, y: H - 6, text: frShortDate(new Date(points[0].date)) }),
    svg("text", { x: W - pad.right - 44, y: H - 6, text: frShortDate(new Date(points[points.length - 1].date)) })
  );
  return chart;
}

export function createHistory({ store, container }) {
  function render() {
    const sessions = store.sessions;
    const streak = store.streak();

    const stats = el("div", { class: "stat-grid" },
      el("div", { class: "card" }, el("span", { class: "label", text: "Séances" }), el("span", { class: "value", text: String(sessions.length) })),
      el("div", { class: "card" }, el("span", { class: "label", text: "Série" }), el("span", { class: "value", text: `${streak} j` })),
      el("div", { class: "card" }, el("span", { class: "label", text: "Meilleure amplitude" }), el("span", { class: "value", text: deg(store.bestRom) }))
    );

    const medals = el("section", { class: "card" },
      el("h3", { text: "Médailles" }),
      el("ul", { class: "medals" },
        store.badges().map((b) =>
          el("li", { class: b.unlocked ? "unlocked" : "" },
            el("div", {}, el("div", { text: b.title }), el("div", { class: "desc", text: b.description })),
            el("span", { class: "state", text: b.unlocked ? "Obtenue" : "À débloquer" })
          )
        )
      )
    );

    const chart = amplitudeChart(sessions);
    const chartCard = chart
      ? el("section", { class: "card" }, el("h3", { text: "Amplitude du coude" }), chart, el("p", { class: "caption", text: "Amplitude moyenne des répétitions de chaque séance." }))
      : null;

    const list = sessions.length
      ? el("section", { class: "card" },
          el("h3", { text: "Mes séances" }),
          el("ul", { class: "sessions" },
            [...sessions].reverse().map((s) => {
              const d = new Date(s.date);
              const goal = s.targetReps ? ` / ${s.targetReps}` : "";
              const asym = s.seriesAsymmetryPercent != null ? ` · écart ${s.seriesAsymmetryPercent} %` : "";
              return el("li", {},
                el("div", {},
                  el("div", { class: "date", text: `${frShortDate(d)} à ${hhmm(d)}` }),
                  el("div", { class: "detail", text: `Amplitude moyenne ${deg(s.avgRom)}${asym}` })
                ),
                el("span", { class: "reps", text: `${s.reps}${goal} rép.` })
              );
            })
          )
        )
      : el("section", { class: "card" },
          el("h3", { text: "Mes séances" }),
          el("p", { class: "muted", text: "Aucune séance pour le moment. Votre première séance apparaîtra ici." })
        );

    container.replaceChildren(stats, medals, chartCard, list);
  }

  store.subscribe(render);
  render();
  return { render };
}
