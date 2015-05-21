/* @flow */
'use strict';

var Xmpp = function(socket) {
    this.socket    = socket
    this.tracking  = []
    this.logger    = null
    
    this.error = errors
    
    this.listeners = [
        new Roster(),
        new Presence(),
        new Chat()
    ]
    this.client = false
    this.registerSocketEvents()
}

// Xmpp.prototype = new events.EventEmitter()

Xmpp.prototype.MISSING_STANZA_ID = 'Missing stanza ID'
Xmpp.prototype.MISSING_CALLBACK  = 'Missing callback'
Xmpp.prototype.INVALID_CALLBACK  = 'Invalid callback'

Xmpp.prototype.REGISTRATION_ERROR   = 'Registration error'
Xmpp.prototype.AUTHENTICATION_ERROR = 'XMPP authentication failure'

Xmpp.prototype.clearListeners = function() {
    this.listeners = []
}

Xmpp.prototype.addListener = function(listener) {
    if (this.client) listener.init(this)
    this.listeners.unshift(listener)
}

Xmpp.prototype.registerXmppEvents = function() {
    var self = this
    this.client.on('error', function(error) { self.handleError(error) })
    this.client.on('online', function(data) {
        self.jid = data.jid.user + '@' +
            data.jid.domain + '/' + data.jid.resource
        self.fullJid = new JID(self.jid)
        self.online()
    })
    this.client.on('stanza', function(stanza) { self.handleStanza(stanza) })
    this.client.once('offline', function() {
        self.handleError(self.error.condition.DISCONNECTED)
        self.logout(function() {})
    })
}

Xmpp.prototype.registerSocketEvents = function() {
    var self = this
    this.socket.on('xmpp.login', debounce(function(data) {
        self.logout(function() {})
        self.login(data)
    }, 750, true))
    this.socket.on('xmpp.login.anonymous', debounce(function(data) {
        self.logout(function() {})
        self.anonymousLogin(data)
    }, 750, true))
    this.socket.on('xmpp.logout', function(data, callback) {
        self.logout(callback)
    })
    this.socket.on('end', function() {
        self.logout()
    })
    this.socket.on('disconnect', function() {
        self.logout()
    })
}

Xmpp.prototype.unRegisterSocketEvents = function() {
    if (!this.listeners) return
    this.listeners.forEach(function(listener) {
        listener.unregisterEvents()
    })
}

Xmpp.prototype._initialiseListeners = function() {
    var self = this
    this.listeners.forEach(function(listener) {
        listener.init(self)
    })
}

Xmpp.prototype.logout = function(callback) {
    if (!this.client) return
    this.client.removeAllListeners()
    this.client.end()
    delete this.client
    if (callback) return callback(null, true)
    if (this.socket) this.socket.end()
}

Xmpp.prototype.anonymousLogin = function(data) {
    if (!data.jid) return
    this._getLogger().info('Attempting anonymous connection ' + data.jid)
    if (-1 !== data.jid.indexOf('@'))
        data.jid = data.jid.split('@')[1]
    if (-1 !== data.jid.indexOf('/')) {
        data.resource = data.jid.split('/')[1]
        data.jid      = data.jid.split('/')[0]
    }
    this.jid = data.jid
    var credentials = data
    credentials.jid =  '@' + data.jid
    credentials.preferredSaslMechanism = 'ANONYMOUS'
    if (data.resource) credentials.jid += '/' + data.resource
    if (data.host) credentials.host = data.host
    this._connect(credentials)
}

Xmpp.prototype.login = function(data) {
    this._getLogger().info('Attempting to connect to ' + data.jid)
    if (!data.jid || !data.password)
        return this.socket.send('xmpp.error', {
            type: 'auth',
            condition: 'client-error',
            description: 'Missing jid and/or password',
            request: data
        })

    var jid = data.jid
    var password = data.password
    if (-1 === data.jid.indexOf('@'))
        jid += '@' + data.host
    if (-1 !== jid.indexOf('/')) {
        data.resource = jid.split('/')[1]
        jid           = jid.split('/')[0]
    }
    if (data.resource) {
        jid += '/' + data.resource
        delete data.resource
    }
    var credentials      = data
    credentials.jid      =  jid
    credentials.password =  password
    this._connect(credentials)
}

Xmpp.prototype._connect = function(options) {
    this.jid    = options.jid
    this.client = new Client(options)

    this.client.connection.socket.setTimeout(0)
    this.client.connection.socket.setKeepAlive(true, 10000)

    this.registerXmppEvents()
}

Xmpp.prototype.online = function() {
    this._initialiseListeners()
    this.socket.send(
        'xmpp.connection',
        { status: 'online', jid: this.fullJid }
    )
    this.emit('client:online', { jid: this.fullJid })
}

Xmpp.prototype.handleError = function(error) {
    this._getLogger().error(error)
    var message, type, condition
    if (this.REGISTRATION_ERROR === (error || {}).message) {
        message = this.REGISTRATION_ERROR
        type = this.error.type.AUTH
        condition = this.error.condition.REGISTRATION_FAIL
    } else if (error === this.AUTHENTICATION_ERROR) {
        message = this.error.message.AUTHENTICATION_FAIL
        type = this.error.type.AUTH
        condition = this.error.condition.LOGIN_FAIL
    } else if (error === this.error.condition.DISCONNECTED) {
        message = this.error.message.DISCONNECTED
        type = this.error.type.CONNECTION
        condition = this.error.condition.DISCONNECTED
    } else if (error === this.error.condition.NOT_CONNECTED) {
        message = this.error.message.NOT_CONNECTED
        type = this.error.type.CONNECTION
        condition = this.error.condition.NOT_CONNECTED
    } else {
        message = JSON.stringify(error, function(key, value) {
            if ('parent' === key) {
                if (!value) return value
                return value.id
            }
            return value
        })
    }
    this.socket.send('xmpp.error', {
        type: type || this.error.type.CANCEL,
        condition: condition || this.error.condition.UNKNOWN,
        description: message
    })
}

Xmpp.prototype.trackId = function(id, callback) {
    if (!id)
        throw new Error(this.MISSING_STANZA_ID)
    var jid
    if (typeof id === 'object') {
        if (!id.root().attrs.id)
            throw new Error(this.MISSING_STANZA_ID)
        jid = id.root().attrs.to
        id = id.root().attrs.id
        if (!jid){
            jid = [
                this.getJidType('domain'),
                this.getJidType('bare')
            ]
        } else {
            jid = [ jid ]
        }
    }
    if (!callback)
        throw new Error(this.MISSING_CALLBACK)
    if (typeof callback !== 'function')
        throw new Error(this.INVALID_CALLBACK)
    if (!this.client) {
        return this.handleError(this.error.condition.NOT_CONNECTED)
    }
    this.tracking[id] = { callback: callback, jid: jid }
}

Xmpp.prototype.catchTracked = function(stanza) {
    var id = stanza.root().attr('id')
    if (!id || !this.tracking[id]) return false
    if (this.tracking[id].jid &&
        stanza.attr('from') &&
        (-1 === this.tracking[id].jid.indexOf(stanza.attr('from')))) {
        // Ignore stanza its an ID spoof!
        return true
    }
    var callback = this.tracking[id].callback
    delete this.tracking[id]
    callback(stanza)
    return true
}

Xmpp.prototype.handleStanza = function(stanza) {
    this._getLogger().info('Stanza received: ' + stanza)
    if (this.catchTracked(stanza)) return
    var handled = false
    this.listeners.some(function(listener) {
        if (true === listener.handles(stanza)) {
            handled = true
            if (true === listener.handle(stanza)) return true
        }
    })
    if (!handled) this._getLogger().info('No listeners for: ' + stanza)
}

Xmpp.prototype.getJidType = function(type) {
    switch (type) {
        case 'full':
            return this.fullJid.user + '@' +
                this.fullJid.domain + '/' +
                this.fullJid.resource
        case 'bare':
            return this.fullJid.user + '@' + this.fullJid.domain
        case 'domain':
            return this.fullJid.domain
    }
}

Xmpp.prototype.setLogger = function(logger) {
    this.logger = logger
    return logger
}

Xmpp.prototype._getLogger = function() {
    if (!this.logger) {
        this.logger = {
            log: function() {},
            info: function() {},
            warn: function() {},
            error: function() {}
        }
    }
    return this.logger
}




var Base = function() {
    this.manager = false
    this.socket  = false
    this.client  = false
    this.cache   = null
}

Base.prototype.init = function(manager, ignoreEvents) {
    this.manager = manager
    this.socket  = manager.socket
    this.client  = manager.client
    if (!ignoreEvents) this.registerEvents()
}

Base.prototype.handles = function() {
    return false
}

Base.prototype.handle = function() {
    return false
}

Base.prototype.setCache = function(cache) {
    this.cache = cache
    return this
}

Base.prototype._getCache = function() {
    return this.cache
}

Base.prototype.registerEvents = function() {
    if (!this._events) return
    var self = this
    Object.keys(this._events).forEach(function(event) {
        self.socket.removeAllListeners(event)
        self.socket.on(event, function(data, callback) {
            self[self._events[event]](data, callback)
        })
    })
}

Base.prototype.unregisterEvents = function() {
    if (!this._events) return
    var self = this
    Object.keys(this._events).forEach(function(event) {
        self.socket.removeAllListeners(event)
    })
}

/* Namespaces */
Base.prototype.NS_REGISTER = 'jabber:iq:register'
Base.prototype.NS_DATA     = 'jabber:x:data'

Base.prototype.NS_ERROR    = 'urn:ietf:params:xml:ns:xmpp-stanzas'

Base.prototype._getJid = function(jid) {
    var node   = jid.split('@')[0]
    var domain = jid.split('/')[0]
    if (-1 === jid.indexOf('@')) {
        return { domain: jid }
    }
    if (-1 !== domain.indexOf('@')) {
        domain = domain.split('@')[1]
    }
    var resource = jid.split('/')[1]
    var result = { domain: domain }
    if (node) {
        result.user = node
    }
    if (resource) {
        result.resource = resource
    }
    return result
}

Base.prototype._getId = function() {
    if (!Base.prototype.id) {
        Base.prototype.id = {
            counter: 0
        }
    }
    ++Base.prototype.id.counter
    return uuid.v4()
}

Base.prototype._parseError = function(stanza) {
    var errorElement = stanza.getChild('error')
    var error  = { type: errorElement.attrs.type }
    if (errorElement.attr('by'))  error.by = errorElement.attr('by')
    var errorMessages = stanza.getChild('error').children
    var name
    if (errorMessages) {
        errorMessages.forEach(function(errorMessage) {
            if (errorMessage.getNS() === this.NS_ERROR) {
                name = errorMessage.getName().toLowerCase()
                if ('text' === name) {
                    error.description = errorMessage.getText()
                } else {
                    error.condition = name
                }
            } else {
                error.application = { condition: errorMessage.getName().toLowerCase() }
                if (errorMessage.getNS()) error.application.xmlns = errorMessage.getNS()
                if (errorMessage.getText()) error.application.description = errorMessage.getText()
            }
        }, this)
    }
    return error
}

Base.prototype._clientError = function(message, original, callback) {
    var error = {
        type:        'modify',
        condition:   'client-error',
        description: message,
        request:     original
    }
    if (callback && (typeof callback === 'function'))
        return callback(error)
    this.socket.send('xmpp.error.client', error)
    return false
}

Base.prototype._hasValidCallback = function(callback, data) {
    if (typeof callback !== 'function') {
        return this._clientError(
            'Missing callback', data
        )
    }
}





var Roster = function() {}

Roster.prototype = new Base()

Roster.prototype.NS = 'jabber:iq:roster'

Roster.prototype._events = {
    'xmpp.roster.add': 'add',
    'xmpp.roster.get': 'get',
    'xmpp.roster.edit': 'edit',
    'xmpp.roster.group': 'edit', /* Deprecated */
    'xmpp.roster.remove': 'remove'
}

Roster.prototype.handles = function(stanza) {
    return !!(stanza.is('iq') &&
    (stanza.getChild('query', this.NS)))
}

Roster.prototype.handle = function(stanza) {
    if ('set' === stanza.attr('type'))
        return this.handleRemoteAdd(stanza)
    return false
}

Roster.prototype.get = function(data, callback) {
    if (typeof callback !== 'function')
        return this._clientError('Missing callback')
    var self   = this
    var stanza = new builder.Element(
        'iq',
        { from: this.manager.jid.split('/')[0], type: 'get', id: this._getId() }
    ).c('query', {xmlns: this.NS}).up()

    this.manager.trackId(stanza, function(stanza) {
        self.handleRoster(stanza, callback)
    })
    this.client.send(stanza)
}

Roster.prototype.add = function(data, callback) {
    if (typeof callback !== 'function')
        return this._clientError('Missing callback', data)
    if (!data.jid)
        return this._clientError('Missing \'jid\' key', data, callback)
    var self = this
    var item = {jid: data.jid}
    if (data.name) item.name = data.name

    var stanza = new builder.Element(
        'iq',
        {type: 'set', id: this._getId() }
    ).c('query', { xmlns: this.NS }).c('item', item)
    if (data.groups)
        data.groups.forEach(function(group) {
            stanza.c('group').t(group).up()
        })
    this.manager.trackId(stanza, function(stanza) {
        if (stanza.attrs.type === 'error') return callback(self._parseError(stanza), null)
        callback(null, true)
    })
    this.client.send(stanza)
}

Roster.prototype.remove = function(data, callback) {
    if (typeof callback !== 'function')
        return this._clientError('Missing callback', data)
    if (!data.jid)
        return this._clientError('Missing \'jid\' key', data, callback)
    var self = this
    var item = { jid: data.jid, subscription: 'remove' }

    var stanza = new builder.Element(
        'iq',
        {type: 'set', id: this._getId() }
    ).c('query', { xmlns: this.NS }).c('item', item)

    this.manager.trackId(stanza, function(stanza) {
        if (stanza.attrs.type === 'error') return callback(self._parseError(stanza), null)
        callback(null, true)
    })
    this.client.send(stanza)
}

Roster.prototype.edit = function(data, callback) {
    var self = this
    if (!data.jid)
        return this._clientError('Missing \'jid\' key', data, callback)
    if (!data.groups)
        return this._clientError('Missing \'groups\' key', data, callback)
    if (typeof callback !== 'function')
        return this._clientError('Missing callback', data)
    if (false === (data.groups instanceof Array))
        return this._clientError('Groups should be an array', data, callback)

    var itemAttrs = { jid: data.jid }
    if (data.name) itemAttrs.name = data.name

    var stanza = new builder.Element(
        'iq',
        {type: 'set', id: this._getId() }
    ).c('query', { xmlns: this.NS }).c('item', itemAttrs)
    data.groups.forEach(function(group) {
        stanza.c('group').t(group).up()
    })
    this.manager.trackId(stanza, function(stanza) {
        if ('error' === stanza.attrs.type) return callback(self._parseError(stanza))
        callback(null, true)
    })
    this.client.send(stanza)
}

Roster.prototype.handleRoster = function(stanza, callback) {
    var self  = this
    var items = []
    if ('error' === stanza.attrs.type)
        return callback(this._parseError(stanza), null)
    stanza.getChild('query').getChildren('item').forEach(function(item) {
        var entry = {
            jid: self._getJid(item.attrs.jid),
            subscription: item.attrs.subscription,
        }
        if (item.attrs.name) entry.name = item.attrs.name
        if (item.attrs.ask) entry.ask = item.attrs.ask
        var groups
        if (0 !== (groups = item.getChildren('group')).length) {
            entry.groups = []
            groups.forEach(function(group) {
                entry.groups.push(group.getText())
            })
        }
        items.push(entry)
    })
    callback(null, items)
}

Roster.prototype.handleRemoteAdd = function(stanza) {
    var data = stanza.getChild('query').getChild('item')
    var rosterItem = {
        jid: this._getJid(data.attrs.jid),
        subscription:  data.attrs.subscription
    }
    var groups
    if (data.attrs.name) rosterItem.name = data.attrs.name
    if (data.attrs.ask) rosterItem.ask = data.attrs.ask
    if (0 !== (groups = data.getChildren('group')).length) {
        rosterItem.groups = []
        groups.forEach(function(group) {
            rosterItem.groups.push(group.getText())
        })
    }
    this.socket.send('xmpp.roster.push', rosterItem)
    return true
}






var Presence = function() {}

Presence.prototype = new Base()

Presence.prototype.NS_ENTITY_CAPABILITIES = 'http://jabber.org/protocol/caps'

Presence.prototype.current = 'online';

Presence.prototype._events = {
    'xmpp.presence': 'sendPresence',
    'xmpp.presence.subscribe': 'subscribe',
    'xmpp.presence.subscribed': 'setSubscribed',
    'xmpp.presence.unsubscribe': 'setUnsubscribe',
    'xmpp.presence.unsubscribed': 'setUnsubscribed',
    'xmpp.presence.get': 'get',
    'xmpp.presence.offline': 'setOffline',
    'disconnect': 'setDisconnect'
}

Presence.prototype.subscribe = function(data) {
    this.subscription(data, 'subscribe')
}

Presence.prototype.setSubscribed = function(data) {
    this.subscription(data, 'subscribed')
}

Presence.prototype.setUnsubscribe = function(data) {
    this.subscription(data, 'unsubscribe')
}

Presence.prototype.setUnsubscribed = function(data) {
    this.subscription(data, 'unsubscribed')
}

Presence.prototype.setOffline = function() {
    this.sendPresence({ type: 'unavailable' })
}

Presence.prototype.setDisconnect  = function() {
    if (this.current !== 'unavailable')
        this.sendPresence({ type: 'unavailable' })
}

Presence.prototype.handles = function(stanza) {
    return stanza.is('presence')
}

Presence.prototype.handle = function(stanza) {
    if (stanza.attrs.type === 'subscribe') return this.handleSubscription(stanza)
    if (stanza.attrs.type === 'error') return this.handleError(stanza)
    var presence = { from: this._getJid(stanza.attrs.from) }
    if ('unavailable' === stanza.attrs.type) {
        presence.show = 'offline'
    } else {
        var show, status, priority
        if (!!(show = stanza.getChild('show')))
            presence.show = show.getText()
        if (!!(status = stanza.getChild('status')))
            presence.status = status.getText()
        if (!!(priority = stanza.getChild('priority')))
            presence.priority = priority.getText()
    }
    var capabilities
    if (!!(capabilities = stanza.getChild('c', this.NS_ENTITY_CAPABILITIES))) {
        presence.client = {
            node: capabilities.attrs.node,
            ver: capabilities.attrs.ver,
            hash: capabilities.attrs.hash
        }
    }
    this.socket.send('xmpp.presence', presence)
    return true
}

Presence.prototype.sendPresence = function(data) {
    if (!data) {
        data = {}
    }
    var stanza = new builder.Element('presence')
    if (data.to) stanza.attr('to', data.to)
    if (data.type && data.type === 'unavailable') stanza.attr('type', data.type)
    if (data.status) stanza.c('status').t(data.status).up()
    if (data.priority) stanza.c('priority').t(data.priority).up()
    if (data.show) stanza.c('show').t(data.show).up()
    if (false === this._addCapabilities(data, stanza)) return
    this.client.send(stanza)
}

Presence.prototype._addCapabilities = function(data, stanza) {
    if (typeof data.client === 'undefined') return true
    if (typeof data.client !== 'object')
        return this._clientError('\'client\' key must be an object', data)
    if (!data.client.node)
        return this._clientError('Missing \'node\' key', data)
    if (!data.client.ver)
        return this._clientError('Missing \'ver\' key', data)
    if (!data.client.hash)
        return this._clientError('Missing \'hash\' key', data)
    stanza.c('c', {
        xmlns: this.NS_ENTITY_CAPABILITIES,
        ver: data.client.ver,
        node: data.client.node,
        hash: data.client.hash
    })
    return true
}

Presence.prototype.handleSubscription = function(stanza) {
    var request = { from: this._getJid(stanza.attrs.from ) }
    if (stanza.getChild('nick')) request.nick = stanza.getChild('nick').getText()
    this.socket.send('xmpp.presence.subscribe', request)
}

Presence.prototype.handleError = function(stanza) {
    var description = stanza.getChild('error').children[0].getName()
    var attributes = { error: description }
    if (stanza.attrs.from)
        attributes.from = this._getJid(stanza.attrs.from)
    this.socket.send('xmpp.presence.error', attributes)
}

Presence.prototype.subscription = function(data, type) {
    if (!data.to) return this._clientError('Missing \'to\' key', data)
    var stanza = new builder.Element(
        'presence',
        { to: data.to, type: type, from: this.manager.jid }
    )
    this.client.send(stanza)
}

Presence.prototype.get = function(data) {
    if (!data.to) return this._clientError('Missing \'to\' key', data)
    var stanza = new builder.Element(
        'presence', { to: data.to, from: this.manager.jid }
    )
    this.client.send(stanza)
}






var Chat = function() {}

Chat.prototype = new Base()

Chat.prototype.XHTML = 'xhtml'
Chat.prototype.PLAIN = 'plain'

Chat.prototype._events = {
    'xmpp.chat.message': 'sendMessage',
    'xmpp.chat.receipt': 'sendReceipt'
}

Chat.prototype.handles = function(stanza) {
    if (!stanza.is('message')) return false
    if (!stanza.attrs.type || ('chat' === stanza.attrs.type)) return true
    if (stanza.getChild('received', receipt.NS)) return true
    return false
}

Chat.prototype.handle = function(stanza) {
    var chat = { from: this._getJid(stanza.attrs.from) }
    if (stanza.getChild('received', receipt.NS))
        return this._returnDeliveryReceipt(chat, stanza)
    this._getMessageContent(stanza, chat)
    delay.parse(stanza, chat)
    state.parse(stanza, chat)
    if (stanza.getChild('request', receipt.NS)) chat.receipt = true
    correction.parse(stanza, chat)
    var self = this
    stanza.getChildren('archived').forEach(function(archived) {
        if (!chat.archived) chat.archived = []
        chat.archived.push({
            by: self._getJid(archived.attrs.by),
            id: archived.attrs.id
        })
    })
    if (stanza.attrs.id) chat.id = stanza.attrs.id
    this.socket.send('xmpp.chat.message', chat)
    return true
}

Chat.prototype._returnDeliveryReceipt = function(data, stanza) {
    receipt.parse(stanza, data)
    this.socket.send('xmpp.chat.receipt', data)
    return true
}

Chat.prototype._getMessageContent = function(stanza, chat) {
    if (!stanza.getChild('body') &&
        !stanza.getChild('html', xhtmlIm.NS_XHTML_IM)
    ) return

    var format  = this.PLAIN
    var content = stanza.getChild('body').getText()
    var message
    if (!!(message = stanza.getChild('html', xhtmlIm.NS_XHTML_IM))) {
        content = message.getChild('body', xhtmlIm.NS_XHTML)
            .children
            .join('')
            .toString()
            .trim()
        format  = this.XHTML
    }
    chat.content = content
    chat.format = format
}

Chat.prototype.sendReceipt = function(data) {
    if (!data.to)
        return this._clientError('Missing \'to\' key', data)
    if (!data.id)
        return this._clientError('Missing \'id\' key', data)
    var stanza = new builder.Element('message', { id: this._getId(), to: data.to })
    receipt.build(stanza, 'received', data)
    this.client.send(stanza)
}

Chat.prototype._addState = function(stanza, chatState) {
    if (!chatState) return
    stanza.root().c(chatState, { xmlns: state.NS })
}

Chat.prototype._addReceiptRequest = function(stanza, data, hasValidCallback) {
    if (!data.receipt) return true

    if (false === hasValidCallback) {
        this._clientError('Callback required', data)
        return false
    }
    receipt.build(stanza)
}

Chat.prototype.sendMessage = function(data, callback) {
    if (!data.to) return this._clientError('Missing \'to\' key', data)
    if (data.replace && !data.content) return this._clientError(
        'Missing \'content\' key', data, callback
    )
    data.type = 'chat'
    if (!data.content && !data.state) {
        return this._clientError(
            'Message content or chat state not provided', data, callback
        )
    }
    var stanza
    if (!(stanza = xhtmlIm.builder(data, { to: data.to, type: 'chat' }, this)))
        return
    var hasValidCallback = false
    correction.build(stanza, data)
    if (callback) {
        if (false === this._hasValidCallback(callback, data)) return
        hasValidCallback = true
        stanza.root().attrs.id = this._getId()
    }
    this._addState(stanza, data.state)
    if (false === this._addReceiptRequest(stanza, data, hasValidCallback)) {
        return
    }
    this.client.send(stanza)
    if (false === hasValidCallback) return
    callback(null, { id: stanza.root().attrs.id })
}
