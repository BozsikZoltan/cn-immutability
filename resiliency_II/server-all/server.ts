import {CircuitBreaker} from './circuit-breaker';

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const axios = require('axios');
const client = axios.create({
    baseURL: 'http://' + process.env.KEY_VALUE_STORE_HOST + ':' + process.env.KEY_VALUE_STORE_PORT
    //baseURL: 'http://localhost' + ':' + 7480
});
const breaker = new CircuitBreaker({minFailedRequestThreshold: 2});

app.set('view engine', 'html');

app.engine('html', require('ejs').renderFile);

/** bodyParser.urlencoded(options)
 * Parses the text as URL encoded data (which is how browsers tend to send form data from regular forms set to POST)
 * and exposes the resulting object (containing the keys and values) on req.body
 */
app.use(bodyParser.urlencoded({
    extended: true
}));

/**
 * Get method
 * */
app.get('/', async function (req: any, res: any) {
    res.render('index', {items: mapEntriesToString(await getMap())});
});

/**
 * Set method
 * */
app.post('/set', async function (req: any, res: any) {
    await withExponentialBackoff(setValue, 1, req.body.set_text_key, req.body.set_text_value);
    return res.redirect('/');
});

/**
 * Increment method
 * */
app.post('/delete', async function (req: any, res: any) {
    const key = req.body.delete_text_key;
    const map = await getMap();

    if (map.has(key)) {
        const previous = map.get(key);

        await withExponentialBackoff(deleteKey, 1, key);
        console.log("(" + key + ") key deleted: " + previous);
    }

    return res.redirect('/');
});

/**
 * Async function to get the map form the key-store
 * */
async function getMap() {
    const result = await withExponentialBackoff(getFunction);

    if (result === null || result === undefined) {
        return new Map();
    }
    // @ts-ignore
    const map = new Map(result.data);
    console.log(map);

    return map;
}

/**
 * Async function to get the map form the key-store
 * */
function getFunction() {
    return client.get('/get')
        .then().catch(() => {
            throw new Error("Service is unavailable!");
        });
}

/**
 * Async function to set key in the key-store
 * */
async function setValue(key: string, value: number) {
    console.log('Set value invoked! key: ' + key + '; value: ' + value);
    await client.post('/set', {
        "key": key,
        "value": value
    }).then().catch(() => {
        throw new Error("Service is unavailable!");
    });
}

/**
 * Async function to set key in the key-store
 * */
async function deleteKey(key: string) {
    console.log('Delete key invoked! ' + key);
    await client.post('/delete', {
        "key": key
    }).then()
}

/**
 * Generic method for calling with exponential backoff strategy
 *
 * @param func: the method what we want to invoke
 * @param backoffTime: initial time (default 1[sec])
 * @param args: the parameters for the func
 * */
// @ts-ignore
async function withExponentialBackoff(func: any, backoffTime = 1, ...args: any) {
    return await withCircuitBreaker(func, ...args)
        .then()
        .catch((e) => {
            const nextBackoffTime = backoffTime * 1.15;
            console.error(e.message + ' Next try in: ' + nextBackoffTime + ' seconds.');

            return new Promise((resolve) =>
                setTimeout(() => resolve(withExponentialBackoff(func, nextBackoffTime, ...args)), nextBackoffTime * 1000));
        });
}

/**
 * Generic method for calling with circuit breaker strategy
 *
 * @param func: the method what we want to invoke
 * @param args: the parameters for the func
 * */

async function withCircuitBreaker(func: any, ...args: any) {
    return await breaker.fire(func, ...args).then();
}

/**
 * Converts map to Array
 * */
function mapEntriesToString(data: any) {
    if (data === null || data === undefined) {
        return;
    }

    return Array
        .from(data.entries(), ([k, v]) => `{${k}:${v}}`)
        .join(" ; ");
}

app.listen(process.env.PORT || 8080, () => {
    console.log("Node server started");
});