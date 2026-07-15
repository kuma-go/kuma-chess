const STATE_KEY = "kumaChessPlayerState";
const supported = ["ko", "en", "ja"];

function readLanguage() {
  try {
    const state = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    return supported.includes(state.language) ? state.language : "ko";
  } catch (error) {
    return "ko";
  }
}

function writeLanguage(language) {
  try {
    const state = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    state.language = language;
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (error) {
    // The document remains usable when browser storage is disabled.
  }
}

function showLanguage(language) {
  const next = supported.includes(language) ? language : "ko";
  document.documentElement.lang = next === "ja" ? "ja" : next === "en" ? "en" : "ko";
  document.querySelectorAll("article[data-language]").forEach((article) => {
    article.hidden = article.dataset.language !== next;
  });
  document.querySelectorAll("[data-language-button]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.languageButton === next));
  });
}

document.querySelectorAll("[data-language-button]").forEach((button) => {
  button.addEventListener("click", () => {
    const language = button.dataset.languageButton;
    writeLanguage(language);
    showLanguage(language);
  });
});

showLanguage(readLanguage());
