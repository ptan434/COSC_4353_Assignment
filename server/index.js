const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require("express-session");
const flash = require("express-flash");
const passport = require("passport");
const fs = require("fs");
const pool = require("./db");
const initializePassport = require("./passportConfig");


const app = express();
const PORT = process.env.PORT || 9000;
initializePassport(passport);

const dirname = __dirname + "/../client"
app.use(express.static(dirname));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(session({
      secret: "SESSION_SECRET",
      resave: false,
      saveUninitialized: false
    })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', dirname);

app.get('/index', (req, res) => {
    res.sendFile(path.join(dirname + '/index.html'));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(dirname + '/components/login.html'));
});

app.get("/fuel_quote", checkNotAuthenticated, async(req, res) => {
  console.log(req.isAuthenticated());
  console.log(req.user.user_id);
  var userID = req.user.user_id;
  var check = await checkAddress(userID);
  console.log(check[0].primary_address_id);

  var get = await getAddress(check[0].primary_address_id);
  var address = get[0].address.trim() + " " + get[0].city.trim() + ", " + get[0].state.trim() + " " + get[0].zipcode.trim();
  console.log(address);
  
 
  res.render(path.join(dirname + '/components/fuel_quote'), {address:address });

});

app.get("/fuel_history", (req, res) => {
  res.sendFile(path.join(dirname + '/components/fuel_history.html'));
});

app.get("/profile", checkNotAuthenticated, async(req, res) => {
  console.log(req.isAuthenticated());
  var check = await checkProfile(req.user.user_id);
  if (check.length > 0)
    res.sendFile(path.join(dirname + '/components/profile.html'));
  else
    res.redirect("/create_profile");
});

app.get("/create_profile", checkNotAuthenticated, async(req, res) => {
  console.log(req.isAuthenticated());
  var check = await checkProfile(req.user.user_id);
  if (check.length > 0)
    res.redirect("/profile");
  else
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
      var passed = true;
      var check;
      if (passed) {
        check = await checkID(registerUserID);
        console.log("check id length: " + check.length);
        if (check.length > 0) {
          console.log("User ID already registered.");
          passed = false;
        }
      }
      if (passed) {
        check = await checkEmail(registerEmail);
        console.log("check email length: " + check.length);
        if (check.length > 0) {
          console.log("Email already registered.");
          passed = false;
        }
      }
      if (passed) {
        pool.query(
          `INSERT INTO users (user_id, password, email, last_login)
              VALUES ($1, $2, $3, NULL)`,
          [registerUserID, hashedPassword, registerEmail],
          (err, results) => {
            if (err) {
              throw err;
            }
            console.log("You are now registered. Please log in to complete your profile.");
            res.redirect("/login");
          }
        );
      }
    }
});

app.post("/create_profile", async(req, res) => {
  let {fullName, addressOne, cityOne, stateOne, zipCodeOne,
    addressTwo, cityTwo, stateTwo, zipCodeTwo} = req.body;
  var queryAddress;
  var userID = req.user.user_id;
  var secondaryAddress;
  var primaryAddressID;
  var secondaryAddressID;
  let errors = [];

  if (fullName.length > 50)
    errors.push({message: "Maximum length for name is 50"});
  if (addressOne.length > 100)
    errors.push({message: "Maximum length for address is 100"});
  if (cityOne.length > 100)
    errors.push({message: "Maximum length for city is 100"});
  if (zipCodeOne.length < 5)
    errors.push({message: "Minimum length for zip code is 5"});
  if (zipCodeOne.length > 9)
    errors.push({message: "Maximum length for zip code is 9"});

  if (fullName == "" || addressOne == "" || cityOne == "" || stateOne == "null" || zipCodeOne == "")
    errors.push({message: "Please enter all required fields for primary address"});
  else if (addressTwo != "" && cityTwo != "" && stateTwo != "null" && zipCodeTwo != "")
    secondaryAddress = true;
  else if (addressTwo != "" || cityTwo != "" || stateTwo != "null" || zipCodeTwo != "")
    errors.push({message: "Please enter all required fields for secondary address"});
  else
    secondaryAddress = false;
  
  if (errors.length > 0) {
    console.log(errors);
  }
  else {
    queryAddress =
      `INSERT INTO address (address, city, state, zipcode)
        VALUES ('${addressOne}', '${cityOne}', '${stateOne}', '${zipCodeOne}')
        RETURNING address_id`;
    primaryAddressID = await pool.query(queryAddress);

    if (secondaryAddress) {
      queryAddress =
      `INSERT INTO address (address, city, state, zipcode)
        VALUES ('${addressTwo}', '${cityTwo}', '${stateTwo}', '${zipCodeTwo}')
        RETURNING address_id`;
      secondaryAddressID = await pool.query(queryAddress);

      pool.query(
        `INSERT INTO profile (user_id, primary_address_id, secondary_address_id, full_name)
          VALUES ('${userID}', '${primaryAddressID.rows[0].address_id}', '${secondaryAddressID.rows[0].address_id}', '${fullName}')`,
          (err, results) => {
            if (err) {
              throw err;
            }
            console.log("Congratulation, you have completed your registration.");
            res.redirect("/profile");
          }
      );
    }
    else
      pool.query(
        `INSERT INTO profile (user_id, primary_address_id, secondary_address_id, full_name)
          VALUES ('${userID}', '${primaryAddressID.rows[0].address_id}', NULL, '${fullName}')`,
          (err, results) => {
            if (err) {
              throw err;
            }
            console.log("Congratulation, you have completed your registration.");
            res.redirect("/profile");
          }
      );
  }
});

app.post("/login",
  passport.authenticate("local", {
    failureRedirect: "/index",
    failureFlash: true
  }),
  function(req, res) {
    pool.query(
      `UPDATE users
        SET last_login = CURRENT_TIMESTAMP
        WHERE user_id = '${req.user.user_id}'`,
        (err, results) => {
          if (err) {
            throw err;
          }
          res.redirect("/profile");
        }
    );
  });

app.post("/new_user",
  passport.authenticate("local", {
    failureRedirect: "/index",
    failureFlash: true
  }),
  function(req, res) {
    pool.query(
      `UPDATE users
        SET last_login = CURRENT_TIMESTAMP
        WHERE user_id = '${req.user.user_id}'`,
        (err, results) => {
          if (err) {
            throw err;
          }
          res.redirect("/create_profile");
        }
    );
  });
  
function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/index");
}

app.listen(PORT, ()=>{
    console.log(`Server started on port ${PORT}`);
});

const checkID = async(registerUserID) => {
  var response = await pool.query(
    `SELECT * FROM users
      WHERE user_id = $1`,
    [registerUserID]
  );
  return response.rows;
}

const checkEmail = async(registerEmail) => {
  var response = await pool.query(
    `SELECT * FROM users
      WHERE email = $1`,
    [registerEmail]
  );
  return response.rows;
}

const checkProfile = async(userID) => {
  var response = await pool.query(
    `SELECT * FROM profile
      WHERE user_id = $1`,
    [userID]
  );
  return response.rows;
}
