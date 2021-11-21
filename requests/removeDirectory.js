const {logger} = require("../utils/logger")
const {
    getSubdirectories,
    getParam,
    getAndSendError,
    asyncCheckFolder,
    throwError,
    asyncRemove,
    removeExtraSlash
} = require("../utils/common")
const {DBController, DBRequests} = require("../utils/DBController")
const {difference} = require("ramda")


class removeDirController {
    /**
     * @param {object | null} res - response object. Minimal: {send: null}
     * @param {object} req - request object. Minimal: {
     *   app: {locals: {collection: null}},
     *   body: null
     * }
     * @param {string | undefined} DBFolder - database root folder
     * @param {string | undefined} directory - use if req doesn't has directory in url params
     */
    constructor(res, req, DBFolder, directory) {
        this.res = res
        this.req = req
        
        // don't change init place, it provides tests errors
        if (directory) this._directory = directory
        else this.directory = 'name'
        
        this.rootDirectory = DBFolder
        this.pathsConfigArr = null
        this.foldersController = null
        this.removingController = null
        logger.debug('this._rootDirectory:', {message: this._rootDirectory, module: 'removeDirController'})
        this.successLog('controller initialized')
    }
    
    async startRemovingPipeline() {
        try {
            await this.checkFolder()
            await this.removeDirFromConfig()
            await this.removeDBFilesByDirectory()
            await this.removeDirectoryFromDisc()
            this.sendSuccess()
        } catch (error) {
            this.sendError(error.message)
        }
    }
    
    async removeDirectoryFromDisc() {
        await asyncRemove(this._rootDirectory)
    }
    
    async checkFolder() {
        const isDirectory = await asyncCheckFolder(this._rootDirectory)
        isDirectory
            ? this.successLog('checkFolder')
            : throwError(`can't find target directory`, true)
    }
    
    /**
     * Fetch pathsArr config from database
     *
     * @param {'init' | undefined} init - if "init", initialize pathsArr when it is not defined
     * @return {Promise<void>}
     */
    async fetchPathsConfig(init) {
        try {
            this.initPathsArrayController()
            const response = await this.foldersController.findOne("configCollection")
            this.pathsConfigArr = (response && response.pathsArr) ||
                (init ? null : throwError('Cannot find property \'pathsArr\' in pathConfig', true))
            this.successLog('fetch pathsArr', this.pathsConfigArr)
        } catch (error) {
            throwError(error.message, true)
        }
    }
    
    async updatePathsConfig(pathsConfig) {
        if (!pathsConfig) throwError('required "pathsConfig" param', true)
        !this.foldersController && this.initPathsArrayController()
        this.foldersController.DBUpdate = DBRequests.updateDirectoriesList(pathsConfig)
        const response = await this.foldersController.updateOne("configCollection")
        response.modifiedCount
            ? this.successLog('PathsConfig updating')
            : throwError(`Paths array wasn't update`, true)
        this.pathsConfigArr = pathsConfig
        return response.modifiedCount
    }
    
    async removeDirFromConfig() {
        try {
            await this.fetchPathsConfig()
            
            const isDirectory = this.pathsConfigArr.includes(this._directory)
            if (!isDirectory) throwError("Config doesn't contain target directory", true)
            
            await this.updatePathsConfig(this.getConfigWithoutTargetFolder())
            this.successLog('Remove directory from pathsArr config')
        } catch (error) {
            throwError(error.message, true)
        }
    }
    
    async removeDBFilesByDirectory() {
        try {
            this.removingController = new DBController(
                this.req,
                DBRequests.byFieldUsingStartsWith('filePath', `/${this._directory}`)
            )
            const response = await this.removingController.removeObjects('collection')
            this.successLog(`${response.deletedCount} files were deleted from the database by "filePath"`)
        } catch (error) {
            throwError(error.message, true)
        }
    }
    
    initPathsArrayController() {
        this.foldersController = new DBController(this.req, DBRequests.directoriesList)
    }
    
    getConfigWithoutTargetFolder() {
        if (!(this._directory && this.pathsConfigArr)) return null
        const {subDirectories} = getSubdirectories(this._directory, this.pathsConfigArr)
        const removingFolders = [...subDirectories, this._directory]
        const updatedConfig = difference(this.pathsConfigArr, removingFolders)
        logger.debug('removing folder paths from config', {data: removingFolders})
        logger.debug('updated config (without removing folders)', {data: updatedConfig})
        return updatedConfig
    }
    
    set directory(paramName) {
        try {
            this._directory = getParam(this.req, paramName)
        } catch (error) {
            this.sendError(error.message)
        }
    }
    
    get directory() {
        return this._directory
    }
    
    set rootDirectory(DBFolder) {
        if (!this._directory) throwError('Set "directory" first!', true)
        this._rootDirectory = DBFolder
            ? `${removeExtraSlash(DBFolder)}/${this._directory}`
            : this._directory
    }
    
    successLog(message, data) {
        logger.info(message, {
            message: ': SUCCESS',
            ...(data && {data}),
            module: 'removeDirectoryController'
        })
    }
    
    sendError(errorMessage) {
        getAndSendError(
            this.res,
            "DELETE",
            '/directory',
            errorMessage,
            'removeDirectory'
        )
    }
    
    sendSuccess() {
        logger.http('DELETE-response', {message: '/directory', data: {success: true, filePaths: this.pathsConfigArr}})
        this.res.send({success: true, filePaths: this.pathsConfigArr})
    }
}

module.exports = {removeDirController}
