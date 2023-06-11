const WebSocket = require('ws');
const {WEB_SOCKET_PORT} = require('../../constants');
const {logger} = require('../../utils/logger');
const {SyncPreviews} = require('./syncPreviews');
const {CreatePreviews} = require('./createPreviews');
const {FilesTest} = require('./filesTest');

const WEB_SOCKET_ACTIONS = {
    SYNC_PREVIEWS: 'SYNC_PREVIEWS',
    CREATE_PREVIEWS: 'CREATE_PREVIEWS',
    CREATE_PREVIEWS_STOP: 'CREATE_PREVIEWS_STOP',
    FILES_TEST: 'FILES_TEST',
}

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
        logger.info('startSyncPreviews', send)
        const syncPreviewsInstance = new SyncPreviews(this.locals, send)
        syncPreviewsInstance.startProcess()
    }
    
    /**
     * @param {object} send
     * @param {{folderPath: string, mimeTypes: string[]}} data
     */
    startCreatePreview(send, data) {
        this.previewCreationInstance = new CreatePreviews(this.locals, send, data)
        this.previewCreationInstance.startProcess()
    }
    
    stopPreviewCreation() {
        logger.info('stopPreviewCreation', {message: 'web-sockets'})
        this.previewCreationInstance.stopProcess()
    }
    
    startFilesTest(send) {
        logger.info('startFilesTest', {message: 'web-sockets'})
        const filesTestInstance = new FilesTest(this.locals, send)
        filesTestInstance.startProcess()
    }
    
    onConnect(wsClient) {
        logger.info('start connection', {message: 'web-sockets'})

        wsClient.on('close', function () {
            logger.info('close connection', {message: 'web-sockets'})
        });

        wsClient.on('message', message => {
            try {
                const jsonMessage = JSON.parse(message);
                logger.info('webSocket request: ', {
                    message: `Action: ${jsonMessage.action}`,
                    data: jsonMessage.data || {}
                })
                const send = (message) => wsClient.send(message)
                
                switch (jsonMessage.action) {
                    case WEB_SOCKET_ACTIONS.SYNC_PREVIEWS:
                        this.startSyncPreviews(send)
                        break;
                    case WEB_SOCKET_ACTIONS.CREATE_PREVIEWS:
                        this.startCreatePreview(send, jsonMessage.data)
                        break;
                    case WEB_SOCKET_ACTIONS.CREATE_PREVIEWS_STOP:
                        this.stopPreviewCreation()
                        break;
                    case WEB_SOCKET_ACTIONS.FILES_TEST:
                        this.startFilesTest(send)
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

module.exports = {WebSockets, WEB_SOCKET_ACTIONS}
