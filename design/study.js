const state = {
  screen: localStorage.getItem("study-screen") || "live",
  frame: localStorage.getItem("study-frame") || "desk",
};

function apply() {
  document.querySelectorAll("[data-set]").forEach((button) => {
    const [key, value] = button.dataset.set.split(":");
    button.setAttribute("aria-pressed", String(state[key] === value));
  });
  document.querySelectorAll("[data-screen]").forEach((node) => {
    node.hidden = node.dataset.screen !== state.screen;
  });
  document.querySelectorAll("[data-nav]").forEach((node) => {
    if (node.dataset.nav === state.screen) node.setAttribute("aria-current", "page");
    else node.removeAttribute("aria-current");
  });
  document.querySelector("#device").className = `device device-${state.frame}`;
  localStorage.setItem("study-screen", state.screen);
  localStorage.setItem("study-frame", state.frame);
}

document.body.addEventListener("click", (event) => {
  const button = event.target.closest("[data-set]");
  if (!button) return;
  const [key, value] = button.dataset.set.split(":");
  state[key] = value;
  apply();
});

apply();
