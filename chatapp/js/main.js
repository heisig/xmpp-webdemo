var timeout = 4000;
var timer;
var typing = false;

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
        $('.chat-window').addClass('hidden');
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
            $('#friend-' + user.local + ' .btn-open-chat').on('click', user, openChat);
            $('#chat-window-' + user.local + ' .btn-send').on('click', user, sendMessage);
            $('#chat-window-' + user.local + ' .message-text').bind('keypress', user, messageTextFieldKeyPress);
        }
    });
};

var clearUserList = function () {
    $('.friend-list').empty();
};

var getButtonGroup = function (user) {
    var buttonGroup = '<li id="friend-' + user.local + '" class="list-group-item friend clearfix">' + user.local +
        ' <div class="btn-group user right" role="group">' +
        '<button type="button" class="btn btn-success btn-open-chat">open chat</button>' +
        '</div></li>';

    return buttonGroup;
};

var getChatWindow = function (user) {
    var chatWindow = '<div id="chat-window-' + user.local + '" class="panel panel-default chat-window hidden">' +
        '<div class="panel-heading">Chat with ' + user.local + '</div>' +
        '<div class="panel-body chat"><ul class="chat-messages"></ul>' +
        '</div><div class="panel-footer">' +
        '<div class="input-group">' +
        '<input class="form-control custom-control message-text text" type="text" placeholder="Your Message"/>' +
        '<span class="input-group-addon btn btn-default btn-send">Send</span></div></div></div>'

    return chatWindow;
};

var openChat = function (event) {
    var user = event.data;
    console.log('open Chat: ' + user.jid + ' ' + user.local);
    $('.friend').removeClass('active');
    $('#friend-' + user.local).addClass('active');
    $('.chat-window').addClass('hidden');
    $('#chat-window-' + user.local).removeClass('hidden');
};

var messageTextFieldKeyPress = function(event){
    var code = event.keyCode || event.which;
    if(code == 13) {
        sendMessage(event);
        stanzaSendChatState('paused', user.jid);
        typing = false;
    } else {
        var user = event.data;

        clearTimeout(timer);

        timer = setTimeout(function(){
            stanzaSendChatState('paused', user.jid);
            typing = false;
        }, timeout);

        if (!typing){
            stanzaSendChatState('composing', user.jid);
            typing = true;
        }
    }
};

var sendMessage = function (event) {
    var user = event.data;
    var messageTextField = $('#chat-window-' + user.local + ' .message-text');
    var message = messageTextField.val();
    stanzaSendMessage(message, user.jid);
    messageTextField.val('');
};

var addChatMessage = function (message, own) {
    console.log('message: ');
    console.dir(message);
    console.log("own: " + own);
    var windowId;
    if (own) {
        windowId = message.to.local;
        var chatMessages = $('#chat-window-' + windowId + ' .chat-messages');
        var chatMessageElements = $('#chat-window-' + windowId + ' .chat-messages li');
        if(chatMessageElements.last().hasClass('own')){
            chatMessageElements.last().find('.message-container').append('<span class="text">' + message.body + '</span>');
        } else {
         chatMessages.append('<li class="chat-message own"><div class="message-container">' +
             '<span class="text">' + message.body + '</span></div></li>');
        }
    } else {
        windowId = message.from.local;
        var chatMessages = $('#chat-window-' + windowId + ' .chat-messages');
        var chatMessageElements = $('#chat-window-' + windowId + ' .chat-messages li');
        if(chatMessageElements.last().length > 0 && !chatMessageElements.last().hasClass('own')){
            chatMessageElements.last().find('.message-container').append('<span class="text">' + message.body + '</span>');
        } else {
            chatMessages.append('<li class="chat-message"><div class="message-container">' +
                '<span class="text">' + message.body + '</span></div></li>');
        }
    }
};

var toggleChatState = function(state){
    if(state === 'composing'){
        console.log('#################### composing');
    } else if (state === 'paused'){
        console.log('#################### paused');
    }
};