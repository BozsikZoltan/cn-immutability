const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const schedule = require('node-schedule');
const axios = require('axios');
const client = axios.create({
    //baseURL: 'http://' + process.env.KEY_VALUE_STORE_HOST + ':' + process.env.KEY_VALUE_STORE_PORT
    baseURL: 'http://localhost' + ':' + 7280   //queue
});


app.set('view engine', 'html');

app.engine('html', require('ejs').renderFile);

/** bodyParser.urlencoded(options)
 * Parses the text as URL encoded data (which is how browsers tend to send form data from regular forms set to POST)
 * and exposes the resulting object (containing the keys and values) on req.body
 */
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json())

/**
 * Storage
 * */
const map = new Map();

function actionGet(res) {
    res.end(JSON.stringify(Array.from(map.entries())));
}

/**
 * Get method
 * */
app.get('/get', (req, res) => {
    actionGet(res);
});

/**
 * Action method
 * */
app.post('/action', function (req, res) {
    const key = req.body.key;
    const value = req.body.value;
    const action = req.body.action;

    if (action === "set") {
        actionSet(key, value, res);
    } else if (action === "get") {
        res.end(mapEntriesToString());
    } else if (action === "delete") {
        actionDelete(key, res);
    }
});

function actionSet(key, value, res, previous) {
    if (key === null || value === null) {
        res.end(mapEntriesToString());
    }

    if (map.has(key)) {
        previous = map.get(key);
    }

    map.set(key, value);

    console.log("(" + key + ") key set: " + previous + "-->" + map.get(key));
    res.end(mapEntriesToString());
}

function actionDelete(key, res) {
    let previous;

    if (map.has(key)) {
        previous = map.get(key);
        map.delete(key)
        console.log("(" + key + ") key delete: " + previous);
    }

    res.end();
}

/**
 * Converts map to Array
 * */
function mapEntriesToString() {
    return Array
        .from(map.entries(), ([k, v]) => `{${k}:${v}}`)
        .join(" ; ");
}

app.listen(process.env.PORT || 7480, () => {
    console.log("Node server started");
});