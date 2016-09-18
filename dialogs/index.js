var fs = require('fs');
var builder = require('botbuilder');

module.exports = (bot) => {

    bot.dialog('/', [
        function (session) {

            // Send a greeting and show help.
            var card = new builder.HeroCard(session)
                .title("Votie")
                .text("Howdy! I'm Votie, a bot made to help making voting easier for you! I know all about voting in North Carolina");

            var msg = new builder.Message(session).attachments([card]);
            session.send(msg);
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

    // Dynamically load all dialogs from folder
    fs.readdir(__dirname, function (err, files) {

        // Loop through each dialog
        files.forEach(function (filename, i) {

            // Skip the index.js file (this file)
            if (filename === 'index.js') {
                // Skip index.js
            }
            else {

                // Save filename without extension
                filenameRaw = filename.split('.')[0];

                // Configure dialog
                bot.dialog('/' + filenameRaw, require(__dirname + '/' + filename));

            }

        });

    });

};