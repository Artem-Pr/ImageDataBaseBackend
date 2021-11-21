// const {readdir, stat} = require('fs/promises')
const {readdirSync, statSync} = require('fs-extra')
const {logger} = require("../../utils/logger")
const {difference, uniq} = require("ramda")
const {
    getAndSendError,
    createPid,
    getFilePathWithoutName,
    getUniqPaths,
    removeExtraFirstSlash,
    removeExtraSlash
} = require("../../utils/common")
const {DBRequestsController} = require("../../utils/DBRequestsController")
const pidsList = {}

const initialResponseModel = {
    foldersInConfig: 0,
    excessiveFolders__Config_DB: [],
    excessiveFolders__Config_Disk: [],
    foldersInDBFiles: 0,
    excessiveFolders__DB_Config: [],
    excessiveFolders__DB_Disk: [],
    foldersInDirectory: 0,
    excessiveFolders__Disk_Config: [],
    excessiveFolders__Disk_DB: [],
    filesInDB: 0,
    excessiveFiles__DB_Disk: [],
    filesInDirectory: 0,
    excessiveFiles__Disk_DB: [],
    progress: 0,
    pid: 0,
}

class matchingNumberOfFilesTestController {
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
        
        this.pid = pid
        this.res = res
        this.req = req
        this.rootDirectory = dbFolder
        this.responseModel = pidsList[pid] || initialResponseModel
        this.url = '/test/matching-files'
        this.pathsController = {pathsConfigArr: []}
        
        this.directoriesListFromDB = []
        this.directoriesListFromConfig = []
        this.directoriesListFromDisk = []
        
        this.filesListFromDisk = []
        this.filesListFromDB = []
        
        logger.info('matchingNumberOfFilesTestController init -', {message: 'SUCCESS'})
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
    
    async startTestsPipeline() {
        this.setProgress(10)
        try {
            this.startTests()
            await this.fetchPathsFromConfig()
            await this.fetchNumberOfFilesInDB()
            this.getAllDirectoriesFromDBFiles()
            this.getFilesListFromRootDirectory()
            
            this.getExcessiveFoldersFromConfig()
            this.getExcessiveFoldersInDBFiles()
            this.getExcessiveFoldersInDirectories()
            this.getExcessiveFilesInDB()
            this.getExcessiveFilesInDirectories()
        } catch (error) {
            this.sendError(error.message)
        }
    }
    
    async fetchPathsFromConfig() {
        await this.pathsController.fetchPathsConfig('init')
        this.responseModel = {
            ...this.responseModel,
            foldersInConfig: this.pathsController.pathsConfigArr.length,
        }
        this.directoriesListFromConfig = this.removeExtraSlashesFromPathsArr(this.pathsController.pathsConfigArr)
        this.updateProgress(30)
    }
    
    async fetchNumberOfFilesInDB() {
        await this.pathsController.fetchAllFiles()
        this.responseModel = {
            ...this.responseModel,
            filesInDB: this.pathsController.allFiles.length,
        }
        this.updateProgress(20)
    }
    
    getFilesListFromRootDirectory() {
        const getAllFilesRecursively = function(dirPath, filesInRootDirectory) {
            const files = readdirSync(dirPath)
    
            filesInRootDirectory = filesInRootDirectory || {
                filesList: [],
                directoriesList: []
            }
    
            files.forEach(function (file) {
                if (statSync(dirPath + "/" + file).isDirectory()) {
                    filesInRootDirectory.directoriesList.push(dirPath + "/" + file)
                    filesInRootDirectory = getAllFilesRecursively(dirPath + "/" + file, filesInRootDirectory)
                } else {
                    !file.includes('thumbnail') && filesInRootDirectory.filesList.push(dirPath + "/" + file)
                }
            })
            
            return filesInRootDirectory
        }
        const response = getAllFilesRecursively(this.rootDirectory)
        
        // save response
        this.directoriesListFromDisk = this.cutRootDirectoryPathFromPathsArr(response.directoriesList)
        this.filesListFromDisk = this.cutRootDirectoryPathFromPathsArr(response.filesList)
        
        this.responseModel = {
            ...this.responseModel,
            filesInDirectory: response.filesList.length,
            foldersInDirectory: response.directoriesList.length
        }
        this.updateProgress(5)
    }
    
    getAllDirectoriesFromDBFiles() {
        const filesList = this.pathsController.allFiles
        const fileDirList = filesList.map(({filePath}) => getFilePathWithoutName(filePath))
        this.updateProgress(5)
        this.directoriesListFromDB = this.removeExtraSlashesFromPathsArr(getUniqPaths(uniq(fileDirList)))
        this.filesListFromDB = this.removeExtraSlashesFromPathsArr(
            filesList
                .map(({filePath}) => filePath)
                .sort()
        )
        this.responseModel = {
            ...this.responseModel,
            foldersInDBFiles: this.directoriesListFromDB.length
        }
        this.updateProgress(5)
    }
    
    getExcessiveFoldersFromConfig() {
        const difList__Config_DB = difference(this.directoriesListFromConfig, this.directoriesListFromDB)
        const difList__Config_Disk = difference(this.directoriesListFromConfig, this.directoriesListFromDisk)
        this.responseModel = {
            ...this.responseModel,
            excessiveFolders__Config_DB: difList__Config_DB,
            excessiveFolders__Config_Disk: difList__Config_Disk
        }
        this.updateProgress(5)
    }
    
    getExcessiveFoldersInDBFiles() {
        const difList__DB_Config = difference(this.directoriesListFromDB, this.directoriesListFromConfig)
        const difList__DB_Disk = difference(this.directoriesListFromDB, this.directoriesListFromDisk)
        this.responseModel = {
            ...this.responseModel,
            excessiveFolders__DB_Config: difList__DB_Config,
            excessiveFolders__DB_Disk: difList__DB_Disk
        }
        this.updateProgress(5)
    }
    
    getExcessiveFoldersInDirectories() {
        const difList__Disk_Config = difference(this.directoriesListFromDisk, this.directoriesListFromConfig)
        const difList__Disk_DB = difference(this.directoriesListFromDisk, this.directoriesListFromDB)
        this.responseModel = {
            ...this.responseModel,
            excessiveFolders__Disk_Config: difList__Disk_Config,
            excessiveFolders__Disk_DB: difList__Disk_DB
        }
        this.updateProgress(5)
    }
    
    getExcessiveFilesInDB() {
        const difList__DB_Disk = difference(this.filesListFromDB, this.filesListFromDisk)
        this.responseModel = {
            ...this.responseModel,
            excessiveFiles__DB_Disk: difList__DB_Disk,
        }
        this.updateProgress(5)
    }
    
    getExcessiveFilesInDirectories() {
        const difList__Disk_DB = difference(this.filesListFromDisk, this.filesListFromDB)
        this.responseModel = {
            ...this.responseModel,
            excessiveFiles__Disk_DB: difList__Disk_DB,
        }
        this.updateProgress(5)
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
        pidsList[this.pid] = this.responseModel
    }
    
    sendProgress() {
        logger.http('POST-response', {message: this.url, data: pidsList[this.pid]})
        this.res.send(pidsList[this.pid])
    }
    
    sendError(errorMessage) {
        getAndSendError(
            this.res,
            "POST",
            this.url,
            errorMessage,
            'matchingNumberOfFilesTestController'
        )
    }
}


const matchingNumberOfFilesTest = async (req, res, dbFolder) => {
    const testController = new matchingNumberOfFilesTestController(req, res, dbFolder)
    if (testController.isFirstRequest()) {
        await testController.startTestsPipeline()
    } else {
        testController.sendProgress()
    }
}

module.exports = {matchingNumberOfFilesTest, matchingNumberOfFilesTestController}
