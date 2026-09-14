# Node-Postgres CRUD Practice

## What it does
the API allows us to CRUD operations on the users database 


## Tech stack
- Node.js
- Express
- PostgreSQL

## Setup
1. Clone this repo
2. `npm install`
3. Create a `.env` file with:
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=day3_practice
DB_PASSWORD=your_password_here
DB_PORT= 5432
4. `node app.js`

## API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | /       |checks the endpoint of home page|
| GET | /health | checks the endpoint of health|
| GET | /users |get all the users data |
| POST | /users |create a new user data |
| PUT | /users/:id | update a user with an id|
| DELETE | /users/:id | delete an user with id |