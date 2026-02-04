const filtersForm = document.getElementById("explore-filters");
const resultsEl = document.getElementById("explore-results");

function cardHTML(r) {
    const photo =
        r.photo_url || "Assets/Images/rest1.jpg"; // simple fallback
    const price = "$".repeat(r.price_level ?? 0);
    const rating = r.rating != null ? `${r.rating}/5` : "N/A";

    return `
    <article class="result-card">
      <div class="photo" style="background-image:url('${photo}')">
        ${r.photo_url ? "" : "RESTAURANT<br>PHOTO"}
      </div>
      <div class="info">
        <div class="name">${r.name}</div>
        <div>${r.cuisine}</div>
        <div class="muted">${r.area}</div>
        <div class="muted">${price}</div>
        ${r.address ? `<div class="muted">${r.address}</div>` : ""}
      </div>
      <div class="right-col">
        <div class="score-badge">
          <small>Rating</small>
          <div style="font-size:1.4rem">${rating}</div>
        </div>
        <a class="reserve-btn" ${
        r.url
            ? `href="${r.url}" target="_blank" rel="noopener"`
            : `aria-disabled="true"`
    }>
          RESERVE
        </a>
      </div>
    </article>
  `;
}

async function loadRestaurants() {
    const formData = new FormData(filtersForm);
    const params = new URLSearchParams();

    const area = formData.get("area");
    const cuisine = formData.get("cuisine");
    const budget = formData.get("budget");

    if (area) params.set("area", area);
    if (cuisine) params.set("cuisine", cuisine);
    if (budget) params.set("budget", budget);

    const qs = params.toString();
    const url = qs ? `/api/restaurants/explore?${qs}` : "/api/restaurants/explore";

    resultsEl.innerHTML = "<p>Loading…</p>";

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const problem = await res.json().catch(() => ({}));
            throw new Error(problem.error || "Request failed");
        }
        const { results = [] } = await res.json();

        if (!results.length) {
            resultsEl.innerHTML = "<p>No restaurants found. Try different filters.</p>";
            return;
        }

        resultsEl.innerHTML = results.map(cardHTML).join("");
    } catch (err) {
        resultsEl.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    }
}

// load list on page load
loadRestaurants();

// re-load whenever filters change
filtersForm.addEventListener("change", () => {
    loadRestaurants();
});
