var builder = require('botbuilder');
var request = require('request');
var cheerio = require('cheerio');
var addressit = require('addressit');

module.exports = [

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
                    session.userData.registration = session.dialogData.registrations[i];
                }

            }

        }

        // Retrieve the person's polling place'
        getPollingPlace(session.userData.registration.detailsUrl, function (pollingPlace, voterAddress) {

            session.userData.address = voterAddress;

            var mapUrl = 'http://dev.virtualearth.net/REST/v1/Imagery/Map/Road/Routes?wp.0=' + encodeURI(session.userData.address) + ';64;1&wp.1=' + encodeURI(pollingPlace.address) + ';66;2&key=' + process.env.BING_MAPS_API_KEY;

            //session.send(mapUrl);
            session.send('Your polling location is ' + pollingPlace.name + ' @ ' + pollingPlace.address);

            // Create a polling location card
            var msg = new builder.Message(session)
                .attachments([
                    new builder.HeroCard(session)
                        .title("Your Polling Location")
                        .subtitle(pollingPlace.name)
                        .text(pollingPlace.address)
                        .images([
                            builder.CardImage.create(session, mapUrl)
                        ])
                        .tap(builder.CardAction.openUrl(session, "http://bing.com/maps/default.aspx?where1=" + pollingPlace.address))
                ]);
            session.endDialog(msg);

        });

    }

];

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
        };

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

