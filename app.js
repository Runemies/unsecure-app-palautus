import express from 'express';
import path from 'path';
import session from 'express-session';
import connectToDB from './database.js';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by')

app.use(helmet());
const csp = {
  defaultSrc: ["'self'"], 
  scriptSrc: ["'self'"], 
  styleSrc: ["'self'", "'https'","'unsafe-inline'"], 
  imgSrc: ["'self'", "data:"], 
  connectSrc: ["'self'", "'data'"], 
  fontSrc: ["'self'","'https'","'data'"], 
  objectSrc: ["'none'"], 
  upgradeInsecureRequests: [], 
};

app.use(helmet.contentSecurityPolicy({ directives: csp }));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Määritellään istuntojen käyttö
app.use(
  session({
    secret: 'salaisuus', // käytetään istunnon "allekirjoituksena"
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // aseta true, jos käytät HTTPS:ää
  })
);

// Middleware-tarkistus kirjautumista varten
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next(); // Käyttäjä on kirjautunut, jatketaan routeen
  } else {
    res.status(401).send('You must log in to view this page'); // Estetään pääsy
  }
}

// Käynnistää palvelimen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


// ROUTET

// Etusivu
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'frontpage.html'));
});


// Rekisteröitymissivu
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// Rekisteröinnin käsittely
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  // SQL-kysely
  const sql = `INSERT INTO users (name, email, password) VALUES ('${name}', '${email}', '${password}')`;
  const db = await connectToDB();

  try {
    await db.run(sql);
    res.redirect('/'); // Ohjaa käyttäjä etusivulle rekisteröinnin jälkeen
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Unable to register user');
  } finally {
    await db.close();
  }
});


// Kirjautumissivu
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Kirjautumisen käsittely
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const sql = `SELECT * FROM users WHERE email = ?`;
  const db = await connectToDB();

  try {
    const user = await db.get(sql, [email]);
    if (user && (password == user.password)) {
      req.session.userId = user.id; // Asetetaan istunto kirjautumisen yhteydessä
      res.redirect('/apis'); // Ohjaa käyttäjä /apis-sivulle
    } else {
      res.status(401).send('Invalid email or password');
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Unable to log in');
  } finally {
    await db.close();
  }
});


// Rajapintojen listaus, vain kirjautuneille käyttäjille
app.get('/apis', isAuthenticated, async (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'apis.html'));
});

// Käyttäjien listaus, vain kirjautuneille käyttäjille
app.get('/api/users', async (req, res) => {
  const sql = 'SELECT * FROM users';
  const db = await connectToDB();

  try {
    const rows = await db.all(sql);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Unable to fetch users');
  } finally {
    await db.close();
  }
});

//update check

app.get('/check-updates', (req, res) => {
  exec('npm outdated --json', (error, stdout) => {
    if (error) {
      console.error(`Error executing npm outdated: ${error}`);
      return res.status(500).json({ message: 'Error checking for updates.' });
    }

    try {
      const outdatedPackages = JSON.parse(stdout);
      if (Object.keys(outdatedPackages).length === 0) {
        res.json({ message: 'All packages are up to date' });
      } else {
        const updates = Object.keys(outdatedPackages).map(pkg => {
          return `${pkg} (Current: ${outdatedPackages[pkg].current}, Latest: ${outdatedPackages[pkg].latest})`;
        }).join(', ');
        res.json({ message: `Updates available for: ${updates}` });
      }
    } catch (parseError) {
      console.error(`Error parsing npm outdated output: ${parseError}`);
      res.status(500).json({ message: 'Error checking for updates.' });
    }
  });
});


// Logout-käsittely
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Logout failed');
    }
    res.redirect('/'); // Ohjaa takaisin etusivulle logoutin jälkeen
  });
});
