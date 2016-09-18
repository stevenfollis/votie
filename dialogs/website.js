var builder = require('botbuilder');

module.exports = (session) => {

    session.send('Please visit the offical election website at http://charmeck.org/mecklenburg/county/BOE/Pages/default.aspx. Thanks!');
    session.beginDialog('/menu');

};