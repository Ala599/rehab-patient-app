import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.js";
import { frLongDate, frShortDate, dayKey } from "../src/format.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    dump: () => [...map.values()].join("\n"),
  };
}

const makeSummary = (date, over = {}) => ({
  exerciseId: "elbow_flexion",
  side: "right",
  startedAt: date.toISOString(),
  repsCompleted: 8,
  partialReps: 1,
  avgRom: 60,
  avgMinAngle: 85,
  durationSec: 120,
  seriesAsymmetryPercent: 40,
  calibration: { asymmetry: { percent: 38 }, healthy: { rom: 100 } },
  ...over,
});

test("dates en français", () => {
  assert.equal(frLongDate(new Date(2026, 9, 13)), "mardi 13 octobre");
  assert.equal(frLongDate(new Date(2026, 9, 11)), "dimanche 11 octobre");
  assert.equal(frShortDate(new Date(2026, 0, 5)), "5 janvier");
  assert.equal(dayKey(new Date(2026, 2, 4)), "2026-03-04");
});

test("inscription : messages d'erreur de validation", async () => {
  const store = new Store(memoryStorage());
  assert.equal(await store.signUp("", "a@b.fr", "secret1"), "Entrez votre prénom.");
  assert.equal(await store.signUp("Amel", "pas-un-email", "secret1"), "Entrez une adresse e-mail valide.");
  assert.equal(await store.signUp("Amel", "a@b.fr", "123"), "Le mot de passe doit avoir au moins 6 caractères.");
  assert.equal(store.isLoggedIn, false);
});

test("inscription réussie : connecté, et le mot de passe n'est jamais stocké en clair", async () => {
  const storage = memoryStorage();
  const store = new Store(storage);
  assert.equal(await store.signUp("Amel Ben", "Amel@Mail.fr", "motdepasse-secret"), null);
  assert.equal(store.isLoggedIn, true);
  assert.equal(store.firstName, "Amel");
  assert.ok(!storage.dump().includes("motdepasse-secret"));
  assert.ok(storage.dump().includes("amel@mail.fr"));
});

test("connexion : mauvais mot de passe refusé, bon mot de passe accepté", async () => {
  const store = new Store(memoryStorage());
  assert.equal(await store.logIn("a@b.fr", "x"), "Aucun compte trouvé. Créez un compte d'abord.");
  await store.signUp("Amel", "a@b.fr", "secret123");
  store.logOut();
  assert.equal(store.isLoggedIn, false);
  assert.equal(await store.logIn("a@b.fr", "mauvais"), "E-mail ou mot de passe incorrect.");
  assert.equal(await store.logIn("autre@b.fr", "secret123"), "E-mail ou mot de passe incorrect.");
  assert.equal(await store.logIn(" A@B.fr ", "secret123"), null);
  assert.equal(store.isLoggedIn, true);
});

test("les données survivent à un rechargement", async () => {
  const storage = memoryStorage();
  const first = new Store(storage);
  await first.signUp("Amel", "a@b.fr", "secret123");
  first.addSession(makeSummary(new Date()), 10);
  first.setAffectedSide("left");

  const second = new Store(storage);
  second.load();
  assert.equal(second.isLoggedIn, true);
  assert.equal(second.sessions.length, 1);
  assert.equal(second.data.affectedSide, "left");
});

test("des données corrompues ne bloquent pas l'application", () => {
  const storage = memoryStorage();
  storage.setItem("rehome:v1", "{pas du json");
  const store = new Store(storage);
  store.load();
  assert.equal(store.isLoggedIn, false);
  assert.deepEqual(store.sessions, []);
});

test("série de jours : consécutifs, tolérance du jour en cours, rupture", () => {
  const now = new Date(2026, 9, 13, 12);
  const day = (offset, hour = 9) => new Date(2026, 9, 13 + offset, hour);

  const store = new Store(memoryStorage());
  [0, -1, -2].forEach((o) => store.addSession(makeSummary(day(o)), 10));
  assert.equal(store.streak(now), 3);

  const yesterdayOnly = new Store(memoryStorage());
  [-1, -2].forEach((o) => yesterdayOnly.addSession(makeSummary(day(o)), 10));
  assert.equal(yesterdayOnly.streak(now), 2); // aujourd'hui pas encore fait : série conservée

  const broken = new Store(memoryStorage());
  [0, -2, -3].forEach((o) => broken.addSession(makeSummary(day(o)), 10));
  assert.equal(broken.streak(now), 1);

  const twice = new Store(memoryStorage());
  twice.addSession(makeSummary(day(0, 8)), 10);
  twice.addSession(makeSummary(day(0, 20)), 10);
  assert.equal(twice.streak(now), 1); // deux séances le même jour = un jour
});

test("médailles : critères réels", () => {
  const now = new Date(2026, 9, 13, 12);
  const store = new Store(memoryStorage());
  assert.ok(store.badges(now).every((b) => !b.unlocked));

  store.addSession(makeSummary(new Date(2026, 9, 13, 9), { repsCompleted: 6 }), 10);
  let badges = Object.fromEntries(store.badges(now).map((b) => [b.id, b.unlocked]));
  assert.deepEqual(badges, { first: true, streak3: false, streak7: false, goal: false });

  store.addSession(makeSummary(new Date(2026, 9, 12, 9), { repsCompleted: 10 }), 10);
  store.addSession(makeSummary(new Date(2026, 9, 11, 9)), 10);
  badges = Object.fromEntries(store.badges(now).map((b) => [b.id, b.unlocked]));
  assert.deepEqual(badges, { first: true, streak3: true, streak7: false, goal: true });
});

test("une séance enregistrée garde les vraies mesures", () => {
  const store = new Store(memoryStorage());
  const session = store.addSession(makeSummary(new Date(2026, 9, 13, 9), { avgRom: 72 }), 10);
  assert.equal(session.reps, 8);
  assert.equal(session.avgRom, 72);
  assert.equal(session.calibrationAsymmetryPercent, 38);
  assert.equal(session.seriesAsymmetryPercent, 40);
  assert.equal(store.bestRom, 72);
});

test("messagerie : la réponse automatique arrive après le message", async () => {
  const store = new Store(memoryStorage());
  await store.sendMessage("  Bonjour, j'ai mal au coude  ", { delayMs: 0 });
  await store.sendMessage("   ", { delayMs: 0 });
  assert.equal(store.data.messages.length, 2);
  assert.equal(store.data.messages[0].text, "Bonjour, j'ai mal au coude");
  assert.equal(store.data.messages[0].fromMe, true);
  assert.equal(store.data.messages[1].fromMe, false);
});

test("export : sans le hachage du mot de passe", async () => {
  const store = new Store(memoryStorage());
  await store.signUp("Amel", "a@b.fr", "secret123");
  const exported = store.exportData();
  assert.ok(!exported.includes(store.data.account.hash));
  assert.ok(exported.includes("a@b.fr"));
});
