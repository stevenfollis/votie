module.exports = (session) => {

    // Reset user data
    session.userData = null;
    session.endDialog();

};