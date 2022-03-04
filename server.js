const express = require('express')
// Stream.io chat service
const { connect } = require('getstream')
// Pusher Channels
const Pusher = require("pusher")
// Pusher beams
const PushNotifications = require('@pusher/push-notifications-server');
require('dotenv').config()

// Used as the image in the notification
const imageURL = 'https://chaseapp.tv/Twitter_logo_blue_32.png'

// prometheus stuff
const Prometheus = require('prom-client')
const metricsInterval = Prometheus.collectDefaultMetrics()

// axios
const axios = require('axios').default

// pusher channels
const pusher = new Pusher({
    appId: process.env.PUSHER_API_APPID,
    key: process.env.PUSHER_API_KEY,
    secret: process.env.PUSHER_API_SECRET,
    cluster: process.env.PUSHER_API_CLUSTER, // if `host` is present, it will override the `cluster` option.
})

// pusher beams
let pushNotifications = new PushNotifications({
    instanceId: process.env.PUSHER_BEAMS_INSTANCE,
    secretKey: process.env.PUSHER_BEAMS_KEY
});

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
        'value': 'from:mfreeman451 #Firehose -is:retweet',
        'tag': 'mfreeman451'
    },
    {
        'value': 'from:Patharveynews #pursuit has:links -isretweet',
        'tag': 'Patharveynews'
    },
    {
        'value': 'from:LAPolicePursuit #Pursuit has:links -isretweet',
        'tag': 'LAPolicePursuit'
    },
    {
        'value': 'from:Stu_Mendel #SkyFox has:links -isretweet',
        'tag': 'Stu_Mendel_SkyFox'
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
        timeout: 20000 // TODO: maybe change this?
    });

    stream.on('data', async data => {
        try {
            console.log(`${Date.now()} - Streaming twitters..`)
            const json = JSON.parse(await data);
            if (json.data) {
                client.user("twitter-server").getOrCreate({
                    name: "Twitter bot",
                    occupation: "Running the firehose",
                    gender: 'male'
                }).then((user) => {
                    // use axios to get some more information about who sent the tweet
                    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
                    axios.get('https://api.twitter.com/2/tweets?ids=' + json.data.id + '&tweet.fields=created_at&expansions=author_id&user.fields=created_at')
                        .then((res) => {
                        // console.log(res.data.includes.users)
                        axios.get('https://api.twitter.com/2/users/by?usernames=' + res.data.includes.users[0].username + '&user.fields=created_at,profile_image_url&expansions=pinned_tweet_id&tweet.fields=author_id,created_at' )
                            .then((secondRes) => {
                                console.log(secondRes.data.data[0].profile_image_url)
                                json.data.name = secondRes.data.data[0].name
                                json.data.username = secondRes.data.data[0].username
                                json.data.image_url = secondRes.data.data[0].profile_image_url
                                console.log('Adding activity')
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
                                console.log(activity)
                                var d = new Date(); var n = d.toDateString();
                                firehose.addActivity(activity).then((add) => {
                                    pusher.trigger("firehose", "updates", activity)
                                    console.log(`Added activity ${add.id}`)
                                    // Send out Pusher Beams Notification
                                    pushNotifications.publishToInterests(['firehose-notifications'], {
                                        apns: {
                                            aps: {
                                                alert: 'Firehose - new tweet received from ' + res.data.includes.users[0].username
                                            }
                                        },
                                        fcm: {
                                            notification: {
                                                title: 'ChaseApp - Firehose',
                                                body: 'New tweet received from ' + res.data.includes.users[0].username,
                                                imageurl: imageURL
                                            }
                                        },
                                        web: {
                                            notification: {
                                                title: 'ChaseApp - Firehose',
                                                body: 'New tweet received from ' + res.data.includes.users[0].username,
                                                imageurl: imageURL
                                            }
                                        }
                                    }).then((publishResponse) => {
                                        console.log('Just published:', publishResponse.publishId);
                                        const myData = {
                                            body: "New tweet received from " + res.data.includes.users[0].username,
                                            createdAt: n,
                                            interest: 'firehose-notifications',
                                            title: 'twitter',
                                            data: {
                                                tweet_id: json.data.id,
                                                image: imageURL,
                                            }
                                        }
                                        console.log(myData)
                                        console.log('Before post')
                                        axios.post('https://us-central1-chaseapp-8459b.cloudfunctions.net/UpdateNotifications', myData).then((res) => {
                                            console.log('Posting to UpdateNotifications')
                                            if (res.status === '200') {
                                                console.log('Success')
                                            }
                                        }).catch((e) => {
                                            console.error(e)
                                        })
                                    }).catch((error) => {
                                        console.log('Error:', error);
                                    });
                                }).catch((e) => {
                                    console.error(e)
                                })
                            }).catch((e) => {
                                console.error(e)
                            })
                        }).catch((e) => {
                            console.log(e)
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
    }).on('done', (err) => {
        console.log('Stream terminating, bailing out..')
        if (err) {
            console.log('Stream has terminated, exiting..: ' + err.message)
            process.exit(0)
        }
        // process.exit(0)
    }).on('timeout', (err) => {
        console.log('A timeout occurred, exiting..')
        if (err) {
            console.log('A error occured during timeout, exiting: ' + err.message)
            process.exit(0)
        }

        process.exit(0)
    })

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

    app.get('/metrics', (req, res) => {
        res.set('Content-Type', Prometheus.register.contentType)
        Prometheus.register.metrics().then((data) => {
            res.send(data)
        })
        // res.end(Prometheus.register.metrics())
    })

    app.listen(port, () => console.log(`twitter server running on port ${port}`))
})();
