# Bitemetric Demo 

Search for restaurants based on cuisine, budget and area choices of all your friends

Using Postgres as the backend for API. 

# Instructions 

Database csv file is in the folder
Add database manually to PGadmin4
.env file contains the PGadmin4 server details

Create database bitemetric 

in the database create 2 tables (restaurants) and log file (search_logs) in pgadmin4 using the code mentioned below

Make sure the server and database matches as mentioned in .env file

Run the demo in terminal in webstorm 

# For creating table restaurants in PGadmin4

CREATE TABLE IF NOT EXISTS restaurants (
name        TEXT NOT NULL,
cuisine     TEXT NOT NULL,
area        TEXT NOT NULL,
price_level INTEGER NOT NULL CHECK (price_level BETWEEN 1 AND 4),
rating      NUMERIC,
address     TEXT,
url         TEXT,
photo_url   TEXT
);

After running query - import the data

# For creating the table log records in PGadmin4

CREATE TABLE search_logs (
name TEXT NOT NULL,
email TEXT NOT NULL,
cuisine TEXT NOT NULL,
area TEXT NOT NULL,
budget INTEGER NOT NULL,
top_fit_score NUMERIC,
created_at TIMESTAMPTZ DEFAULT NOW()
);

Just run the query

# Running the demo in Webstorm

Incase there is an error dotenv not found
in terminal run " npm install dotenv "


In your webstorm open the project 

and in terminal run " npm start "
