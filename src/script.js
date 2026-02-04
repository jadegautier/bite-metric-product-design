
const form = document.querySelector("form");
const resultsEl = document.getElementById("results");
const breakdownEl = document.getElementById("fit-breakdown");
const addFriendBtn = document.querySelector(".btn.ghost");
const friendsPill = document.getElementById("friends-pill");

const friends = [];

//normalize fit score (max 125) to 0..100
const toHundred = (fit) => Math.round((fit / 125) * 100);

// read current form into a friend object
function readCurrentFriend() {
    const data = new FormData(form);
    const friend = {
        name: data.get("name")?.trim(),
        email: data.get("email")?.trim(),
        cuisine: data.get("cuisine") || "",
        area: data.get("area") || "",
        budget: Number(data.get("budget") || "0"),
    };
    return friend;
}

// validation
function validateFriend(friend) {
    return (
        friend.name &&
        friend.email &&
        friend.cuisine &&
        friend.area &&
        friend.budget
    );
}

// mode: keep varaibles but clear name/email for next friend
function clearFormForNextFriend() {
    form.querySelector("#name").value = "";
    form.querySelector("#email").value = "";
}

// update the FRIENDS pill with all names
function updateFriendsPill(group) {
    const names = group.map((f) => f.name).join(" • ");
    if (!names) {
        friendsPill.hidden = true;
        friendsPill.textContent = "";
    } else {
        friendsPill.hidden = false;
        friendsPill.textContent = names;
    }
}

// compute majority cuisine, majority area, and average budget
function aggregatePreferences(group) {
    const pickMajority = (key) => {
        const counts = {};
        group.forEach((f) => {
            const val = f[key];
            if (!val) return;
            counts[val] = (counts[val] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    };

    const cuisine = pickMajority("cuisine");
    const area = pickMajority("area");

    const budgets = group.map((f) => f.budget).filter(Boolean);
    const avgBudget =
        budgets.length === 0
            ? 0
            : Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length);

    return { cuisine, area, budget: avgBudget };
}

// fit breakdown + results cards

// compute component matches for the chosen restaurant
function computeComponents(groupPrefs, r) {
    const cuisinePct = r.cuisine === groupPrefs.cuisine ? 100 : 0;
    const areaPct = r.area === groupPrefs.area ? 100 : 0;
    const diff = Math.abs((r.price_level ?? 0) - Number(groupPrefs.budget));
    const pricePct = diff === 0 ? 100 : diff === 1 ? 60 : 0;
    return { cuisinePct, areaPct, pricePct };
}

function renderBreakdown(groupPrefs, topRestaurant, group) {
    const { cuisinePct, areaPct, pricePct } = computeComponents(
        groupPrefs,
        topRestaurant || {}
    );
    breakdownEl.hidden = false;

    document.getElementById("bar-cuisine").style.width = cuisinePct + "%";
    document.getElementById("bar-area").style.width = areaPct + "%";
    document.getElementById("bar-price").style.width = pricePct + "%";

    updateFriendsPill(group);
}

function cardHTML(r, i) {
    // fallback image from your Assets if DB has no URL
    const photo =
        r.photo_url || (i % 2 ? "Assets/Images/rest1.jpg" : "Assets/Images/rest2.jpg");
    const score100 = toHundred(r.fit_score);
    const price = "$".repeat(r.price_level ?? 0);
    const right = `
    <div class="right-col">
      <div class="score-badge">
        <small>Fitscore</small>
        <div style="font-size:1.4rem">${score100}</div>
      </div>
      <a class="reserve-btn" ${
        r.url
            ? `href="${r.url}" target="_blank" rel="noopener"`
            : `aria-disabled="true"`
    }>
        RESERVE
      </a>
    </div>
  `;
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
      </div>
      ${right}
    </article>
  `;
}

// ADD A FRIEND button
addFriendBtn.addEventListener("click", () => {
    const friend = readCurrentFriend();
    if (!validateFriend(friend)) {
        alert("Please fill all fields and pick a budget before adding a friend.");
        return;
    }
    friends.push(friend);
    updateFriendsPill(friends);
    clearFormForNextFriend();
});

// group add a friend
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const current = readCurrentFriend();
    if (!validateFriend(current)) {
        alert("Please fill all fields and pick a budget.");
        return;
    }

    // group = all friends that clicked "ADD A FRIEND" + the current one
    const group = [...friends, current];

    // combine preferences into one group profile
    const groupPrefs = aggregatePreferences(group);

    resultsEl.innerHTML = "<p>Loading…</p>";
    breakdownEl.hidden = true;

    try {
        const res = await fetch("/api/restaurants/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                // we only need one name/email for the API; keep first friend's
                name: group[0].name,
                email: group[0].email,
                cuisine: groupPrefs.cuisine,
                area: groupPrefs.area,
                budget: groupPrefs.budget,
            }),
        });
        if (!res.ok) {
            const problem = await res.json().catch(() => ({}));
            throw new Error(problem.error || "Request failed");
        }
        const { results = [] } = await res.json();

        if (!results.length) {
            resultsEl.innerHTML = "<p>No results found. Try widening your choices.</p>";
            return;
        }

        // Hide the form once we have valid results
        form.classList.add("hidden");

        // Show meters for the top match, using group preferences
        renderBreakdown(groupPrefs, results[0], group);

        // Show result cards
        resultsEl.innerHTML = `
      <h3 style="text-align:center;margin:0 0 .5rem">Based on your group's selection…</h3>
      ${results.map(cardHTML).join("")}
    `;
    } catch (err) {
        resultsEl.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    }
});
