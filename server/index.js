const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require("express-session");
const flash = require("express-flash");
const passport = require("passport");
const fs = require("fs");
const pool = require("./db");
const initializePassport = require("./passportConfig");
const dotenv = require("dotenv").config();
var userData = require("./userObject");


const app = express();
const PORT = process.env.PORT || 9000;
initializePassport(passport);

const dirname = __dirname + "/../client"
app.use(express.static(dirname));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false
    })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.get('/index', (req, res) => {
    res.sendFile(path.join(dirname + '/index.html'));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(dirname + '/components/login.html'));
});

app.get("/fuel_quote", checkNotAuthenticated, (req, res) => {
  console.log(req.isAuthenticated());
  res.sendFile(path.join(dirname + '/components/fuel_quote.html'));
});

app.get("/fuel_history", (req, res) => {
  res.sendFile(path.join(dirname + '/components/fuel_history.html'));
});

app.get("/profile", checkNotAuthenticated, (req, res) => {
  console.log(req.isAuthenticated());
  res.sendFile(path.join(dirname + '/components/profile.html'));
});

app.get("/create_profile", checkNotAuthenticated, (req, res) => {
  // Need to check if user exist
  console.log(req.isAuthenticated());
  res.sendFile(path.join(dirname + '/components/create_profile.html'));
});

app.get("/fuel_quote_history", (req, res) => {
  fs.readFile('user.json', 'utf8' , (err, info) => {
    if (err) {
      console.error(err)
      return
    }
    var user_history = JSON.parse(info);
    res.send(user_history)
  })
})

app.post("/fuel_quote_handle", (req, res) => {
  let {gallonsRequested, deliveryAddress, deliveryDate, suggestedPrice, total} = req.body;
  const infodata = req.body
  const info = JSON.stringify(infodata)
  

  fs.readFile('user.json', function (err, data) {
    var json = JSON.parse(data);
    json.push(infodata);   

    fs.writeFile("user.json", JSON.stringify(json), function(err){
      if (err) throw err;
      console.log('The "data to append" was appended to file!');
    });
})

  console.log(info);
  res.redirect("/fuel_history");
 
  // res.json(info);
})

app.post("/register", async(req, res) => {
    let {registerUserID, registerEmail, registerPass, registerConfirmPass, termCondition} = req.body;
    let errors = [];
  
    if (!registerUserID || !registerEmail || !registerPass || !registerConfirmPass || !termCondition) {
      errors.push({message: "Please enter all fields"});}
    if (registerPass !== registerConfirmPass) {
      errors.push({message: "Passwords do not match"});}
    if (termCondition != "on") {
      errors.push({message: "Please review our terms and conditions"});}

    if (errors.length > 0) {
      console.log(errors);
    }
    else {
      hashedPassword = await bcrypt.hash(registerPass, 10);
      console.log(hashedPassword);
      //Validation passed
      userData.user_id = registerUserID;
      userData.email = registerEmail;
      userData.password = registerPass;
      pool.query(
        `SELECT * FROM users
          WHERE email = $1`,
        [registerEmail],
        (err, results) => {
          if (err) {
            console.log(err);
          }
          console.log(results.rows);
  
          if (results.rows.length > 0) {
            console.log("Email already registered.");
          }
          else {
            pool.query(
              `INSERT INTO users (user_id, password, email)
                  VALUES ($1, $2, $3)
                  RETURNING user_id, password`,
              [registerUserID, hashedPassword, registerEmail],
              (err, results) => {
                if (err) {
                  throw err;
                }
                console.log(results.rows);
                console.log("You are now registered. Please log in to complete your profile.");
                res.redirect("/login");
              }
            );
          }
        }
      );
    }
});

app.post("/create_profile", async(req, res) => {
  let {fullName, addressOne, cityOne, stateOne, zipCodeOne,
    addressTwo, cityTwo, stateTwo, zipCodeTwo} = req.body;
  let errors = [];

  if (!fullName || !addressOne || !cityOne || stateOne=="null" || !zipCodeOne) {
    errors.push({message: "Please enter all required fields"});}
  if (fullName.length > 50) {
    errors.push({message: "Maximum length for name is 50"});}
  if (addressOne.length > 100) {
    errors.push({message: "Maximum length for address is 100"});}
  if (cityOne.length > 100) {
    errors.push({message: "Maximum length for city is 100"});}
  if (stateOne == "null") {
    errors.push({message: "Please enter a state"});}
  if (zipCodeOne.length < 5) {
    errors.push({message: "Minimum length for zip code is 5"});}
  if (zipCodeOne.length > 9) {
    errors.push({message: "Maximum length for zip code is 9"});}

  if (errors.length > 0) {
    console.log(errors);
  }
  else {
    userData.full_name = fullName;
    userData.address_one = addressOne;
    userData.city_one = cityOne;
    userData.state_one = stateOne;
    userData.zip_code_one = zipCodeOne;
    userData.address_two = addressTwo;
    userData.city_two = cityTwo;
    userData.state_two = stateTwo;
    userData.zip_code_two = zipCodeTwo;
    console.log("Congratulation, you have completed your registration.");
    console.log(userData);
    res.redirect("/profile");
  }
});

app.post("/login", passport.authenticate("local", {
      successRedirect: "/profile",
      failureRedirect: "/index",
      failureFlash: true
    })
);

app.post("/new_user", passport.authenticate("local", {
  successRedirect: "/create_profile",
  failureRedirect: "/index",
  failureFlash: true
})
);
  
function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/index");
}

app.listen(PORT, ()=>{
    console.log(`Server started on port ${PORT}`);
});
