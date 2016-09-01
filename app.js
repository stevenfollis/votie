/*-----------------------------------------------------------------------------
This Bot uses the Bot Connector Service but is designed to showcase whats 
possible on Facebook using the framework. The demo shows how to create a looping 
menu how send things like Pictures, Bubbles, Receipts, and use Carousels. It also
shows all of the prompts supported by Bot Builder and how to receive uploaded
photos, videos, and location.

# RUN THE BOT:

    You can run the bot locally using the Bot Framework Emulator but for the best
    experience you should register a new bot on Facebook and bind it to the demo 
    bot. You can run the bot locally using ngrok found at https://ngrok.com/.

    * Install and run ngrok in a console window using "ngrok http 3978".
    * Create a bot on https://dev.botframework.com and follow the steps to setup
      a Facebook channel. The Facebook channel config page will walk you through 
      creating a Facebook page & app for your bot.
    * For the endpoint you setup on dev.botframework.com, copy the https link 
      ngrok setup and set "<ngrok link>/api/messages" as your bots endpoint.
    * Next you need to configure your bots MICROSOFT_APP_ID, and
      MICROSOFT_APP_PASSWORD environment variables. If you're running VSCode you 
      can add these variables to your the bots launch.json file. If you're not 
      using VSCode you'll need to setup these variables in a console window.
      - MICROSOFT_APP_ID: This is the App ID assigned when you created your bot.
      - MICROSOFT_APP_PASSWORD: This was also assigned when you created your bot.
    * Install the bots persistent menus following the instructions outlined in the
      section below.
    * To run the bot you can launch it from VSCode or run "node app.js" from a 
      console window. 

# INSTALL PERSISTENT MENUS

    Facebook supports persistent menus which Bot Builder lets you bind to global 
    actions. These menus must be installed using the page access token assigned 
    when you setup your bot. You can easily install the menus included with the 
    example by running the cURL command below:

        curl -X POST -H "Content-Type: application/json" -d @persistent-menu.json 
        "https://graph.facebook.com/v2.6/me/thread_settings?access_token=PAGE_ACCESS_TOKEN"
    
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var addressit = require('addressit');
var request = require('request');
var cheerio = require('cheerio');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Bots Middleware
//=========================================================

// Anytime the major version is incremented any existing conversations will be restarted.
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));

//=========================================================
// Bots Global Actions
//=========================================================

bot.endConversationAction('goodbye', 'Goodbye :)', { matches: /^goodbye/i });
bot.beginDialogAction('help', '/help', { matches: /^help/i });

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', [
    function (session) {
        // Send a greeting and show help.
        var card = new builder.HeroCard(session)
            .title("Votie")
            .text("I'm a bot helping make voting easier in North Carolina");
        // .images([
        //     builder.CardImage.create(session, "http://docs.botframework.com/images/demo_bot_image.png")
        // ]);
        var msg = new builder.Message(session).attachments([card]);
        session.send(msg);
        session.send("Howdy! I'm Votie, a bot made to help making voting easier for you! I know all about voting in North Carolina");
        session.beginDialog('/help');
    },
    function (session, results) {
        // Display menu
        session.beginDialog('/menu');
    },
    function (session, results) {
        // Always say goodbye
        session.send("Ok... See you later!");
    }
]);

bot.dialog('/menu', [
    function (session) {
        builder.Prompts.choice(session, "I can help with lots of tasks! Which of these would you like help with?", "where do i vote?|election date|website|register|(quit)");
    },
    function (session, results) {
        if (results.response && results.response.entity != '(quit)') {

            // Launch demo dialog
            //session.beginDialog('/' + results.response.entity);
            switch (results.response.entity) {
                case 'where do i vote?':
                    console.log('Starting my registration');
                    session.beginDialog('/myregistration', session.userData.profile);
                    break;
                case 'election date':
                    console.log('Starting election day');
                    session.beginDialog('/electionday');
                    break;
                case 'website':
                    console.log('Starting election website');
                    session.beginDialog('/electionwebsite');
                    break;
                case 'register':
                    console.log('Starting registration');
                    session.beginDialog('/voterapplication')
                    break;
            }

        }
        else {
            // Exit the menu
            session.endDialog();
        }
    },
    function (session, results) {
        // The menu runs a loop until the user chooses to (quit).
        session.replaceDialog('/menu');
    }
]).reloadAction('reloadMenu', null, { matches: /^menu|show menu/i });

bot.dialog('/electionday', function (session) {

    var msg = new builder.Message(session)
        .attachments([
            new builder.HeroCard(session)
                .title("Voting Day")
                .subtitle("Tuesday, November 8th 2016 is Voting Day")
                .text('It will be here before you know it! Are you registered?')
                .tap(builder.CardAction.openUrl(session, "http://www.ncsbe.gov/election-calendar"))
        ]);
    
    session.send(msg);
    session.beginDialog('/menu');

});

bot.dialog('/electionwebsite', function (session) {
    session.send('Please visit the offical election website at http://charmeck.org/mecklenburg/county/BOE/Pages/default.aspx. Thanks!');
    session.beginDialog('/menu');
});

bot.dialog('/voterapplication', function (session) {
    session.send('Please see the offical NC Voter Registration Application at http://ncsbe.azurewebsites.net/Portals/0/FilesP/NCVRRegFormv102013eng.pdf. Thanks!');
    session.beginDialog('/menu');
});

bot.dialog('/myregistration', [
    function (session, args, next) {

        // Store userData in session if it's available'
        session.userData = args || {};

        // Greetings and salutations
        session.send('Let\'s look up your voter registration!');
        next();

    },
    function (session, next) {

        // Check if first name is already known
        if (session.userData.firstName) {
            next();
        }
        else {

            // Prompt for first name
            builder.Prompts.text(session, 'I\'ll need a bit of information. \n To start, what is your first name?');

        }

    },
    function (session, results, next) {

        // Store first name 
        if (results.response !== null) {
            session.userData.firstName = results.response;
        }

        // Check if last name is already known
        if (session.userData.lastName) {
            next();
        }
        else {

            // Prompt user for last name
            builder.Prompts.text(session, 'Thanks! Nice to meet you, ' + session.userData.firstName + '. Now, what is your last name?');

        }

    },
    function (session, results, next) {

        // Store last name
        if (results.response !== null) {
            session.userData.lastName = results.response;
        }

        // Query site for list of registrations matching the query
        getRegistrations(session.userData, function (registrations) {

            // Store the returned set of registrations 
            session.dialogData.registrations = registrations;

            // Zero people returned
            if (registrations.length === 0) {
                session.endDialog('I\'m sorry but I cannot locate any individuals registered with that name');
            }

            // If there is only one person we don't need to get clarification
            if (registrations.length === 1) {
                session.userData.registration = registrations[0];
                next();
            }

            // If more than one person is found we need the user to clarify who they are
            if (registrations.length > 1) {

                // Build out markup for cards for each person
                var registrationCards = buildRegistrationCards(session);

                // Create carousel for user to clarify which person is them
                var msg = new builder.Message(session)
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(registrationCards.cards);

                // Check how many voters are returned
                session.send('Here are the folks I found in NC, which is you?');
                builder.Prompts.choice(session, msg, registrationCards.choices);

            }

        });

    },
    function (session, results) {

        // If user responded, locate correct person
        if (results.response) {

            // Loop through the set of registrations
            for (var i = 0; i < session.dialogData.registrations.length; i++) {

                // Locate the registration matching the user's selection and store it in userData
                if (session.dialogData.registrations[i].registrationNumber === results.response.entity) {
                    session.userData.registration = session.dialogData.registrations[i]
                }

            }

        }

        // Retrieve the person's polling place'
        getPollingPlace(session.userData.registration.detailsUrl, function (pollingPlace, voterAddress) {

            session.userData.address = voterAddress;

            var mapUrl = 'http://dev.virtualearth.net/REST/v1/Imagery/Map/Road/Routes?wp.0=' + encodeURI(session.userData.address) + ';64;1&wp.1=' + encodeURI(pollingPlace.address) + ';66;2&key=' + process.env.BING_MAPS_API_KEY;

            //session.send(mapUrl);
            session.send('Your polling location is ' + pollingPlace.name + ' @ ' + pollingPlace.address);


            var msg = new builder.Message(session)
                .attachments([
                    new builder.HeroCard(session)
                        .title("Your Polling Location")
                        .subtitle(pollingPlace.name)
                        .text(pollingPlace.address)
                        .images([
                            builder.CardImage.create(session, mapUrl)
                        ])
                        .tap(builder.CardAction.openUrl(session, "https://www.bing.com/maps"))
                ]);
            session.endDialog(msg);

        });

    }

])

function parseAddress(address) {
    return parser.parseLocation(address);
}

function getRegistrations(person, callback) {

    var url = 'https://enr.ncsbe.gov/voter_search_public/default.aspx?lname=' + person.lastName + '&lname_snd=False&fname=' + person.firstName + '&fname_snd=False&status=A,I,S';

    // GET the registration page
    request(url, function (error, response, body) {

        var $ = cheerio.load(body);

        // Parse the DOM to get returned voters
        var voters = $('#gvVoters tr:not(:first-child)').toArray();

        // Check if voter(s) were found for the queried name
        if (voters.length === 0) {

            // No voters found
            callback([]);

        }
        else if (voters.length > 0) {

            // Voter(s) found, build out response
            var registrations = [];

            // Loop through the voter DOM rows and parse into an object
            for (var i = 0; i < voters.length; i++) {

                // Pull voter values out of the DOM markup
                registrations.push({
                    name: voters[i].children[3].children[1].children[0].children[0].data,
                    location: voters[i].children[4].children[0].data,
                    detailsUrl: voters[i].children[3].children[1].attribs.href,
                    registrationNumber: voters[i].children[3].children[1].attribs.href.split('=')[1].split('&')[0],
                    county: voters[i].children[3].children[1].attribs.href.split('=')[2]
                });

                // Check if all voters have been processed
                if (voters.length == registrations.length) {
                    console.log('Scraped ' + registrations.length + ' from the web');
                    callback(registrations);
                }

            }

        }

    });

}

function getPollingPlace(urlFragment, callback) {

    var url = 'https://enr.ncsbe.gov/voter_search_public/' + urlFragment;

    request(url, function (error, results, body) {

        // Parse the DOM
        $ = cheerio.load(body);

        // Build out the polling place object
        var pollingPlace = {
            name: $('#hlPollingPlaceName').text(),
            address: $('#lblPollingPlaceAddr').html().split('<br>').join(' ').trim()
        }

        var rawAddress = $('#lblVoterAddress').html().split('<br>').join(' ').trim().replace(/#\s/, '#');

        var cleanedAddress = addressit(rawAddress);
        var simplifiedAddress = [cleanedAddress.number, cleanedAddress.street, cleanedAddress.regions[0], cleanedAddress.state].join(' ');

        // Grab the voter's address'
        var mapQueryUrl = 'http://dev.virtualearth.net/REST/v1/Locations?q=' + simplifiedAddress + '&o=json&key=' + process.env.BING_MAPS_API_KEY;
        request(mapQueryUrl, function (error, response, body) {

            // Parse out the top result address`
            var address = JSON.parse(body).resourceSets[0].resources[0].name;

            callback(pollingPlace, address);

        });

    });

}

function buildRegistrationCards(session) {

    var cards = [];
    var choices = [];

    // Loop through the registrations and built an array of cards
    for (var i = 0; i < session.dialogData.registrations.length; i++) {

        cards.push(
            new builder.HeroCard(session)
                .title(session.dialogData.registrations[i].name)
                .subtitle(session.dialogData.registrations[i].location)
                .buttons([
                    builder.CardAction.imBack(session, session.dialogData.registrations[i].registrationNumber, "This is Me")
                ])
        );

        choices.push(session.dialogData.registrations[i].registrationNumber);

    }

    // Add a not me card
    cards.push(
        new builder.HeroCard(session)
            .title('Oops')
            .buttons([
                builder.CardAction.imBack(session, "none", "None of these are me")
            ])
    );

    return { cards: cards, choices: choices };

}





bot.dialog('/help', [
    function (session) {
        session.endDialog("Global commands that are available anytime:\n\n* menu - Exits a demo and returns to the menu.\n* goodbye - End this conversation.\n* help - Displays these commands.");
    }
]);

bot.dialog('/prompts', [
    function (session) {
        session.send("Our Bot Builder SDK has a rich set of built-in prompts that simplify asking the user a series of questions. This demo will walk you through using each prompt. Just follow the prompts and you can quit at any time by saying 'cancel'.");
        builder.Prompts.text(session, "Prompts.text()\n\nEnter some text and I'll say it back.");
    },
    function (session, results) {
        session.send("You entered '%s'", results.response);
        builder.Prompts.number(session, "Prompts.number()\n\nNow enter a number.");
    },
    function (session, results) {
        session.send("You entered '%s'", results.response);
        session.send("Bot Builder includes a rich choice() prompt that lets you offer a user a list choices to pick from. On Facebook these choices by default surface using Quick Replies if there are 10 or less choices. If there are more than 10 choices a numbered list will be used but you can specify the exact type of list to show using the ListStyle property.");
        builder.Prompts.choice(session, "Prompts.choice()\n\nChoose a list style (the default is auto.)", "auto|inline|list|button|none");
    },
    function (session, results) {
        var style = builder.ListStyle[results.response.entity];
        builder.Prompts.choice(session, "Prompts.choice()\n\nNow pick an option.", "option A|option B|option C", { listStyle: style });
    },
    function (session, results) {
        session.send("You chose '%s'", results.response.entity);
        builder.Prompts.confirm(session, "Prompts.confirm()\n\nSimple yes/no questions are possible. Answer yes or no now.");
    },
    function (session, results) {
        session.send("You chose '%s'", results.response ? 'yes' : 'no');
        builder.Prompts.time(session, "Prompts.time()\n\nThe framework can recognize a range of times expressed as natural language. Enter a time like 'Monday at 7am' and I'll show you the JSON we return.");
    },
    function (session, results) {
        session.send("Recognized Entity: %s", JSON.stringify(results.response));
        builder.Prompts.attachment(session, "Prompts.attachment()\n\nYour bot can wait on the user to upload an image or video. Send me an image and I'll send it back to you.");
    },
    function (session, results) {
        var msg = new builder.Message(session)
            .ntext("I got %d attachment.", "I got %d attachments.", results.response.length);
        results.response.forEach(function (attachment) {
            msg.addAttachment(attachment);
        });
        session.endDialog(msg);
    }
]);

bot.dialog('/picture', [
    function (session) {
        session.send("You can easily send pictures to a user...");
        var msg = new builder.Message(session)
            .attachments([{
                contentType: "image/jpeg",
                contentUrl: "http://www.theoldrobots.com/images62/Bender-18.JPG"
            }]);
        session.endDialog(msg);
    }
]);

bot.dialog('/cards', [
    function (session) {
        session.send("You can use either a Hero or a Thumbnail card to send the user visually rich information. On Facebook both will be rendered using the same Generic Template...");

        var msg = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                    .title("Hero Card")
                    .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                    ])
                    .tap(builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Space_Needle"))
            ]);
        session.send(msg);

        msg = new builder.Message(session)
            .attachments([
                new builder.ThumbnailCard(session)
                    .title("Thumbnail Card")
                    .subtitle("Pike Place Market is a public market overlooking the Elliott Bay waterfront in Seattle, Washington, United States.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/320px-PikePlaceMarket.jpg")
                    ])
                    .tap(builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Pike_Place_Market"))
            ]);
        session.endDialog(msg);
    }
]);

bot.dialog('/list', [
    function (session) {
        session.send("You can send the user a list of cards as multiple attachments in a single message...");

        var msg = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                    .title("Space Needle")
                    .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                    ]),
                new builder.HeroCard(session)
                    .title("Pikes Place Market")
                    .subtitle("Pike Place Market is a public market overlooking the Elliott Bay waterfront in Seattle, Washington, United States.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/320px-PikePlaceMarket.jpg")
                    ])
            ]);
        session.endDialog(msg);
    }
]);

bot.dialog('/carousel', [
    function (session) {
        session.send("You can pass a custom message to Prompts.choice() that will present the user with a carousel of cards to select from. Each card can even support multiple actions.");

        // Ask the user to select an item from a carousel.
        var msg = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                    .title("Space Needle")
                    .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                            .tap(builder.CardAction.showImage(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/800px-Seattlenighttimequeenanne.jpg")),
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Space_Needle", "Wikipedia"),
                        builder.CardAction.imBack(session, "select:100", "Select")
                    ]),
                new builder.HeroCard(session)
                    .title("Pikes Place Market")
                    .subtitle("Pike Place Market is a public market overlooking the Elliott Bay waterfront in Seattle, Washington, United States.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/320px-PikePlaceMarket.jpg")
                            .tap(builder.CardAction.showImage(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/800px-PikePlaceMarket.jpg")),
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Pike_Place_Market", "Wikipedia"),
                        builder.CardAction.imBack(session, "select:101", "Select")
                    ]),
                new builder.HeroCard(session)
                    .title("EMP Museum")
                    .subtitle("EMP Musem is a leading-edge nonprofit museum, dedicated to the ideas and risk-taking that fuel contemporary popular culture.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Night_Exterior_EMP.jpg/320px-Night_Exterior_EMP.jpg")
                            .tap(builder.CardAction.showImage(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Night_Exterior_EMP.jpg/800px-Night_Exterior_EMP.jpg"))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/EMP_Museum", "Wikipedia"),
                        builder.CardAction.imBack(session, "select:102", "Select")
                    ])
            ]);
        builder.Prompts.choice(session, msg, "select:100|select:101|select:102");
    },
    function (session, results) {
        var action, item;
        var kvPair = results.response.entity.split(':');
        switch (kvPair[0]) {
            case 'select':
                action = 'selected';
                break;
        }
        switch (kvPair[1]) {
            case '100':
                item = "the Space Needle";
                break;
            case '101':
                item = "Pikes Place Market";
                break;
            case '102':
                item = "the EMP Museum";
                break;
        }
        session.endDialog('You %s "%s"', action, item);
    }
]);

bot.dialog('/receipt', [
    function (session) {
        session.send("You can send a receipts for facebook using Bot Builders ReceiptCard...");
        var msg = new builder.Message(session)
            .attachments([
                new builder.ReceiptCard(session)
                    .title("Recipient's Name")
                    .items([
                        builder.ReceiptItem.create(session, "$22.00", "EMP Museum").image(builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/a/a0/Night_Exterior_EMP.jpg")),
                        builder.ReceiptItem.create(session, "$22.00", "Space Needle").image(builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/7/7c/Seattlenighttimequeenanne.jpg"))
                    ])
                    .facts([
                        builder.Fact.create(session, "1234567898", "Order Number"),
                        builder.Fact.create(session, "VISA 4076", "Payment Method")
                    ])
                    .tax("$4.40")
                    .total("$48.40")
            ]);
        session.send(msg);

        session.send("Or using facebooks native attachment schema...");
        msg = new builder.Message(session)
            .sourceEvent({
                facebook: {
                    attachment: {
                        type: "template",
                        payload: {
                            template_type: "receipt",
                            recipient_name: "Stephane Crozatier",
                            order_number: "12345678902",
                            currency: "USD",
                            payment_method: "Visa 2345",
                            order_url: "http://petersapparel.parseapp.com/order?order_id=123456",
                            timestamp: "1428444852",
                            elements: [
                                {
                                    title: "Classic White T-Shirt",
                                    subtitle: "100% Soft and Luxurious Cotton",
                                    quantity: 2,
                                    price: 50,
                                    currency: "USD",
                                    image_url: "http://petersapparel.parseapp.com/img/whiteshirt.png"
                                },
                                {
                                    title: "Classic Gray T-Shirt",
                                    subtitle: "100% Soft and Luxurious Cotton",
                                    quantity: 1,
                                    price: 25,
                                    currency: "USD",
                                    image_url: "http://petersapparel.parseapp.com/img/grayshirt.png"
                                }
                            ],
                            address: {
                                street_1: "1 Hacker Way",
                                street_2: "",
                                city: "Menlo Park",
                                postal_code: "94025",
                                state: "CA",
                                country: "US"
                            },
                            summary: {
                                subtotal: 75.00,
                                shipping_cost: 4.95,
                                total_tax: 6.19,
                                total_cost: 56.14
                            },
                            adjustments: [
                                { name: "New Customer Discount", amount: 20 },
                                { name: "$10 Off Coupon", amount: 10 }
                            ]
                        }
                    }
                }
            });
        session.endDialog(msg);
    }
]);

bot.dialog('/actions', [
    function (session) {
        session.send("Bots can register global actions, like the 'help' & 'goodbye' actions, that can respond to user input at any time. You can even bind actions to buttons on a card.");

        var msg = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                    .title("Space Needle")
                    .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                    ])
                    .buttons([
                        builder.CardAction.dialogAction(session, "weather", "Seattle, WA", "Current Weather")
                    ])
            ]);
        session.send(msg);

        session.endDialog("The 'Current Weather' button on the card above can be pressed at any time regardless of where the user is in the conversation with the bot. The bot can even show the weather after the conversation has ended.");
    }
]);

// Create a dialog and bind it to a global action
bot.dialog('/weather', [
    function (session, args) {
        session.endDialog("The weather in %s is 71 degrees and raining.", args.data);
    }
]);
bot.beginDialogAction('weather', '/weather');   // <-- no 'matches' option means this can only be triggered by a button.

bot.dialog('/reset', function (session) {
    session.userData = null;
});