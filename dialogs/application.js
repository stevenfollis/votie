var builder = require('botbuilder');

module.exports = (session) => {

    session.send('Please see Rock the Vote @ https://www.rockthevote.com/register-to-vote/ for information on registering in your state');
    session.beginDialog('/menu');

};