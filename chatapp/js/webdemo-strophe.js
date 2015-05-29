/**
 * Class that serves as api for Strophe JS
 */

/* Object that encapsulates used functionality of the strophe framework */
var strophe = {
    debugMode: true,
    client: {},

    /**
     * Function to create a new connection to the websocket and login to the xmpp server.
     *
     * @param jid
     * @param password
     */
    createClient: function (jid, password) {
        this.client = new Strophe.Connection('ws://localhost:5280/xmpp-websocket');
        this.client.connect(jid, password, strophe.connectionCallback);
    },

    /**
     * Function to disconnect the client from the socket
     */
    disconnectClient: function(){
      this.client.disconnect('disconnected by client');
    },

    /**
     * Handler that is triggered when the client tries to connect to the websocket.
     * If the connection was successful the roster is requested and the message callbacks are registered.
     *
     * @param status
     */
    connectionCallback: function (status) {
        if (status === Strophe.Status.CONNECTED) {
            $('.login').hide();
            $('.connected').show();
            strophe.client.roster.requestRoster(strophe.rosterCallback);
            Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
            strophe.client.addHandler(strophe.onMessageHandler, null, 'message');
            strophe.client.addHandler(strophe.onChatStateHandler, Strophe.NS.CHATSTATES, 'message');
            strophe.client.send($pres());
        }
    },

    /**
     * Handler that is triggered when the roster is received.
     * It creates a list of friends from the given roster that is filled in the userlist.
     *
     * @param roster
     */
    rosterCallback: function (roster) {
        var items = roster.getItems();
        var friends = [];
        $.each(items, function (index, item) {
            var friend = {};
            friend.jid = item.jid;
            friend.local = strophe.getLocalJid(item.jid);
            friend.subscription = item.subscription;
            friend.subscriptionRequested = item.ask;
            friends.push();
        });
        fillUserList(strophe.client.authzid);
    },

    /**
     * Function to create and sent messages.
     * It uses the Strophe Builder $msg to build a valid xml message.
     *
     * @param message
     * @param receiver
     */
    sendMessage: function (message, receiver) {
        var reply = $msg({to: receiver, type: "chat"})
            .c("body")
            .t(message);
        strophe.client.send(reply.tree());
        var messageObject = {
            to: {
                jid: receiver,
                local: strophe.getLocalJid(receiver)
            },
            body: message
        };
        addChatMessage(messageObject, true);
    },

    /**
     * Function to create and send chat state messages.
     * It uses the Strophe Builder $msg to build a valid xml message.
     *
     * @param state
     * @param receiver
     */
    sendChatState: function (state, receiver) {
        if(state === 'composing' || state === 'paused'){
            var msg = $msg({to: receiver, type: 'chat'});
            if(state === 'composing'){
                msg.c('composing', {xmlns: Strophe.NS.CHATSTATES});
            }
            if(state === 'paused'){
                msg.c('paused', {xmlns: Strophe.NS.CHATSTATES});
            }
            strophe.client.send(msg.tree());
        }
    },

    /**
     * Function to extract the bare jid from a given full jid
     *
     * @param jid
     * @returns {string}
     */
    getBareJid: function (jid) {
        return jid.split('/')[0];
    },

    /**
     * Function to extract the local part from a given jid
     *
     * @param jid
     * @returns {string}
     */
    getLocalJid: function (jid) {
        return jid.split('@')[0];
    },

    /**
     * Function that handles the incoming of messages. It checks the text content to separate actual chat messages.
     * The content and the from attribute are read and sent to the addChatMessage method.
     *
     * @param xml
     * @returns true to ensures that the handler stays active
     */
    onMessageHandler: function (xml) {
        if (xml.textContent && xml.textContent !== "") {
            var from = xml.getAttribute('from');

            var jid = strophe.getBareJid(from);
            var local = strophe.getLocalJid(jid);
            var messageObject = {
                from: {
                    jid: jid,
                    local: local
                },
                body: xml.textContent
            };
            addChatMessage(messageObject);
        }
        return true;
    },

    /**
     * Function that handles the incoming of chat state messages and triggers the toggleChatState method.
     * The state is extracted from the xml.
     *
     * @param xml
     * @returns true to ensures that the handler stays active
     */
    onChatStateHandler: function (xml) {
        var composing = xml.getElementsByTagName('composing');
        var paused = xml.getElementsByTagName('paused');

        console.dir(composing);
        console.dir(paused);

        if (composing.length > 0 || paused.length > 0) {

            var from = xml.getAttribute('from');
            var jid = strophe.getBareJid(from);
            var local = strophe.getLocalJid(jid);
            var message = {
                from: {
                    jid: jid,
                    local: local
                }
            };

            if (composing.length > 0) {
                message.chatState = 'composing';
            } else if (paused.length > 0) {
                message.chatState = 'paused';
            }
            toggleChatState(message);
        }
        return true;
    }
};
