const { port, apiUrl } = require('./config');
const app = require('./app');

app.listen(port, () => {
  console.log(`CampusFix web app running at http://localhost:${port}`);
  console.log(`Using API at ${apiUrl}`);
});
