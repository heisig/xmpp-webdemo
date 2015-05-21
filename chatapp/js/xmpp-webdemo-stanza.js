/**
 * Class that serves as api for Stanza IO
 */

var debugMode = true;
var client;

var stanzaCreateClient = function (jid, password) {
    client = XMPP.createClient({
        jid: jid,
        password: password,
        wsURL: 'ws://localhost:5280/xmpp-websocket',
        transports: ['websocket']
    });
    initListeners();
    client.connect();
};

var stanzaSendMessage = function (message, receiver) {
    client.sendMessage({
        to: receiver,
        body: message
    });
};

var stanzaSendChatState = function(state, receiver){
    client.sendMessage({
        to: receiver,
        chatState: state
    });
};

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
    client.on('message:sent', function (message) {
        console.log("message sent");
        if(message.body && message.body !== ''){
            addChatMessage(message, true);
        }
    });

    /**
     * On Message received
     */
    client.on('chat', function (message) {
        addChatMessage(message, false);
    });

    /**
     * On Chat State Message received
     */
    client.on('chat:state', function(message){
        toggleChatState(message.chatState);
    });

    /**
     * Log of all xmpp client events
     */
    client.on('*', function (name) {
        if (debugMode) {
            console.log(name);
        }
    });
};