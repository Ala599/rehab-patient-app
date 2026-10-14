// Données de l'application : compte, séances, messages, réglages.
// Équivalent de l'AppState de l'application Flutter de l'équipe.
//
// IMPORTANT : tout est LOCAL à ce téléphone (localStorage) et sert à la démonstration.
// - Le compte n'est pas une vraie authentification : n'importe qui ayant accès au téléphone
//   peut modifier ces données. Le mot de passe est au moins stocké sous forme de hachage salé
//   (jamais en clair), mais la vraie connexion devra être faite par le backend.
// - Pour brancher le backend, il suffira de remplacer les méthodes de cette classe
//   (signUp, logIn, addSession, sendMessage...) par des appels à l'API : l'interface n'en dépend pas.

import { dayKey } from "./format.js";

const KEY = "rehome:v1";
const PBKDF2_ITERATIONS = 100000;

const defaultData = () => ({
  account: null, // { name, email, salt, hash }
  loggedIn: false,
  affectedSide: "right",
  sessions: [],
  messages: [],
  reminder: { on: false, time: "09:00" },
});

const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password, saltHex) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SECURE_CONTEXT_REQUIRED");
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export class Store {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.data = defaultData();
    this.listeners = new Set();
  }

  // ---------- Persistance ----------
  load() {
    try {
      const raw = this.storage.getItem(KEY);
      if (raw) this.data = { ...defaultData(), ...JSON.parse(raw) };
    } catch (err) {
      console.warn("Données locales illisibles, on repart de zéro.", err);
    }
  }

  save() {
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn("Impossible d'enregistrer les données locales.", err);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  commit() {
    this.save();
    this.listeners.forEach((listener) => listener());
  }

  // ---------- Compte ----------
  get isLoggedIn() {
    return Boolean(this.data.loggedIn && this.data.account);
  }

  get firstName() {
    const name = (this.data.account?.name ?? "").trim();
    return name ? name.split(" ")[0] : "";
  }

  // Retourne un message d'erreur, ou null si tout va bien.
  async signUp(name, email, password) {
    if (!name.trim()) return "Entrez votre prénom.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Entrez une adresse e-mail valide.";
    if (password.length < 6) return "Le mot de passe doit avoir au moins 6 caractères.";
    try {
      const salt = randomSalt();
      const hash = await hashPassword(password, salt);
      this.data.account = { name: name.trim(), email: email.trim().toLowerCase(), salt, hash };
    } catch (err) {
      return err.message === "SECURE_CONTEXT_REQUIRED"
        ? "Une connexion sécurisée (HTTPS) est nécessaire pour créer un compte."
        : "Impossible de créer le compte sur cet appareil.";
    }
    this.data.loggedIn = true;
    this.commit();
    return null;
  }

  async logIn(email, password) {
    const account = this.data.account;
    if (!account) return "Aucun compte trouvé. Créez un compte d'abord.";
    let hash;
    try {
      hash = await hashPassword(password, account.salt);
    } catch {
      return "Une connexion sécurisée (HTTPS) est nécessaire.";
    }
    if (email.trim().toLowerCase() !== account.email || hash !== account.hash) {
      return "E-mail ou mot de passe incorrect.";
    }
    this.data.loggedIn = true;
    this.commit();
    return null;
  }

  logOut() {
    this.data.loggedIn = false;
    this.commit();
  }

  // ---------- Réglages ----------
  setAffectedSide(side) {
    this.data.affectedSide = side === "left" ? "left" : "right";
    this.commit();
  }

  setReminder(on, time) {
    this.data.reminder = { on: Boolean(on), time: time || "09:00" };
    this.commit();
  }

  // ---------- Séances ----------
  // summary : objet produit par SessionRecorder.build()
  addSession(summary, targetReps) {
    const session = {
      id: `${Date.now()}-${this.data.sessions.length}`,
      date: summary.startedAt,
      exerciseId: summary.exerciseId,
      side: summary.side,
      reps: summary.repsCompleted,
      partialReps: summary.partialReps,
      targetReps,
      avgRom: summary.avgRom,
      avgMinAngle: summary.avgMinAngle,
      durationSec: summary.durationSec,
      calibrationAsymmetryPercent: summary.calibration?.asymmetry?.percent ?? null,
      seriesAsymmetryPercent: summary.seriesAsymmetryPercent,
    };
    this.data.sessions.push(session);
    this.commit();
    return session;
  }

  get sessions() {
    return this.data.sessions;
  }

  get todaySession() {
    const today = dayKey(new Date());
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      if (dayKey(new Date(this.sessions[i].date)) === today) return this.sessions[i];
    }
    return null;
  }

  // Nombre de jours d'affilée avec au moins une séance. Si aujourd'hui n'est pas encore fait,
  // la série n'est pas rompue : on compte à partir d'hier.
  streak(now = new Date()) {
    const days = new Set(this.sessions.map((s) => dayKey(new Date(s.date))));
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!days.has(dayKey(day))) day.setDate(day.getDate() - 1);
    let count = 0;
    while (days.has(dayKey(day))) {
      count += 1;
      day.setDate(day.getDate() - 1);
    }
    return count;
  }

  get bestRom() {
    const values = this.sessions.map((s) => s.avgRom).filter((v) => v != null);
    return values.length ? Math.max(...values) : null;
  }

  // Médailles fondées sur des critères réels (pas sur un score arbitraire).
  badges(now = new Date()) {
    const streak = this.streak(now);
    return [
      { id: "first", title: "Première séance", description: "Terminer une séance", unlocked: this.sessions.length > 0 },
      { id: "streak3", title: "3 jours d'affilée", description: "Faire l'exercice 3 jours de suite", unlocked: streak >= 3 },
      { id: "streak7", title: "7 jours d'affilée", description: "Faire l'exercice 7 jours de suite", unlocked: streak >= 7 },
      {
        id: "goal",
        title: "Objectif atteint",
        description: "Atteindre le nombre de répétitions visé en une séance",
        unlocked: this.sessions.some((s) => s.targetReps && s.reps >= s.targetReps),
      },
    ];
  }

  // ---------- Messagerie (réponses simulées) ----------
  async sendMessage(text, { delayMs = 1000 } = {}) {
    const clean = text.trim();
    if (!clean) return;
    this.data.messages.push({ text: clean, fromMe: true, date: new Date().toISOString() });
    this.commit();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    this.data.messages.push({
      text: "Message reçu. Votre médecin vous répondra dès que possible. (Réponse automatique de démonstration.)",
      fromMe: false,
      date: new Date().toISOString(),
    });
    this.commit();
  }

  // Export des données de l'utilisateur (sans le hachage du mot de passe).
  exportData() {
    const { account, affectedSide, sessions, messages, reminder } = this.data;
    return JSON.stringify(
      { account: account ? { name: account.name, email: account.email } : null, affectedSide, reminder, sessions, messages },
      null,
      2
    );
  }
}
