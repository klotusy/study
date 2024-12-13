const app = require('./server');
const cors = require('cors');
app.use(cors());

app.listen(8080, () => {
    console.log("Server running on port 8080");
});