import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync("app/index.html", "utf8");
const dom = new JSDOM(html, { url: "https://rehome.test/", pretendToBeVisual: true });
const { window } = dom;

const noopCtx = new Proxy({}, { get: () => () => {}, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => noopCtx;
window.confirm = () => true;

Object.assign(globalThis, {
  window, document: window.document, localStorage: window.localStorage,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  HTMLElement: window.HTMLElement,
});
globalThis.fetch = async (url) => {
  const body = readFileSync("app/" + String(url).replace("./", ""), "utf8");
  return { ok: true, json: async () => JSON.parse(body) };
};
globalThis.__sim = { mode: "static", t: 0 };
const setMode = (mode) => { globalThis.__sim = { mode, t: 0 }; };

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, label, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (fn()) return; } catch {}
    await wait(25);
  }
  throw new Error(`Délai dépassé : ${label}`);
}
const ok = (label) => console.log("  ✓", label);
const stepClass = (name) => document.querySelector(`#steps li[data-step=${name}]`).className;
const type = (id, value) => { $(id).value = value; };
const submit = () => $("auth-form").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));

try {
  await import("./app/src/main.js");

  console.log("1. Premier lancement");
  assert.equal($("auth").hidden, false); assert.equal($("app").hidden, true);
  assert.equal($("auth-title").textContent, "Créer un compte");
  ok("l'écran de connexion s'affiche, en mode inscription");

  submit(); await wait(50);
  assert.equal($("auth-error").hidden, false);
  assert.equal($("auth-error").textContent, "Entrez votre prénom.");
  ok("un formulaire vide affiche une erreur");

  type("auth-name", "Amel"); type("auth-email", "amel@mail.fr"); type("auth-pass", "secret123");
  submit();
  await waitFor(() => $("app").hidden === false, "application affichée");
  assert.equal($("auth").hidden, true);
  assert.ok($("today-summary").textContent.includes("Bonjour Amel"));
  ok("l'inscription ouvre l'application : « Bonjour Amel »");

  console.log("2. Onglets");
  document.querySelector('.tab[data-page=history]').click();
  assert.equal($("page-history").hidden, false); assert.equal($("page-title").textContent, "Historique");
  assert.ok($("page-history").textContent.includes("Aucune séance pour le moment"));
  ok("Historique vide");
  document.querySelector('.tab[data-page=chat]').click();
  assert.equal($("page-title").textContent, "Mon médecin");
  type("chat-input", "Bonjour, j'ai un peu mal au coude");
  $("page-chat").querySelector("form").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await waitFor(() => $("page-chat").querySelectorAll(".bubble").length === 2, "réponse automatique", 3000);
  assert.ok($("page-chat").querySelector(".bubble.me").textContent.includes("mal au coude"));
  ok("la messagerie envoie le message et reçoit la réponse automatique");
  document.querySelector('.tab[data-page=today]').click();

  console.log("3. Séance : calibration côté sain");
  $("today-summary").querySelector("button.primary").click();
  assert.equal($("exercise").hidden, false); assert.equal($("today-summary").hidden, true);
  $("start").click();
  await waitFor(() => stepClass("healthy").includes("current"), "calibration côté sain");
  assert.ok($("status").textContent.includes("côté atteint : droit"));
  ok("la caméra (simulée) démarre, étape 1 active, côté atteint = droit");
  await wait(300);
  setMode("healthy");
  await waitFor(() => stepClass("affected").includes("current"), "passage à l'étape 2", 10000);
  assert.ok(stepClass("healthy").includes("done"));
  ok("3 mouvements du côté sain détectés → étape 2");

  console.log("4. Calibration côté atteint");
  setMode("static"); await wait(300);
  setMode("affected");
  await waitFor(() => $("review").hidden === false, "écran de résultat", 10000);
  const rows = Object.fromEntries([...document.querySelectorAll("#review-list div")].map((d) => [d.children[0].textContent, d.children[1].textContent]));
  const romHealthy = parseInt(rows["Amplitude côté sain"]);
  const romAffected = parseInt(rows["Amplitude côté atteint"]);
  const gap = parseInt(rows["Écart entre les deux côtés"]);
  console.log("     résultat affiché :", JSON.stringify(rows));
  assert.ok(romHealthy >= 97 && romHealthy <= 106, `amplitude saine ${romHealthy}`);
  assert.ok(romAffected >= 49 && romAffected <= 56, `amplitude atteinte ${romAffected}`);
  assert.ok(gap >= 43 && gap <= 53, `écart ${gap}`);
  ok(`amplitude saine ≈ ${romHealthy}°, atteinte ≈ ${romAffected}°, écart ≈ ${gap} % (attendu ≈ 105° / 55° / 48 %)`);

  console.log("5. Série adaptée au patient");
  setMode("static"); await wait(200);
  $("begin-series").click();
  assert.equal($("series-actions").hidden, false);
  assert.ok(stepClass("series").includes("current"));
  setMode("series");
  await waitFor(() => parseInt($("reps").textContent) >= 3, "3 répétitions comptées", 10000);
  ok(`le bras limité (140° max) est compté grâce à la cible adaptée : ${$("reps").textContent}`);
  setMode("static"); await wait(200);

  console.log("6. Enregistrement");
  $("finish-session").click();
  assert.equal($("exercise").hidden, true); assert.equal($("today-summary").hidden, false);
  assert.ok($("today-summary").textContent.includes("Séance enregistrée. Bravo !"));
  assert.ok($("today-summary").textContent.includes("Séance du jour terminée"));
  assert.ok($("today-summary").textContent.includes("1 jour d'affilée"));
  ok("retour au résumé : séance enregistrée, série de 1 jour");
  const saved = JSON.parse(localStorage.getItem("rehome:v1")).sessions;
  assert.equal(saved.length, 1);
  assert.ok(saved[0].reps >= 3 && saved[0].avgRom > 30 && saved[0].calibrationAsymmetryPercent != null);
  console.log("     séance stockée :", JSON.stringify(saved[0]));
  ok("la séance contient les vraies mesures (répétitions, amplitude, écart)");

  console.log("7. Historique avec une séance");
  document.querySelector('.tab[data-page=history]').click();
  assert.ok($("page-history").querySelector(".stat-grid").textContent.includes("1"));
  assert.equal($("page-history").querySelectorAll(".sessions li").length, 1);
  const unlocked = [...$("page-history").querySelectorAll(".medals li.unlocked")].map((li) => li.textContent);
  assert.ok(unlocked.some((t) => t.includes("Première séance")));
  ok("la séance apparaît dans la liste, médaille « Première séance » obtenue");

  console.log("8. Quitter sans enregistrer");
  document.querySelector('.tab[data-page=today]').click();
  $("today-summary").querySelector("button.primary").click();
  assert.equal($("exercise").hidden, false);
  $("stop").click();
  assert.equal($("exercise").hidden, true);
  assert.equal(JSON.parse(localStorage.getItem("rehome:v1")).sessions.length, 1);
  ok("« Quitter la séance » ferme sans rien enregistrer");

  console.log("9. Réglages et déconnexion");
  $("open-settings").click();
  assert.equal($("settings-name").textContent, "Amel");
  $("settings-side").value = "left";
  $("settings-side").dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(JSON.parse(localStorage.getItem("rehome:v1")).affectedSide, "left");
  ok("le côté atteint se règle et se mémorise");
  $("logout").click();
  assert.equal($("auth").hidden, false); assert.equal($("app").hidden, true);
  assert.equal($("auth-title").textContent, "Se connecter");
  ok("déconnexion : retour à la connexion (mode « Se connecter »)");
  type("auth-email", "amel@mail.fr"); type("auth-pass", "faux");
  submit(); await waitFor(() => $("auth-error").hidden === false, "erreur de connexion");
  assert.equal($("auth-error").textContent, "E-mail ou mot de passe incorrect.");
  ok("un mauvais mot de passe est refusé");
  type("auth-pass", "secret123");
  submit(); await waitFor(() => $("app").hidden === false, "reconnexion");
  assert.ok($("today-summary").textContent.includes("Séance du jour terminée"));
  ok("la reconnexion retrouve les données");

  console.log("\nTOUT EST OK");
  process.exit(0);
} catch (err) {
  console.error("\nÉCHEC :", err.message);
  console.error(err.stack?.split("\n").slice(1, 4).join("\n"));
  process.exit(1);
}
