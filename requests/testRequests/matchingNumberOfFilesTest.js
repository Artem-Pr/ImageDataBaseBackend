const {readdir, stat} = require('fs/promises')
const {difference, uniq} = require("ramda")
const {
    getFilePathWithoutName,
    getUniqPaths,
    throwError
} = require("../../utils/common")
const {TestController} = require('./testController');

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

class MatchingNumberOfFilesTestController extends TestController {
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
        super(req, res, dbFolder);
        
        this.responseModel = this.pidsList[this.pid] || initialResponseModel
        this.url = '/test/matching-files'
        
        this.directoriesListFromDB = []
        this.directoriesListFromConfig = []
        this.directoriesListFromDisk = []
        
        this.filesListFromDisk = []
        this.filesListFromDB = []
    
        this.init('matchingNumberOfFilesTestController')
    }
    
    async startTestsPipeline() {
        this.setProgress(10)
        try {
            this.startTests()
            await this.fetchPathsFromConfig()
            await this.fetchNumberOfFilesInDB()
            this.getAllDirectoriesFromDBFiles()
            await this.getFilesListFromRootDirectory()
            
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
    
    async getFilesListFromRootDirectory() {
        const getAllFilesRecursively = async function(dirPath, filesInRootDirectory) {
            const files = await readdir(dirPath)
    
            filesInRootDirectory = filesInRootDirectory || {
                filesList: [],
                directoriesList: []
            }
    
            const filesResponse = files.map(async function (file) {
                const fileStat = await stat(dirPath + "/" + file)
                if (fileStat.isDirectory()) {
                    filesInRootDirectory.directoriesList.push(dirPath + "/" + file)
                    filesInRootDirectory = await getAllFilesRecursively(dirPath + "/" + file, filesInRootDirectory)
                } else {
                    !file.includes('thumbnail') && filesInRootDirectory.filesList.push(dirPath + "/" + file)
                }
            })
            
            await Promise.all(filesResponse)
            
            return filesInRootDirectory
        }
        try {
            const response = await getAllFilesRecursively(this.rootDirectory)
            
            // save response
            this.directoriesListFromDisk = this.cutRootDirectoryPathFromPathsArr(response.directoriesList)
            this.filesListFromDisk = this.cutRootDirectoryPathFromPathsArr(response.filesList)
            
            this.responseModel = {
                ...this.responseModel,
                filesInDirectory: response.filesList.length,
                foldersInDirectory: response.directoriesList.length
            }
            this.updateProgress(5)
        } catch (error) {
            throwError('getFilesListFromRootDirectory', true)
        }
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
}


const matchingNumberOfFilesTest = async (req, res, dbFolder) => {
    const testController = new MatchingNumberOfFilesTestController(req, res, dbFolder)
    if (testController.isFirstRequest()) {
        await testController.startTestsPipeline()
    } else {
        testController.sendProgress()
    }
}

module.exports = {matchingNumberOfFilesTest, MatchingNumberOfFilesTestController }
