/**
 * Class that serves as api for Stanza IO
 */

var stanza = {
    debugMode: true,
    client: {},
    createClient: function (jid, password) {
        this.client = XMPP.createClient({
            jid: jid,
            password: password,
            wsURL: 'ws://localhost:5280/xmpp-websocket',
            transports: ['websocket']
        });
        this.initListeners();
        this.client.connect();
    },
    sendMessage: function (message, receiver) {
        this.client.sendMessage({
            to: receiver,
            body: message
        });
    },
    sendChatState: function (state, receiver) {
        this.client.sendMessage({
            to: receiver,
            chatState: state
        });
    },
    disconnectClient: function(){
      this.client.disconnect();
    },
    initListeners: function() {
        /**
         * On Connected change Login Bar
         */
        this.client.on('connected', function () {
            $('.login').hide();
            $('.connected').show();
        });

        /**
         *  Session Started Handling
         */
        this.client.on('session:started', function () {
            //stanza.client.subscribe("stanzaio@localhost");
            //stanza.client.subscribe("xmppftw@localhost");
            //stanza.client.subscribe("strophejs@localhost");
            //stanza.client.acceptSubscription("stanzaio@localhost");
            //stanza.client.acceptSubscription("xmppftw@localhost");
            //stanza.client.acceptSubscription("strophejs@localhost");

            stanza.client.getRoster(function (err, response) {
                stanza.client.updateCaps();
                stanza.client.sendPresence({
                    caps: stanza.client.disco.caps
                });
                if (err == null) {
                    var ownJid = response.to.bare;
                    var roster = response.roster.items;
                    var friends = [];
                    $.each(roster, function (index, item) {
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
         * On Message sent to friend
         */
        this.client.on('message:sent', function (message) {
            if (message.body && message.body !== '') {
                addChatMessage(message, true);
            }
        });

        /**
         * On Message received
         */
        this.client.on('chat', function (message) {
            addChatMessage(message, false);
        });

        /**
         * On Chat State Message received
         */
        this.client.on('chat:state', function (message) {
            toggleChatState(message);
        });

        /**
         * Log of all xmpp client events
         */
        this.client.on('*', function (name) {
            if (this.debugMode) {
                console.log(name);
            }
        });
    }
};
