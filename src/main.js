// Point d'entrée : charge les données, assemble les écrans et choisit celui à afficher.

import { Store } from "./store.js";
import { $ } from "./dom.js";
import { createAuth } from "./auth.js";
import { createShell } from "./shell.js";
import { createToday } from "./today.js";
import { createHistory } from "./history.js";
import { createChat } from "./chat.js";
import { createExerciseFlow } from "./exerciseFlow.js";

const store = new Store();
store.load();

let flow;
let today;

function showSummary() {
  $("today-summary").hidden = false;
}

flow = createExerciseFlow({
  store,
  onClosed: showSummary,
  onSaved: () => today.notify("Séance enregistrée. Bravo !"),
});

today = createToday({
  store,
  container: $("today-summary"),
  onStart: () => {
    $("today-summary").hidden = true;
    flow.open();
  },
});

createHistory({ store, container: $("page-history") });
createChat({ store, container: $("page-chat") });
const auth = createAuth({ store });
const shell = createShell({ store, canLeaveToday: () => flow.requestClose() });

// Affiche la connexion ou l'application selon l'état du compte.
let lastLoggedIn = null;
function route() {
  const loggedIn = store.isLoggedIn;
  if (loggedIn === lastLoggedIn) return;
  lastLoggedIn = loggedIn;
  $("auth").hidden = loggedIn;
  $("app").hidden = !loggedIn;
  if (loggedIn) {
    shell.showPage("today");
  } else {
    flow.close();
    auth.reset();
  }
}
store.subscribe(route);
route();

// PWA : enregistre le service worker (fonctionne seulement en HTTPS ou sur localhost).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("Service worker non enregistré", err));
  });
}
