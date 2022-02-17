const express = require('express')
const { connect } = require('getstream')
const Pusher = require("pusher")
import 'dotenv/config'

// pusher
const pusher = new Pusher({
    appId: process.env.PUSHER_API_APPID,
    key: process.env.PUSHER_API_KEY,
    secret: process.env.PUSHER_API_SECRET,
    cluster: process.env.PUSHER_API_CLUSTER, // if `host` is present, it will override the `cluster` option.
})

// getstream 'firehose' activity feed integration
const api_key = process.env.API_KEY
const api_secret = process.env.API_SECRET

if (!api_key || !api_secret) {
    console.log('Missing env variables')
    return
}

const client = connect(api_key, api_secret, '102359')

const app = express()

const port = process.env.PORT || 8080;

// Open a realtime stream of Tweets, filtered according to rules
// https://developer.twitter.com/en/docs/twitter-api/tweets/filtered-stream/quick-start

const needle = require('needle');

// The code below sets the bearer token from your environment variables
// To set environment variables on macOS or Linux, run the export command below from the terminal:
// export BEARER_TOKEN='YOUR-TOKEN'
const token = process.env.BEARER_TOKEN

if (!token) {
    console.log(`Missing token: ${token}`)
    return
}

const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules'
const streamURL = 'https://api.twitter.com/2/tweets/search/stream'

// this sets up two rules - the value is the search terms to match on, and the tag is an identifier that
// will be applied to the Tweets return to show which rule they matched
// with a standard project with Basic Access, you can add up to 25 concurrent rules to your stream, and
// each rule can be up to 512 characters long

// Edit rules as desired below
const rules = [
    {
        'value': 'from:PCALive "WE HAVE A POLICE CHASE!" has:links -is:retweet',
        'tag': 'PCAlive'
    },
    {
        'value': 'from:LACoScanner #Pursuit (#KCAL9 OR @CBSLA) -is:retweet',
        'tag': 'LACoScanner'
    },
    {
        'value': 'from:ChaseAlert (#pursuit OR #pursuits) has:links -is:retweet',
        'tag': 'ChaseAlert'
    },
    {
        'value': 'from:CBSLA #BREAKING pursuit has:links (url:"https://cbsla.com/live" OR url:"https://losangeles.cbslocal.com/live/") -is:retweet',
        'tag': 'CBSLA'
    },
    {
        'value': 'from:ABC7 #LIVE (CHP OR LASD OR LAPD) has:links -is:retweet',
        'tag': 'ABC7'
    },
    {
        'value': 'from:MikeRogersTV (#BREAKING OR #PURSUIT) pursuit has:links url:"cbsloc.al"',
        'tag': 'MikeRogersTV'
    },
    {
        'value': 'from:mfreeman451 #TEST live (pursuit OR chase) has:links -is:retweet',
        'tag': 'mfreeman451'
    },
    {
        'value': 'from:Patharveynews #pursuit has:links -isretweet',
        'tag': 'Patharveynews'
    }

];

async function getAllRules() {

    const response = await needle('get', rulesURL, {
        headers: {
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 200) {
        throw new Error(response.body);
    }

    return (response.body);
}

async function deleteAllRules(rules) {

    if (!Array.isArray(rules.data)) {
        return null;
    }

    const ids = rules.data.map(rule => rule.id);

    const data = {
        "delete": {
            "ids": ids
        }
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 200) {
        throw new Error(response.body);
    }

    return (response.body);

}

async function setRules() {

    const data = {
        "add": rules
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 201) {
        console.log(response.body.errors)
        throw new Error(response.body);
    }

    return (response.body);

}

function streamConnect(retryAttempt) {

    const stream = needle.get(streamURL, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            "Authorization": `Bearer ${token}`
        },
        timeout: 20000
    });

    stream.on('data', async data => {
        try {
            console.log(`${Date.now()} - Streaming twitters..`)
            const json = JSON.parse(data);
            if (json.data) {
                client.user("twitter-server").getOrCreate({
                    name: "Twitter bot",
                    occupation: "Running the firehose",
                    gender: 'male'
                }).then((user) => {
                    const firehose = client.feed('events', 'firehose')

                    const activity = {
                        // actor needs to be a real user in the system..
                        actor: 'twitter-server',
                        verb: "event",
                        object: "twitter-message",
                        time: Date.now(),
                        created_at: Date.now(),
                        eventType: 'twitter',
                        payload: json.data,
                    }
                    firehose.addActivity(activity).then((add) => {
                        pusher.trigger("firehose", "updates", json.data)
                        console.log(`Added activity ${add.id}`)
                    }).catch((e) => {
                        console.error(e)
                    })
                } ).catch((error) => {
                    console.error(error)
                })
            }
            retryAttempt = 0;
        } catch (e) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                console.log(data.detail)
                process.exit(1)
            } else {
                // Keep alive signal received. Do nothing.
            }
        }
    }).on('err', error => {
        if (error.code !== 'ECONNRESET') {
            console.log(error.code);
            process.exit(1);
        } else {
            // This reconnection logic will attempt to reconnect when a disconnection is detected.
            // To avoid rate limits, this logic implements exponential backoff, so the wait time
            // will increase if the client cannot reconnect to the stream.
            setTimeout(() => {
                console.warn("A connection error occurred. Reconnecting...")
                streamConnect(++retryAttempt);
            }, 2 ** retryAttempt)
        }
    });

    return stream;

}


(async () => {
    let currentRules;

    try {
        // Gets the complete list of rules currently applied to the stream
        currentRules = await getAllRules();

        // Delete all rules. Comment the line below if you want to keep your existing rules.
        await deleteAllRules(currentRules);

        // Add rules to the stream. Comment the line below if you don't want to add new rules.
        await setRules();

    } catch (e) {
        console.error(e);
        process.exit(1);
    }

    // Listen to the stream.
    streamConnect(0);

    app.get('/', (req, res) => {
        res.send('Hello World')
    })

    app.listen(port, () => console.log(`twitter server running on port ${port}`))
})();