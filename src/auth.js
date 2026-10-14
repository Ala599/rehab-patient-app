// Écran de connexion / inscription.
import { $ } from "./dom.js";

export function createAuth({ store }) {
  const ui = {
    title: $("auth-title"),
    form: $("auth-form"),
    nameField: $("auth-name-field"),
    name: $("auth-name"),
    email: $("auth-email"),
    pass: $("auth-pass"),
    error: $("auth-error"),
    submit: $("auth-submit"),
    toggle: $("auth-toggle"),
  };
  let signup = true;
  let busy = false;

  function showError(message) {
    ui.error.textContent = message ?? "";
    ui.error.hidden = !message;
  }

  function render() {
    ui.title.textContent = signup ? "Créer un compte" : "Se connecter";
    ui.submit.textContent = signup ? "Créer mon compte" : "Me connecter";
    ui.toggle.textContent = signup ? "J'ai déjà un compte" : "Je n'ai pas de compte";
    ui.nameField.hidden = !signup;
    ui.pass.autocomplete = signup ? "new-password" : "current-password";
    showError(null);
  }

  ui.toggle.addEventListener("click", () => {
    signup = !signup;
    render();
  });

  ui.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    ui.submit.disabled = true;
    showError(null);
    const error = signup
      ? await store.signUp(ui.name.value, ui.email.value, ui.pass.value)
      : await store.logIn(ui.email.value, ui.pass.value);
    busy = false;
    ui.submit.disabled = false;
    if (error) showError(error);
    else ui.pass.value = "";
  });

  // S'il existe déjà un compte sur ce téléphone, on propose directement la connexion.
  function reset() {
    signup = !store.data.account;
    render();
  }

  reset();
  return { reset };
}
