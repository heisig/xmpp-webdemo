/**
 * Class that serves as api for Stanza IO
 */

$(function () {

    var debugMode = true;
    true;
    var client;
    var loginBtn = $('.btn-login');
    var logoutBtn = $('.btn-logout');
    $('.connected').hide();

    /**
     * Login and Connect
     */
    loginBtn.on('click', function (e) {
        if (e.preventDefault()) {
            e.preventDefault();
        }

        client = XMPP.createClient({
            jid: $('.name').val(),
            password: $('.password').val(),
            wsURL: 'ws://localhost:5280/xmpp-websocket',
            transports: ['websocket']
        });
        initListeners();
        client.connect();
        return false;
    });

    /**
     * Disconnect and Logout
     */
    logoutBtn.on('click', function () {
        client.disconnect();
        $('.login').show();
        $('.connected').hide();
    });

    function initListeners() {
        /**
         * On Connected change Login Bar
         */
        client.on('connected', function () {
            $('.login').hide();
            $('.connected').show();
        });

        /**
         *  Session Started Handling
         */
        client.on('session:started', function () {
            client.enableCarbons(function (err) {
                if (err) {
                    console.log('Server does not support carbons');
                }
            });
            client.getRoster(function (err, resp) {
                client.updateCaps();
                client.sendPresence({
                    caps: client.disco.caps
                });
            });
        });

        /**
         * Log of all xmpp client events
         */
        client.on('*', function (name) {
            if (debugMode) {
                console.log(name);
            }
        });
    }
});