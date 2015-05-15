/**
 * Created by rstarke on 11.05.15.
 */

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
    $.each(users, function(index, user){
        if(ownJid != user.jid){
            var buttonGroup = getButtonGroup(user);
            $('.friend-list').append(buttonGroup);
        }
    });
};

var clearUserList = function(){
  $('.friend-list').empty();
};

var getButtonGroup = function(user){
   var buttonGroup =  '<li id="user.local" class="list-group-item clearfix">' + user.local +
       ' <div class="btn-group user right" role="group">' +
       '<button type="button" class="btn btn-success btn-open-chat" onclick="openChat(\'' + user.jid + '\');">open chat</button>' +
       '</div></li>';

    return buttonGroup;
};

var openChat = function(jid){
    receiver = jid;
    $('.chat-window .panel-heading').html('Chat with ' + jid);
};