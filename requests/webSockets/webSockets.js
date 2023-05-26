const WebSocket = require('ws');
const {WEB_SOCKET_PORT} = require('../../constants');
const {logger} = require('../../utils/logger');
const {SyncPreviews} = require('./syncPreviews');

class WebSockets {
    _wsServer = undefined
    
    /**
     * @constructor
     * @param app
     * @param {locals: {collection: {
     *    aggregate: (Array, object) => ({toArray: () => Promise<any>})
     * }}} app.locals - express instance
     */
    constructor(app) {
        this._wsServer = new WebSocket.Server({port: WEB_SOCKET_PORT});
        this._wsServer.on('connection', this.onConnect.bind(this));
        this._locals = app.locals
        logger.info('Start listening websockets port', {message: WEB_SOCKET_PORT})
    }
    
    get locals() {
        return this._locals
    }
    
    startSyncPreviews(send) {
        const syncPreviewsInstance = new SyncPreviews(this.locals, send)
        syncPreviewsInstance.startProcess()
    }
    
    onConnect(wsClient) {
        logger.info('start connection', {message: 'web-sockets'})

        wsClient.on('close', function () {
            logger.info('close connection', {message: 'web-sockets'})
        });

        wsClient.on('message', message => {
            try {
                const jsonMessage = JSON.parse(message);
                const send = (message) => wsClient.send(message)
                
                switch (jsonMessage.action) {
                    case 'SYNC_PREVIEWS':
                        this.startSyncPreviews(send)
                        break;
                    default:
                        logger.error('Unknown action', {message: 'web-sockets'})
                        break;
                }
            } catch (error) {
                logger.error('Web-sockets', {message: 'Error', data: error.message})
            }
        });
    }
}

module.exports = {WebSockets}
