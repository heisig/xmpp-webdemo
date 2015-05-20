$(function () {

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
        var jid = $('.name').val();
        var password = $('.password').val();
        stanzaCreateClient(jid, password);
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
});

var users = [
    {"jid": "stanzaio@localhost", local: "stanzaio", "password": "stanza"},
    {"jid": "xmppftw@localhost", local: "xmppftw", "password": "xmppftw"},
    {"jid": "strophejs@localhost", local: "strophejs", "password": "strophejs"}
];

var receiver;

var fillLogin = function (jid, password) {
    $('.name').val(jid);
    $('.password').val(password);
};


var fillUserList = function (ownJid) {
    $.each(users, function (index, user) {
        if (ownJid != user.jid) {
            var buttonGroup = getButtonGroup(user);
            $('.friend-list').append(buttonGroup);
            var chatWindow = getChatWindow(user);
            $('.chat-windows').append(chatWindow);
        }
    });
};

var clearUserList = function () {
    $('.friend-list').empty();
};

var getButtonGroup = function (user) {
    var buttonGroup = '<li id="friend-' + user.local + '" class="list-group-item friend clearfix">' + user.local +
        ' <div class="btn-group user right" role="group">' +
        '<button type="button" class="btn btn-success btn-open-chat" ' +
        'onclick="openChat(\'' + user.jid + '\',\'' + user.local + '\')">open chat</button>' +
        '</div></li>';

    return buttonGroup;
};

var getChatWindow = function (user) {
    var chatWindow = '<div id="chat-window-' + user.local + '" class="panel panel-default chat-window hidden">' +
        '<div class="panel-heading">Chat with ' + user.local + '</div>' +
        '<div class="panel-body chat"><ul class="chat-messages"></ul>' +
        '</div><div class="panel-footer">' +
        '<div class="input-group">' +
        '<input class="form-control custom-control message-text text" placeholder="Your Message"/>' +
        '<span class="input-group-addon btn btn-default btn-send" ' +
        'onclick="sendMessage(\'' + user.jid + '\',\'' + user.local + '\')">Send</span></div></div></div>'

    return chatWindow;
};

var openChat = function (jid, local) {
    console.log('open Chat: ' + jid + ' ' + local);
    $('.friend').removeClass('active');
    $('#friend-' + local).addClass('active');
    $('.chat-window').addClass('hidden');
    $('#chat-window-' + local).removeClass('hidden');
};

var sendMessage = function (jid, local) {
    var message = $('#chat-window-' + local + ' .message-text').val();
    stanzaSendMessage(message, jid);
};

var addChatMessage = function (message, own) {
    console.log('add Chat Message');
    console.dir(message);
    console.log('own Message: ' + own);
    var windowId;
    if (own) {
        windowId = message.to.local;
        $('#chat-window-' + windowId + ' .chat-messages').append('<li class="chat-message own">' +
            '<span class="text">' + message.body + '</span></li>');
    } else {
        windowId = message.from.local;
        $('#chat-window-' + windowId + ' .chat-messages').append('<li class="chat-message">' +
            '<span class="text">' + message.body + '</span></li>');
    }
};