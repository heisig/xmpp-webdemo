/**
 * Class that serves as api for Stanza IO
 */

var strophe = {
    debugMode: true,
    client: {},
    createClient: function (jid, password) {
        this.client = new Strophe.Connection('ws://localhost:5280/xmpp-websocket');
        this.client.connect(jid, password, strophe.connectionCallback);
    },
    disconnectClient: function(){
      this.client.disconnect('disconnected by client');
    },
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
    getBareJid: function (jid) {
        return jid.split('/')[0];
    },
    getLocalJid: function (jid) {
        return jid.split('@')[0];
    },
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
