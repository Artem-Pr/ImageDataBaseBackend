const {DBController, DBRequests} = require("./DBController");
const {throwError} = require("../utils/common");
const {logger} = require("../utils/logger");

class DBRequestsController {
    /**
     * Save basic parameters and revert existing methods
     *
     * @param {object} req - request object. Minimal: {
     *   app: {locals: {collection: null}},
     *   body: null
     * }
     * @return {object}
     */
    constructor(req) {
        this.req = req
        this.foldersController = null
        this.pathsConfigArr = null
        this.allFiles = null
    }
    
    initPathsArrayController(DBRequest) {
        this.foldersController = new DBController(this.req, DBRequest)
    }
    
    /**
     * Fetch pathsArr config from database
     *
     * @param {'init' | undefined} init - if "init", initialize pathsArr when it is not defined
     * @return {Promise<void>}
     */
    async fetchPathsConfig(init) {
        try {
            this.initPathsArrayController(DBRequests.directoriesList)
            const response = await this.foldersController.findOne("configCollection")
            this.pathsConfigArr = (response && response.pathsArr) ||
                (init ? null : throwError('Cannot find property \'pathsArr\' in pathConfig', true))
            this.successLog('fetch pathsArr', this.pathsConfigArr)
        } catch (error) {
            throwError(error.message, true)
        }
    }
    
    /**
     * Fetch all files from database
     *
     * @return {Promise<void>}
     */
    async fetchAllFiles() {
        try {
            this.initPathsArrayController(DBRequests.allFiles)
            const response = await this.foldersController.find('collection')
            this.allFiles = response || throwError('DB collection is empty', true)
            this.successLog('fetch all files from DB (show only length)', this.allFiles.length)
        } catch (error) {
            throwError(error.message, true)
        }
    }
    
    successLog(message, data) {
        logger.info(message, {
            message: ': SUCCESS',
            ...(data && {data}),
            module: 'DBRequestsController'
        })
    }
}

module.exports = {DBRequestsController}
