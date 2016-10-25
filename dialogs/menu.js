var builder = require('botbuilder');

module.exports = [
    function (session) {
        builder.Prompts.choice(session, "I can help with lots of tasks! Which of these would you like help with?", "where do i vote?|election date|register|(quit)");
    },
    function (session, results) {
        if (results.response && results.response.entity != '(quit)') {

            // Launch demo dialog
            //session.beginDialog('/' + results.response.entity);
            switch (results.response.entity) {
                case 'where do i vote?':
                    console.log('Starting my registration');
                    session.beginDialog('/location', session.userData.profile);
                    break;
                case 'election date':
                    console.log('Starting election day');
                    session.beginDialog('/electionday');
                    break;
                case 'register':
                    console.log('Starting registration');
                    session.beginDialog('/application')
                    break;
            }

        }
        else {
            // Exit the menu
            session.endDialog('Goodbye! Have a nice day');
        }
    },
    function (session, results) {
        // The menu runs a loop until the user chooses to (quit).
        session.replaceDialog('/menu');
    }
];