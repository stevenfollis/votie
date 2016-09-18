var builder = require('botbuilder');

module.exports = (session) => {

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

};