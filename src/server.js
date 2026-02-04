require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "home.html"));
});

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
});

// NEW: helper that mirrors your SQL scoring logic, but in JS
function computeFitScore(restaurant, pref) {
    let score = 0;

    // cuisine match
    if (restaurant.cuisine === pref.cuisine) {
        score += 50;
    }

    // area match
    if (restaurant.area === pref.area) {
        score += 25;
    }

    // price / budget match
    const priceLevel = restaurant.price_level ?? 0;
    const budget = Number(pref.budget);
    const diff = Math.abs(priceLevel - budget);

    if (diff === 0) {
        score += 25;
    } else if (diff === 1) {
        score += 15;
    }

    // rating bonus
    const rating = restaurant.rating ?? 0;
    score += rating * 5;

    return score;
}

// for search tab
app.post("/api/restaurants/search", async (req, res) => {
    const { name, email, cuisine, area, budget } = req.body;
    if (!name || !email || !cuisine || !area || !budget) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const sql = `
    SELECT
      name,
      cuisine,
      area,
      price_level,
      rating,
      address,
      url,
      (
        (CASE WHEN cuisine = $1 THEN 50 ELSE 0 END) +
        (CASE WHEN area = $2 THEN 25 ELSE 0 END) +
        (CASE
          WHEN ABS(price_level - $3) = 0 THEN 25
          WHEN ABS(price_level - $3) = 1 THEN 15
          ELSE 0
        END) +
        (COALESCE(rating, 0) * 5)
      ) AS fit_score
    FROM restaurants
    ORDER BY fit_score DESC, rating DESC NULLS LAST
    LIMIT 20;
  `;

    try {
        // 1) run the main search
        const { rows } = await pool.query(sql, [cuisine, area, budget]);

        // 2) identify top result (if any)
        const top = rows[0] || null;

        // 3) insert a log row
        const logSql = `
            INSERT INTO search_logs
                (name, email, cuisine, area, budget, top_fit_score)
            VALUES
                ($1, $2, $3, $4, $5, $6);
        `;

        await pool.query(logSql, [
            name,
            email,
            cuisine,
            area,
            Number(budget),
            top ? top.fit_score : null,
        ]);

        // 4) respond to the client
        res.json({ query: { name, email, cuisine, area, budget }, results: rows });
    } catch (err) {
        console.error("Search or logging error:", err);
        res.status(500).json({ error: "DB error", detail: err.message });
    }
});

// add-friend group search
app.post("/api/restaurants/group-search", async (req, res) => {
    const { friends } = req.body;

    if (!Array.isArray(friends) || friends.length === 0) {
        return res.status(400).json({ error: "friends array is required" });
    }

    try {
        // 1) Get candidate restaurants (no fit_score in SQL now)
        const sql = `
        SELECT
          name,
          cuisine,
          area,
          price_level,
          rating,
          address,
          url
        FROM restaurants
        ORDER BY rating DESC NULLS LAST, name ASC
        LIMIT 200;
      `;

        const { rows: restaurants } = await pool.query(sql);

        // 2) Compute average fit_score across all friends for each restaurant
        const scored = restaurants.map((r) => {
            let total = 0;

            for (const friend of friends) {
                total += computeFitScore(r, friend);
            }

            const avg = total / friends.length;

            // Keep property name `fit_score` so frontend code can reuse it
            return {
                ...r,
                fit_score: avg,
            };
        });

        // 3) Sort by fit_score desc, then rating desc as tie-breaker
        scored.sort((a, b) => {
            if (b.fit_score !== a.fit_score) {
                return b.fit_score - a.fit_score;
            }
            const ra = a.rating ?? 0;
            const rb = b.rating ?? 0;
            return rb - ra;
        });

        // 4) Log the search using the first friend (same table as before)
        const top = scored[0] || null;

        await pool.query(
            `
            INSERT INTO search_logs
                (name, email, cuisine, area, budget, top_fit_score)
            VALUES
                ($1, $2, $3, $4, $5, $6);
        `,
            [
                friends[0].name,
                friends[0].email,
                friends[0].cuisine,
                friends[0].area,
                Number(friends[0].budget),
                top ? top.fit_score : null,
            ]
        );

        // 5) Respond to the client
        res.json({ results: scored });
    } catch (err) {
        console.error("Group search error:", err);
        res.status(500).json({ error: "DB error", detail: err.message });
    }
});

// For explore page

app.get("/api/restaurants/explore", async (req, res) => {
    const { area, cuisine, budget } = req.query;

    const where = [];
    const params = [];
    let idx = 1;

    if (cuisine) {
        where.push(`cuisine = $${idx++}`);
        params.push(cuisine);
    }
    if (area) {
        where.push(`area = $${idx++}`);
        params.push(area);
    }
    if (budget) {
        // budget is 1–4; we’ll treat it as a target price_level
        where.push(`price_level = $${idx++}`);
        params.push(Number(budget));
    }

    let sql = `
    SELECT
      name,
      cuisine,
      area,
      price_level,
      rating,
      address,
      url
    FROM restaurants
  `;

    if (where.length) {
        sql += " WHERE " + where.join(" AND ");
    }

    sql += `
    ORDER BY rating DESC NULLS LAST, name ASC
    LIMIT 200;
  `;

    try {
        const { rows } = await pool.query(sql, params);
        res.json({ results: rows });
    } catch (err) {
        console.error("Explore query error:", err);
        res.status(500).json({ error: "DB error", detail: err.message });
    }
});
//server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));
