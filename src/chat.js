// Onglet "Médecin" : messagerie. Les réponses sont simulées en attendant le backend.
import { el } from "./dom.js";
import { hhmm } from "./format.js";

export function createChat({ store, container }) {
  const list = el("ul", { class: "bubbles", "aria-label": "Messages", "aria-live": "polite" });
  const input = el("input", { id: "chat-input", type: "text", enterkeyhint: "send", autocomplete: "off", placeholder: "Écrire à mon médecin" });
  const form = el("form", { class: "chat-form" },
    el("label", { class: "sr-only", for: "chat-input", text: "Votre message" }),
    input,
    el("button", { class: "primary", type: "submit", text: "Envoyer" })
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value;
    input.value = "";
    store.sendMessage(text);
  });

  container.replaceChildren(
    el("p", { class: "notice", role: "note", text: "Cette messagerie n'est pas faite pour les urgences. En cas de douleur vive, de chute ou de malaise, appelez les secours ou contactez votre médecin directement." }),
    list,
    form,
    el("p", { class: "caption", text: "Version de démonstration : les réponses sont automatiques." })
  );

  function render() {
    const messages = store.data.messages;
    list.replaceChildren(
      ...(messages.length
        ? messages.map((m) =>
            el("li", { class: `bubble ${m.fromMe ? "me" : "doc"}` },
              el("span", { text: m.text }),
              el("time", { datetime: m.date, text: hhmm(new Date(m.date)) })
            )
          )
        : [el("li", { class: "muted", text: "Aucun message pour le moment." })])
    );
    list.scrollTop = list.scrollHeight;
  }

  store.subscribe(render);
  render();
  return { render };
}
