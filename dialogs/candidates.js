var builder = require('botbuilder');
var request = require('request');
var appInsights = require('../config/appInsights.js');
var _ = require('lodash');

module.exports = [

    function (session, args, next) {

        // Greetings and salutations
        // Check if the stored address should be used
        if (session.userData.address) {

            builder.Prompts.confirm(session, `I can help look up your national and local election candidates! Should I use your address from earlier? (${session.userData.address})`);

        }
        else {

            // No information is stored
            session.send(`I can help look up your national and local election candidates!`);
            next();

        }

    },
    function (session, results, next) {

        if (results.response === true) {

            // Use the existing address
            session.send(`OK, looking up candidates for ${session.userData.address}`);
            next();

        }
        else {

            // Clear existing information
            session.userData = {};

            // Get address 
            builder.Prompts.text(session, 'I\'ll need a bit of information. \n To start, what is your full address?');

        }

    },
    function (session, results, next) {

        // Store address
        if (results.response !== null) {
            session.userData.address = results.response;
        }

        // Check if voter info is already known
        if (session.userData.voterInfo) {
            next();
        }
        else {

            // Get Voter Information
            getVoterInfo(session.userData.address)
                .then(function (voterInfo) {

                    // Store voter information
                    session.userData.voterInfo = voterInfo;
                    console.log(`Stored Voter Information`);

                    // Notify user 
                    session.send(`Thanks! I located your voter information`);
                    next();

                })
                .catch(function (error) {

                    session.userData = {};
                    session.endDialog(`Sorry, but I had a problem locating that address. Let's try again.`)

                });

        }

    },

    function (session, results, next) {

        // Create a message card to return to user
        buildMessage(session).then(function () {

            session.endDialog('Enjoy those candidates!');

        });

    }

];

function getVoterInfo(address) {

    return new Promise((resolve, reject) => {

        let url = `https://www.googleapis.com/civicinfo/v2/voterinfo?key=${process.env.GOOGLE_API_KEY}&address=${address}`;

        // Query the Google Civic Information API 
        request(url, { json: true }, function (error, response, body) {

            if (body.error) reject(error);

            console.log(`Retrieved Voter Information`);
            resolve(body);

        });

    });

}

function buildMessage(session) {

    return new Promise((resolve, reject) => {

        var cardsArray = [];
        var referendumsArray = [];

        // Loop through the voteInfo to build out a message per each contest
        session.userData.voterInfo.contests.forEach(function (contest, i) {

            // Describe the contest
            session.send();

            // Check if contest has candidates
            if (contest.candidates) {

                // Loop through each candidate for the contest and build a card
                contest.candidates.forEach(function (candidate, j) {

                    var card = new builder.HeroCard(session)
                        .title(candidate.name)
                        .subtitle(candidate.party);

                    cardsArray.push(card);

                });

                // Create a message
                var message = new builder.Message(session).text(`${contest.office} - vote for ${contest.numberVotingFor}`).attachmentLayout(builder.AttachmentLayout.carousel).attachments(cardsArray);
                session.send(message);

            }

            // Check if contest is a referendum
            if (contest.type === 'Referendum' || contest.type === 'General Referenda') {

                // Create card for the referendum
                var card = new builder.HeroCard(session)
                    .title(contest.referendumTitle)
                    .subtitle(contest.referendumPassageThreshold)
                    .text(contest.referendumText);

                referendumsArray.push(card);

            }

            // Empty array for next contest
            cardsArray = [];

        });

        // Send Referendum message
        var message = new builder.Message(session).text(`Referendums`).attachmentLayout(builder.AttachmentLayout.carousel).attachments(referendumsArray);
        session.send(message);

        // Resolve message
        resolve();

    });

}

function generateStaticMap(startAddress, endAddress) {

    // Given two addresses, generate the URL for a Bing Maps Static Map image
    // https://msdn.microsoft.com/en-us/library/ff701724.aspx
    return `http://dev.virtualearth.net/REST/v1/Imagery/Map/Road/Routes?wp.0=${encodeURI(startAddress)};64;1&wp.1=${encodeURI(endAddress)};66;2&key=${process.env.BING_MAPS_API_KEY}`;

}

function getFullAddress(locationObject) {

    // Take a location object and create a simplified address string
    // Removed the locationName string, and only focused on line1
    return `${locationObject.address.line1} ${locationObject.address.city} ${locationObject.address.state} ${locationObject.address.zip}`;

}