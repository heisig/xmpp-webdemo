/**
 * Class that serves as api for Stanza IO
 */

/* Object that encapsulates used functionality of the stanza io framework */
var stanza = {
    debugMode: true,
    client: {},

    /**
     * Function to create a new connection to the websocket and login to the xmpp server.
     * All necessary listeners are registered with initListeners.
     *
     * @param jid
     * @param password
     */
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

    /**
     * Function to sent messages.
     *
     * @param message
     * @param receiver
     */
    sendMessage: function (message, receiver) {
        this.client.sendMessage({
            to: receiver,
            body: message
        });
    },

    /**
     * Function to send chat state messages.
     *
     * @param state
     * @param receiver
     */
    sendChatState: function (state, receiver) {
        this.client.sendMessage({
            to: receiver,
            chatState: state
        });
    },

    /**
     * Function to disconnect from the websocket
     */
    disconnectClient: function(){
      this.client.disconnect();
    },

    /**
     * Function to register all necessary handlers.
     */
    initListeners: function() {
        /**
         * On a successful connect show the connected label and logout button in the navbar
         */
        this.client.on('connected', function () {
            $('.login').hide();
            $('.connected').show();
        });

        /**
         *  If the Session was started successfully get the roster and fill the friendlist.
         */
        this.client.on('session:started', function () {
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
         * On Message sent add the message to the chat window
         */
        this.client.on('message:sent', function (message) {
            if (message.body && message.body !== '') {
                addChatMessage(message, true);
            }
        });

        /**
         * On Message received add the received message to the chat window
         */
        this.client.on('chat', function (message) {
            addChatMessage(message, false);
        });

        /**
         * On Chat State Message received toggle the composing label
         */
        this.client.on('chat:state', function (message) {
            toggleChatState(message);
        });

        /**
         * Log of all xmpp client events if the debug flag is true
         */
        this.client.on('*', function (name) {
            if (this.debugMode) {
                console.log(name);
            }
        });
    }
};
