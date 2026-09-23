const groups = ["job", "camera", "thermals", "fans", "speed", "ams", "link", "hms", "energy", "prints"];

function read() {
  const params = new URLSearchParams(location.search);
  const stored = JSON.parse(localStorage.getItem("printcast-widgets") || "{}");
  const picks = {};
  for (const group of groups) {
    picks[group] = params.get(group) || stored[group] || "";
  }
  return picks;
}

function write(picks) {
  localStorage.setItem("printcast-widgets", JSON.stringify(picks));
  const params = new URLSearchParams();
  for (const group of groups) {
    if (picks[group]) params.set(group, picks[group]);
  }
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

function paint(picks) {
  document.querySelectorAll(".variant").forEach((node) => {
    node.setAttribute("aria-pressed", String(picks[node.dataset.group] === node.dataset.id));
  });
  const bar = document.querySelector("#picked");
  const bits = groups.map((group) => {
    const node = document.querySelector(`.variant[data-group="${group}"][aria-pressed="true"]`);
    const name = node ? node.dataset.name : "—";
    return `<span>${group} <b>${name}</b></span>`;
  });
  bar.innerHTML = `<span>Picked</span>${bits.join("")}`;
}

let picks = read();
paint(picks);

document.body.addEventListener("click", (event) => {
  const variant = event.target.closest(".variant");
  if (!variant) return;
  picks = { ...picks, [variant.dataset.group]: variant.dataset.id };
  write(picks);
  paint(picks);
});
