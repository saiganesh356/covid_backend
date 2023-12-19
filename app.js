const exe = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db_path = path.join(__dirname, "covid19IndiaPortal.db");
const app = exe();
app.use(exe.json());
let db = null;
const instalize_server = async () => {
  db = await open({
    filename: db_path,
    driver: sqlite3.Database,
  });
  app.listen(3000, () => {
    console.log("server has been started");
  });
};
instalize_server();

const camelCase = (each) => {
  return {
    stateId: each.state_id,
    stateName: `${each.state_name}`,
    population: each.population,
  };
};

const verification = (request, response, next) => {
  let jwttoken;
  let header = request.headers["authorization"];

  if (header !== undefined) {
    jwttoken = header.split(" ")[1];
    console.log(jwttoken);
  }
  if (header === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwttoken, "my_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  console.log(request.header["authorization"]);
  let { username, password } = request.body;
  let query = `
 SELECT
 *
 FROM 
 user
 WHERE
 username='${username}';`;
  let db_result = await db.get(query);
  if (db_result === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let verification_data = await bcrypt.compare(password, db_result.password);
    if (verification_data === true) {
      let payload = {
        username: username,
      };
      let token = jwt.sign(payload, "my_key");
      response.send({ jwtToken: `${token}` });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 2

app.get("/states/", verification, async (request, response) => {
  let query = `
    SELECT 
    *
    FROM
    state;`;
  let states = await db.all(query);
  response.status(200);
  response.send(states.map((each) => camelCase(each)));
});

// API 3

app.get("/states/:stateId/", verification, async (request, response) => {
  let { stateId } = request.params;
  let query = `
  SELECT 
  *
  FROM 
  state
  WHERE
  state_id=${stateId};`;
  let result = await db.get(query);
  response.status(200);
  response.send({
    stateId: result["state_id"],
    stateName: `${result["state_name"]}`,
    population: result["population"],
  });
});

//API 4

app.post("/districts/", verification, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;
  let query = `
  INSERT INTO  district
  (district_name,state_id,cases,cured,active,deaths)
  VALUES(
    '${districtName}',
      ${stateId},
    ${cases},
      ${cured},
      ${active},
      ${deaths});`;
  await db.run(query);
  response.status(200);
  response.send("District Successfully Added");
});

//API 5

app.get("/districts/:districtId/", verification, async (request, response) => {
  let { districtId } = request.params;
  let query = `
  SELECT 
  *
  FROM 
  district
  WHERE
  district_id=${districtId};`;
  let result = await db.get(query);
  response.send({
    districtId: result["district_id"],
    districtName: `${result["district_name"]}`,
    stateId: result["state_id"],
    cases: result["cases"],
    cured: result["cured"],
    active: result["active"],
    deaths: result["deaths"],
  });
});

// API 6

app.delete(
  "/districts/:districtId/",
  verification,
  async (request, response) => {
    let { districtId } = request.params;
    let query = `
    DELETE FROM
    district
    WHERE
    district_id=${districtId};`;
    await db.run(query);
    response.status(200);
    response.send("District Removed");
  }
);
//API 7

app.put("/districts/:districtId/", verification, async (request, response) => {
  let { districtId } = request.params;
  let { districtName, stateId, cases, cured, active, deaths } = request.body;
  let query = `
    UPDATE district
    SET
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    WHERE
    district_id=${districtId};`;
  await db.run(query);
  response.status(200);
  response.send("District Details Updated");
});

//API 8

app.get("/states/:stateId/stats/", verification, async (request, response) => {
  let { stateId } = request.params;
  let query = `
  SELECT
  SUM(cases) AS cases,
  SUM(cured) AS cured,
  SUM(active) AS active,
  SUM(deaths) AS deaths
  FROM 
  district
  WHERE
  state_id=${stateId};`;
  let result = await db.get(query);
  response.status(200);
  response.send({
    totalCases: result["cases"],
    totalCured: result["cured"],
    totalActive: result["active"],
    totalDeaths: result["deaths"],
  });
});
module.exports = app;
