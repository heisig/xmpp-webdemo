/**
 * Class that serves as api for Stanza IO
 */

$(function () {

    var debugMode = true;
    true;
    var client;
    var loginBtn = $('.btn-login');
    var logoutBtn = $('.btn-logout');
    var sendBtn = $('.btn-send');
    $('.connected').hide();

    /**
     * Login and Connect
     */
    loginBtn.on('click', function (e) {
        if (e.preventDefault()) {
            e.preventDefault();
        }
        var jid = $('.name').val();
        client = XMPP.createClient({
            jid: jid,
            password: $('.password').val(),
            wsURL: 'ws://localhost:5280/xmpp-websocket',
            transports: ['websocket']
        });
        initListeners();
        client.connect();
    });

    /**
     * Disconnect and Logout
     */
    logoutBtn.on('click', function () {
        client.disconnect();
        $('.login').show();
        $('.connected').hide();
        clearUserList();
    });

    sendBtn.on('click', function () {
        var message = $('.message-text').val();
        client.sendMessage({
            to: receiver,
            body: message
        });
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
            client.subscribe("xmppftw@localhost");
            client.getRoster(function (err, response) {
                client.updateCaps();
                client.sendPresence({
                    caps: client.disco.caps
                });
                if (err == null) {
                    console.dir(response);
                    var ownJid = response.to.bare;
                    var roster = response.roster.items;
                    var friends = [];
                    $.each(roster, function(index, item){
                        var friend = {};
                        friend.jid = item.jid.bare;
                        friend.local = item.jid.local;
                        friend.subscription = item.subscription;
                        friend.subscriptionRequested = item.subscriptionRequested;
                        friends.push();
                    });
                    fillUserList(ownJid);
                }
            });
        });

        /**
         * Send Message and print to chat
         */
        client.on('message', function (message) {
            console.log(message);
            $('.chat-messages').append("<li class=\"chat-message own\">" + message + "</li>");
        });

        /**
         * On Message sent
         */
        client.on('message:sent', function (message) {
            console.log(message);
        });

        /**
         * On Chat partner is composing
         */
        client.on('chat:state', function () {

        });

        /**
         * On Message received
         */
        client.on('chat', function (message) {

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