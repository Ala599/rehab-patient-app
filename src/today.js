// Onglet "Aujourd'hui" : résumé du jour et bouton pour commencer la séance.
import { el } from "./dom.js";
import { frLongDate } from "./format.js";

const deg = (v) => (v == null ? "–" : `${Math.round(v)}°`);

export function createToday({ store, container, onStart }) {
  let banner = "";

  function render() {
    const today = store.todaySession;
    const first = store.firstName;
    const streak = store.streak();

    container.replaceChildren(
      el("div", { class: "greeting" },
        el("p", { class: "muted", text: frLongDate(new Date()) }),
        el("h2", { text: first ? `Bonjour ${first}` : "Bonjour" })
      ),
      banner ? el("p", { class: "banner ok", role: "status", text: banner }) : null,
      el("section", { class: "card" },
        el("h3", { text: today ? "Séance du jour terminée" : "Séance du jour" }),
        el("p", {
          text: today
            ? `${today.reps} répétition${today.reps > 1 ? "s" : ""} · amplitude moyenne ${deg(today.avgRom)}`
            : "Vous n'avez pas encore fait votre exercice aujourd'hui.",
        })
      ),
      el("section", { class: "card" },
        el("h3", { text: "Série en cours" }),
        el("p", { class: "big", text: streak === 0 ? "0 jour" : `${streak} jour${streak > 1 ? "s" : ""} d'affilée` })
      ),
      el("button", {
        class: "primary",
        type: "button",
        text: today ? "Refaire une séance" : "Commencer la séance",
        onClick: () => {
          banner = "";
          onStart();
        },
      })
    );
  }

  store.subscribe(render);
  render();

  return {
    render,
    notify(message) {
      banner = message;
      render();
    },
  };
}
