var builder = require('botbuilder');
var request = require('request');
var cheerio = require('cheerio');
var addressit = require('addressit');
var appInsights = require('../config/appInsights.js');
var _ = require('lodash');

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
        if (session.userData.address) {
            next();
        }
        else {

            // Prompt for first name
            builder.Prompts.text(session, 'I\'ll need a bit of information. \n To start, what is your full address?');

        }

    },
    function (session, results, next) {

        // Store address
        if (results.response !== null) {
            session.userData.address = results.response;
        }

        // Check if last name is already known
        if (session.userData.voterInfo) {
            next();
        }
        else {

            // Get Voter Information
            getVoterInfo(session.userData.address).then(function (voterInfo) {

                // Store voter information
                session.userData.voterInfo = voterInfo;
                console.log(`Stored Voter Information`);

                // Notify user 
                session.send(`Thanks! I located your voter information`);
                next();

            });

        }

    },

    function (session, results, next) {

        // Create a message card to return to user
        buildMessage(session).then(function (message) {

            session.endDialog(message);

        });

    }

];

function getVoterInfo(address) {

    return new Promise((resolve, reject) => {

        let url = `https://www.googleapis.com/civicinfo/v2/voterinfo?key=${process.env.GOOGLE_API_KEY}&address=${address}`;

        // Query the Google Civic Information API 
        request(url, function (error, response, body) {

            if (error) reject(error);

            console.log(`Retrieved Voter Information`);
            resolve(JSON.parse(body));

        });

    });

}

function buildMessage(session) {

    return new Promise((resolve, reject) => {

        // Define an array to holder message attachments
        var cardsArray = [];

        // Polling Locations is returned as an array
        // There may be multiple polling locations
        // Loop through the locations and build messages

        var locations = session.userData.voterInfo.pollingLocations;
        locations.forEach((location, i) => {

            location.address.fullAddress = getFullAddress(location);

            var card = new builder.HeroCard(session)
                .title(`${location.address.locationName} (${location.notes})`)
                .subtitle(`Hours: ${location.pollingHours}`)
                .text(location.address.fullAddress)
                .images([
                    builder.CardImage.create(session, generateStaticMap(session.userData.address, location.address.fullAddress))
                ])
                .tap(builder.CardAction.openUrl(session, `http://bing.com/maps/default.aspx?rtp=adr.${session.userData.address}~adr.${location.address.fullAddress}`));

            cardsArray.push(card);

        });

        // Create a message
        var message = new builder.Message(session).attachments(cardsArray);

        // Resolve message
        resolve(message);

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