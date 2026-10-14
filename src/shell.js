// Navigation par onglets et fenêtre des réglages.
import { $ } from "./dom.js";

export function createShell({ store, canLeaveToday }) {
  const tabs = [...document.querySelectorAll(".tab")];
  const pages = {
    today: $("page-today"),
    history: $("page-history"),
    chat: $("page-chat"),
  };
  const title = $("page-title");
  const dialog = $("settings");
  let current = "today";

  function showPage(name) {
    if (name !== "today" && current === "today" && !canLeaveToday()) return;
    current = name;
    for (const [key, page] of Object.entries(pages)) page.hidden = key !== name;
    tabs.forEach((tab) => {
      if (tab.dataset.page === name) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    title.textContent = pages[name].dataset.title;
    $("pages").scrollTop = 0;
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => showPage(tab.dataset.page)));

  // ----- Réglages -----
  const ui = {
    name: $("settings-name"),
    email: $("settings-email"),
    side: $("settings-side"),
    reminderOn: $("reminder-on"),
    reminderTime: $("reminder-time"),
  };

  function openSettings() {
    const { account, affectedSide, reminder } = store.data;
    ui.name.textContent = account?.name ?? "";
    ui.email.textContent = account?.email ?? "";
    ui.side.value = affectedSide;
    ui.reminderOn.checked = reminder.on;
    ui.reminderTime.value = reminder.time;
    ui.reminderTime.disabled = !reminder.on;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeSettings() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  $("open-settings").addEventListener("click", openSettings);
  $("close-settings").addEventListener("click", closeSettings);
  ui.side.addEventListener("change", () => store.setAffectedSide(ui.side.value));
  ui.reminderOn.addEventListener("change", () => {
    ui.reminderTime.disabled = !ui.reminderOn.checked;
    store.setReminder(ui.reminderOn.checked, ui.reminderTime.value);
  });
  ui.reminderTime.addEventListener("change", () => store.setReminder(ui.reminderOn.checked, ui.reminderTime.value));

  $("export-data").addEventListener("click", () => {
    const blob = new Blob([store.exportData()], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rehome-donnees-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  $("logout").addEventListener("click", () => {
    closeSettings();
    store.logOut();
  });

  return { showPage, closeSettings };
}
