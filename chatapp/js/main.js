var timeout = 2000;
var timer;
var typing = false;
var currentFramework = null;
var receiver;

/* local array of registered users which is used to build the friendslist
 (theoretically roster information could be used here too) */
var users = [
    {"jid": "stanzaio@localhost", local: "stanzaio", "password": "stanza"},
    {"jid": "xmppftw@localhost", local: "xmppftw", "password": "xmppftw"},
    {"jid": "strophejs@localhost", local: "strophejs", "password": "strophejs"}
];

/* Register Listeners when document is ready */
$(function () {

    var loginBtn = $('.btn-login');
    var logoutBtn = $('.btn-logout');
    $('.connected').hide();


    /**
     * Login Button Listener
     */
    loginBtn.on('click', function (e) {
        if (e.preventDefault()) {
            e.preventDefault();
        }
        // get the values from the input fields with jquery
        var jid = $('.name').val();
        var password = $('.password').val();

        // set the current framework based on which user logged into the system
        if(jid === 'stanzaio@localhost'){
            currentFramework = stanza;
        } else if(jid === 'strophejs@localhost'){
            currentFramework = strophe;
        } else if(jid === 'xmppftw@localhost'){
            currentFramework = stanza;
        }
        // create the connection to the websocket and trigger the login function
        currentFramework.createClient(jid, password);
    });

    /**
     * Logout Button Listener
     */
    logoutBtn.on('click', function () {
        currentFramework.disconnectClient();
        $('.login').show();
        $('.connected').hide();
        clearUserList();
        $('.chat-windows').empty();

    });
});

/**
 * comfort function to allow autofill of the login fields via user labels
 *
 * @param jid
 * @param password
 */
var fillLogin = function (jid, password) {
    $('.name').val(jid);
    $('.password').val(password);
};

/**
 * function that creates the entries of the user list based on the users array and appends them in the html
 * It also generates the chat windows for each user in the friend list
 * 3 Listeners are registered
 *
 * @param ownJid
 */
var fillUserList = function (ownJid) {
    // iterate over all users and filter out own entry
    $.each(users, function (index, user) {
        if (ownJid != user.jid) {
            // generate friendlist entry and chat window for current user
            var buttonGroup = getButtonGroup(user);
            $('.friend-list').append(buttonGroup);
            var chatWindow = getChatWindow(user);
            $('.chat-windows').append(chatWindow);
            // register necessary listeners
            $('#friend-' + user.local + ' .btn-open-chat').on('click', user, openChat);
            $('#chat-window-' + user.local + ' .btn-send').on('click', user, sendMessage);
            $('#chat-window-' + user.local + ' .message-text').bind('keypress', user, messageTextFieldKeyPress);
        }
    });
    // hide composing label
    $('.typing').hide();
};

/**
 * Function to remove all entries from the friend list (used on logout)
 */
var clearUserList = function () {
    $('.friend-list').empty();
};

/**
 * Function that serves the html for a friend list entry. It fills in the username.
 *
 * @param user
 * @returns {string}
 */
var getButtonGroup = function (user) {
    var buttonGroup = '<li id="friend-' + user.local + '" class="list-group-item friend clearfix">' + user.local +
        ' <div class="btn-group user right" role="group">' +
        '<button type="button" class="btn btn-success btn-open-chat">open chat</button>' +
        '</div></li>';

    return buttonGroup;
};

/**
 * Function that serves the html for a chat window for a user. It fills in the username.
 *
 * @param user
 * @returns {string}
 */
var getChatWindow = function (user) {
    var chatWindow = '<div id="chat-window-' + user.local + '" class="panel panel-default chat-window hidden">' +
        '<div class="panel-heading">Chat with ' + user.local + '</div>' +
        '<div class="panel-body chat"><ul class="chat-messages"></ul>' +
        '</div><div class="panel-footer">' +
        '<div class="typing"><span class="label label-default">' + user.local +  ' is typing</span></div>' +
        '<div class="input-group">' +
        '<input class="form-control custom-control message-text text" type="text" placeholder="Your Message"/>' +
        '<span class="input-group-addon btn btn-default btn-send">Send</span></div></div></div>';

    return chatWindow;
};

/**
 * Function that opens a chat window after the respective button in the friendlist was cicked.
 * It sets the active state of the connected friend list entry.
 *
 * @param event
 */
var openChat = function (event) {
    var user = event.data;
    $('.friend').removeClass('active');
    $('#friend-' + user.local).addClass('active');
    $('.chat-window').addClass('hidden');
    $('#chat-window-' + user.local).removeClass('hidden');
};

/**
 * Function that is triggered when a key is pressed in the chat windows input field.
 * If enter was pressed the messages is sent and the composing state is set to paused.
 * Otherwise the composing state is set with a given timeout (var timeout).
 *
 * @param event
 */
var messageTextFieldKeyPress = function(event){
    var code = event.keyCode || event.which;
    var user = event.data;
    if(code == 13) {
        // if enter is pressed resets timeout and sends message
        clearTimeout(timer);
        currentFramework.sendChatState('paused', user.jid);
        sendMessage(event);
        typing = false;
    } else {
        // otherwise timeout is reset and composing state is sent
        clearTimeout(timer);

        timer = setTimeout(function(){
            currentFramework.sendChatState('paused', user.jid);
            typing = false;
        }, timeout);

        if (!typing){
            currentFramework.sendChatState('composing', user.jid);
            typing = true;
        }
    }
};

/**
 * The function greps the entered message and triggers the frameworks send message method.
 * Afterwards the message input field is emptied.
 *
 * @param event
 */
var sendMessage = function (event) {
    var user = event.data;
    var messageTextField = $('#chat-window-' + user.local + ' .message-text');
    var message = messageTextField.val();
    currentFramework.sendMessage(message, user.jid);
    messageTextField.val('');
};

/**
 * Function that adds chat messages to the chat window separating own messages from received ones.
 *
 * @param message
 * @param own
 */
var addChatMessage = function (message, own) {
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

/**
 * Function to show and hide the composing label if the other chat party is typing.
 *
 * @param message
 */
var toggleChatState = function(message){
    var state = message.chatState;
    var local = message.from.local;
    if(state === 'composing'){
        $('#chat-window-' + local + ' .typing').show();
    } else if (state === 'paused'){
        $('#chat-window-' + local + ' .typing').hide();
    }
};