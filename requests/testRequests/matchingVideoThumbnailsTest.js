const {readdir, stat} = require('fs/promises')
const {
    isVideoFile,
    throwError,
    isVideoThumbnail,
    removeFileExt,
    normalize,
} = require('../../utils/common');
const {difference} = require('ramda');
const {TestController} = require('./testController');

const initialResponseModel = {
    videoOnDisk: 0,
    excessiveVideo__Disk_DB: [],
    excessiveVideo__Disk_DiskThumbnails: [],
    videoInDB: 0,
    excessiveVideo__DB_Disk: [],
    excessiveVideo__DB_DBThumbnails: [],
    videoThumbnailsOnDisk: 0,
    excessiveVideo__DiskThumbnails_Disk: [],
    excessiveVideo__DiskThumbnails_DBThumbnails: [],
    videoThumbnailsInDB: 0,
    excessiveVideo__DBThumbnails_DiskThumbnails: [],
    excessiveVideo__DBThumbnails_DB: [],
    progress: 0,
    pid: 0,
}

class MatchingVideoThumbnailsTestController extends TestController{
    /**
     * Test matching video files in directories with files in DB and thumbnails
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
        this.url = '/test/matching-videos'
        
        this.videoFromDisk = []
        this.thumbnailsFromDisk = []
        this.videoFromDB = []
        this.thumbnailsFromDB = []
    
        this.init('MatchingVideoThumbnailsTestController')
    }
    
    async startTestsPipeline() {
        this.setProgress(10)
        try {
            this.startTests()
            await this.getVideoFilesListFromRootDirectory()
            await this.fetchNumberOfFilesInDB()
            this.getVideoPathsFromDB()
            this.saveNumberOfVideoThumbnailsFromDB()
            
            this.getExcessiveVideosOnDisk()
            this.getExcessiveVideosInDB()
            this.getExcessiveVideosThumbnailsOnDisk()
            this.getExcessiveVideosThumbnailsInDB()
        } catch (error) {
            this.sendError(error.message)
        }
    }
    
    async getVideoFilesListFromRootDirectory() {
        const getVideoFilesRecursively = async function(dirPath, filesInRootDirectory) {
            const files = await readdir(dirPath)
            
            filesInRootDirectory = filesInRootDirectory || {
                videoFilesList: [],
                videoThumbnailsList: []
            }
    
            const filesResponse = files.map(async function (file) {
                const fileStat = await stat(dirPath + "/" + file)
                if (fileStat.isDirectory()) {
                    filesInRootDirectory = await getVideoFilesRecursively(dirPath + "/" + file, filesInRootDirectory)
                } else {
                    isVideoThumbnail(file)
                        && !file.startsWith('._')
                        && filesInRootDirectory.videoThumbnailsList.push(dirPath + "/" + file)
                    isVideoFile(file)
                        && !file.startsWith('._')
                        && filesInRootDirectory.videoFilesList.push(dirPath + "/" + file)
                }
            })
    
            await Promise.all(filesResponse)
            
            return filesInRootDirectory
        }
        try {
            const response = await getVideoFilesRecursively(this.rootDirectory)
    
            // save response
            this.videoFromDisk = this.cutRootDirectoryPathFromPathsArr(response.videoFilesList)
            this.thumbnailsFromDisk = this.cutRootDirectoryPathFromPathsArr(response.videoThumbnailsList)
            this.responseModel = {
                ...this.responseModel,
                videoOnDisk: response.videoFilesList.length,
                videoThumbnailsOnDisk: response.videoThumbnailsList.length
            }
            this.updateProgress(30)
        } catch (error) {
            throwError('getVideoFilesListFromRootDirectory', true)
        }
    }
    
    async fetchNumberOfFilesInDB() {
        await this.pathsController.fetchAllVideoFiles()
        this.responseModel = {
            ...this.responseModel,
            videoInDB: this.pathsController.allVideoFiles.length,
        }
        this.updateProgress(35)
    }
    
    getVideoPathsFromDB() {
        const videoFilesList = this.pathsController.allVideoFiles
        this.videoFromDB = this.removeExtraSlashesFromPathsArr(
            videoFilesList
                .map(({filePath}) => filePath)
                .sort()
        )
        this.thumbnailsFromDB = this.removeExtraSlashesFromPathsArr(
            videoFilesList
                .map(({preview}) => preview)
                .sort()
        )
    }
    
    saveNumberOfVideoThumbnailsFromDB() {
        this.responseModel = {
            ...this.responseModel,
            videoThumbnailsInDB: this.thumbnailsFromDB.length,
        }
        this.updateProgress(5)
    }
    
    getExcessiveVideosOnDisk() {
        const difList__Disk_DB = difference(
            this.normalizedStringArr(this.videoFromDisk),
            this.normalizedStringArr(this.videoFromDB),
        )
        const difList__Disk_DiskThumbnails = difference(
            this.getFileNameListWithoutExt(this.videoFromDisk),
            this.getFileNameListFromThumbnailsList(this.thumbnailsFromDisk)
        )
        this.responseModel = {
            ...this.responseModel,
            excessiveVideo__Disk_DB: difList__Disk_DB,
            excessiveVideo__Disk_DiskThumbnails: difList__Disk_DiskThumbnails
        }
        this.updateProgress(5)
    }
    
    getExcessiveVideosInDB() {
        const difList__DB_Disk = difference(
            this.normalizedStringArr(this.videoFromDB),
            this.normalizedStringArr(this.videoFromDisk),
        )
        const difList__DB_DBThumbnails = difference(
            this.getFileNameListWithoutExt(this.videoFromDB),
            this.getFileNameListFromThumbnailsList(this.thumbnailsFromDB)
        )
        this.responseModel = {
            ...this.responseModel,
            excessiveVideo__DB_Disk: difList__DB_Disk,
            excessiveVideo__DB_DBThumbnails: difList__DB_DBThumbnails
        }
        this.updateProgress(5)
    }
    
    getExcessiveVideosThumbnailsOnDisk() {
        const difList__DiskThumbnails_Disk = difference(
            this.getFileNameListFromThumbnailsList(this.thumbnailsFromDisk),
            this.getFileNameListWithoutExt(this.videoFromDisk)
        )
        const difList__DiskThumbnails_DBThumbnails = difference(
            this.normalizedStringArr(this.thumbnailsFromDisk),
            this.normalizedStringArr(this.thumbnailsFromDB),
        )
        this.responseModel = {
            ...this.responseModel,
            excessiveVideo__DiskThumbnails_Disk: difList__DiskThumbnails_Disk,
            excessiveVideo__DiskThumbnails_DBThumbnails: difList__DiskThumbnails_DBThumbnails
        }
        this.updateProgress(5)
    }
    
    getExcessiveVideosThumbnailsInDB() {
        const difList__DBThumbnails_DiskThumbnails = difference(
            this.normalizedStringArr(this.thumbnailsFromDB),
            this.normalizedStringArr(this.thumbnailsFromDisk),
        )
        const difList__DBThumbnails_DB = difference(
            this.getFileNameListFromThumbnailsList(this.thumbnailsFromDB),
            this.getFileNameListWithoutExt(this.videoFromDB)
        )
        this.responseModel = {
            ...this.responseModel,
            excessiveVideo__DBThumbnails_DiskThumbnails: difList__DBThumbnails_DiskThumbnails,
            excessiveVideo__DBThumbnails_DB: difList__DBThumbnails_DB
        }
        this.updateProgress(5)
    }
    
    /**
     * Get video file name without extension from thumbnail name
     *
     * @param {string} thumbnail
     * @return {string}
     */
    cutThumbnailEndOfFileName(thumbnail) {
        return thumbnail.split('-thumbnail-')[0]
    }
    
    /**
     * Get video file names list without extension from thumbnails list
     *
     * @param {string[]} thumbnailList
     * @return {string[]}
     */
    getFileNameListFromThumbnailsList(thumbnailList) {
        return thumbnailList.map(thumbnail => this.cutThumbnailEndOfFileName(normalize(thumbnail)))
    }
    
    /**
     * Get file names list without extension from fullNames array
     *
     * @param {string[]} fileNameList
     * @return {string[]}
     */
    getFileNameListWithoutExt(fileNameList) {
        return fileNameList.map(fileName => removeFileExt(normalize(fileName)))
    }
}

const matchingVideoThumbnailsTest = async (req, res, dbFolder) => {
    const testController = new MatchingVideoThumbnailsTestController(req, res, dbFolder)
    if (testController.isFirstRequest()) {
        await testController.startTestsPipeline()
    } else {
        testController.sendProgress()
    }
}

module.exports = {matchingVideoThumbnailsTest}
