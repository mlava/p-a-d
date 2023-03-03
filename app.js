import express from 'express';
import cors from 'cors';
import request from 'request';
const app = express();
var port = process.env.PORT || 3000;
app.use(cors());

var corsOptions = {
  origin: 'https://roamresearch.com',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.get('/', cors(corsOptions), (req, res) => {
  var url = "https://api.poets.org/api/poem-a-day";

  request(url, (error, res, html) => {
    if (!error) {
      console.log(html);
      res.json(html);
    }
  })

})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})