const {logger} = require("../../utils/logger")
const {
    getAndSendError,
    createPid,
    removeExtraFirstSlash,
    removeExtraSlash,
    normalize,
} = require('../../utils/common');
const {DBRequestsController} = require('../../utils/DBRequestsController');

const pidsList = {}

class TestController {
    /**
     * Test matching number of files in root directory and DB
     *
     * @param {object} req - request object. Minimal: {
     *   app: {locals: {collection: null}},
     *   body: null
     * }
     * @param {object} res - response object. Minimal: {send: null}
     * @param {string} dbFolder
     */
    constructor(req, res, dbFolder) {
        const pid = req.body && req.body.pid
        if (!pid && pid !== 0) this.sendError('missing pid')
        
        this.pidsList = pidsList
        this.pid = pid
        this.res = res
        this.req = req
        this.rootDirectory = dbFolder
        this.pathsController = {pathsConfigArr: []}
        this.moduleName = 'TestController'
        this.url = 'unknownURL'
    }
    
    /**
     * @param {string} moduleName
     */
    init(moduleName) {
        logger.info(`${moduleName || this.moduleName} init -`, {message: 'SUCCESS'})
    }
    
    isFirstRequest() {
        return (this.pid === 0)
    }
    
    startTests() {
        this.pid = createPid(6)
        this.responseModel = {...this.responseModel, pid: this.pid}
        this.updatePid()
        this.sendProgress()
        this.pathsController = new DBRequestsController(this.req)
    }
    
    updateProgress(additionalPercent) {
        this.responseModel = {
            ...this.responseModel,
            progress: this.responseModel.progress + additionalPercent,
            success: true
        }
        this.updatePid()
    }
    
    setProgress(percent) {
        this.responseModel = {
            ...this.responseModel,
            progress: percent,
            success: true
        }
        this.updatePid()
    }
    
    /**
     * Normalized string array with "NFC"
     *
     * @param {string[]} strings
     * @return {string[]}
     */
    normalizedStringArr(strings) {
        return strings.map(string => normalize(string))
    }
    
    removeExtraSlashesFromPathsArr(pathList) {
        return pathList.map(path => removeExtraFirstSlash(removeExtraSlash(path)))
    }
    
    cutRootDirectoryPathFromPathsArr(pathList) {
        const response = pathList
            .map(path => path.slice(this.rootDirectory.length))
            .sort()
        return this.removeExtraSlashesFromPathsArr(response)
    }
    
    updatePid() {
        this.pidsList[this.pid] = this.responseModel
    }
    
    sendProgress() {
        logger.http('POST-response', {message: this.url, data: this.pidsList[this.pid]})
        this.res.send(this.pidsList[this.pid])
    }
    
    sendError(errorMessage) {
        getAndSendError(
            this.res,
            "POST",
            this.url || 'unknown URL',
            errorMessage,
            this.moduleName
        )
    }
}

module.exports = {TestController}
