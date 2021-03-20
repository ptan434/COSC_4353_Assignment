const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require("express-session");
const flash = require("express-flash");
const passport = require("passport");
const pool = require('./db');
const initializePassport = require("./passportConfig");
const dotenv = require("dotenv").config();


const app = express();
const PORT = process.env.PORT || 9000;
initializePassport(passport);

const dirname = __dirname + "/../client"
app.use(express.static(dirname));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(session({
      secret: process.env.session_secret,
      resave: false,
      saveUninitialized: false
    })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.get('/index', function(req, res) {
    res.sendFile(path.join(dirname + '/index.html'));
});

app.get("/fuel_quote", checkNotAuthenticated, (req, res) => {
    console.log(req.isAuthenticated());
    res.sendFile(path.join(dirname + '/components/fuel_quote.html'));
});

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

app.get("/fuel_history", (req, res) => {
  res.sendFile(path.join(dirname + '/components/fuel_history.html'));
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

app.post("/register", async(req, res) => {
    let {registerUserID, registerEmail, registerPass, registerConfirmPass, termCondition} = req.body;
    let errors = [];
  
    if (!registerUserID || !registerEmail || !registerPass || !registerConfirmPass || !termCondition) {
      errors.push({message: "Please enter all fields"});
    }
  
    if (registerPass !== registerConfirmPass) {
      errors.push({message: "Passwords do not match"});
    }

    if (termCondition != "on") {
      errors.push({message: "Please review our terms and conditions"});
    }
  
    if (errors.length > 0) {
      console.log(errors);
    }
    else {
      hashedPassword = await bcrypt.hash(registerPass, 10);
      console.log(hashedPassword);
      //Validation passed
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
                res.redirect("/index");
              }
            );
          }
        }
      );
    }
});

app.post("/login", passport.authenticate("local", {
      successRedirect: "/fuel_quote",
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
