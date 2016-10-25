var builder = require('botbuilder');

module.exports = (session) => {

    var msg = new builder.Message(session)
        .attachments([
            new builder.HeroCard(session)
                .title("Voting Day")
                .subtitle("Tuesday, November 8th 2016 is Voting Day")
                .text('It will be here before you know it! Are you registered?')
                .tap(builder.CardAction.openUrl(session, `https://www.rockthevote.com/register-to-vote`))
        ]);

    session.send(msg);
    session.beginDialog('/menu');

};