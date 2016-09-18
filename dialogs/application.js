var builder = require('botbuilder');

module.exports = (session) => {

    session.send('Please see the offical NC Voter Registration Application at http://www.ncsbe.gov/ncsbe/Portals/0/FilesP/NCVRRegFormv102013eng.pdf. Thanks!');
    session.beginDialog('/menu');

};