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

            if (body.error) reject(body.error);

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

            if (i < 10) {

                // Check if contest has candidates
                if (contest.candidates) {

                    // First card in the carousel is a description of the contest
                    var card = new builder.HeroCard(session)
                        .title(contest.office)
                        .subtitle(`Vote for ${contest.numberVotingFor}`);
                    cardsArray.push(card);

                    // Loop through each candidate for the contest and build a card
                    contest.candidates.forEach(function (candidate, j) {

                        var card = new builder.HeroCard(session)
                            .title(candidate.name)
                            .subtitle(candidate.party);
                        cardsArray.push(card);

                    });

                    // Create a message
                    //var message = new builder.Message(session).text(`${contest.office} - vote for ${contest.numberVotingFor}`).attachmentLayout(builder.AttachmentLayout.carousel).attachments(cardsArray);
                    var message = new builder.Message(session).attachmentLayout(builder.AttachmentLayout.carousel).attachments(cardsArray);
                    session.send(message);

                }

                // Check if contest is a referendum
                if (contest.type === `Referendum` || contest.type === `General Referenda`) {

                    // First card in the carousel is a description of the referendum
                    var card = new builder.HeroCard(session)
                        .title(`Referendums`)
                    cardsArray.push(card);

                    // Create card for the referendum
                    var card = new builder.HeroCard(session)
                        .title(contest.referendumTitle)
                        .subtitle(contest.referendumPassageThreshold)
                        .text(contest.referendumText);

                    referendumsArray.push(card);

                }

                // Empty array for next contest
                cardsArray = [];

            }

        });

        // Send any Referendums in a single message
        if (referendumsArray.length > 0) {
            var message = new builder.Message(session).attachmentLayout(builder.AttachmentLayout.carousel).attachments(referendumsArray);
            session.send(message);
        }

        // Resolve message
        resolve();

    });

}