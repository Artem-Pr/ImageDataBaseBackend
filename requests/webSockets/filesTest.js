const {readdir, stat} = require('fs/promises')
const {DBController, DBRequests} = require('../../utils/DBController');
const {BasicClass} = require('../../utils/basicClass');
const {DATABASE_FOLDER} = require('../../constants');
const {getFilePathWithoutName, removeExtraFirstSlash, getUniqPaths} = require('../../utils/common');
const {uniq} = require('ramda');
const STATUS = {
    DEFAULT: 'default',
    INIT: 'init',
    PENDING: 'pending',
    PENDING_SUCCESS: 'pending-success',
    PENDING_ERROR: 'pending-error',
    DONE: 'done',
    ERROR: 'error'
}

const COMMON_DELAY = 300
const delay = ms => new Promise(res => setTimeout(res, ms || COMMON_DELAY))

const paginationDefault = {
    currentPage: 0,
    nPerPage: 500,
    resultsCount: 0,
    totalPages: 0,
}

class FilesTest extends BasicClass {
    _moduleName = undefined
    _DBInstance = undefined
    _send = undefined
    _configFoldersSet = new Set()
    _DBFoldersSet = new Set()
    _DiscFoldersSet = new Set()
    _filesCount = {
        filesOnDisc: 0,
        filesInDB: 0
    }
    _excessiveFolders = {
        excessiveFolders__Config_Disk: [],
        excessiveFolders__Config_DB: [],
        excessiveFolders__DB_Config: [],
        excessiveFolders__DB_Disk: [],
        excessiveFolders__Disk_DB: [],
        excessiveFolders__Disk_Config: [],
        excessiveFolders__filesOnDisc: [],
        excessiveFolders__filesInDB: [],
    }
    _config = {
        status: STATUS.DEFAULT,
        progress: 0,
        totalCount: 0,
        currentCount: 0,
        message: '',
    }
    _DBRequestConfig = {
        needTotal: true,
        usePagination: true,
        currentResults: [],
        pagination: paginationDefault
    }
    
    /**
     * @constructor
     * @param {{
     *     collection: object,
     *     configCollection: object
     * }} locals
     * @param {function(stringifiedResponse: string)} send
     */
    constructor(locals, send) {
        const moduleName = 'FILES_TEST'
        super(moduleName)
        this._moduleName = moduleName
        
        this._DBInstance = new DBController()
        this._DBInstance.DBCollection = locals.collection
        this._DBInstance.DBConfigCollection = locals.configCollection
        this._send = send
        this.successLog('Check files - constructor init')
    }
    
    increaseProgress(progress) {
        this.config.progress = this.config.progress + Math.round(progress)
    }
    
    get DBRequestConfig() {
        return this._DBRequestConfig
    }
    
    increaseNumberOfFilesOnDisc(numberOfFiles) {
        this._filesCount.filesOnDisc = this._filesCount.filesOnDisc + numberOfFiles
    }
    
    increaseNumberOfFilesInDB(numberOfFiles) {
        this._filesCount.filesInDB = this._filesCount.filesInDB + numberOfFiles
    }
    
    get filesOnDisc() {
        return this._filesCount.filesOnDisc
    }
    
    get filesInDB() {
        return this._filesCount.filesInDB
    }
    
    get excessiveFolders__Config_Disk() {
        return this._excessiveFolders.excessiveFolders__Config_Disk
    }
    
    get excessiveFolders__Disk_Config() {
        return this._excessiveFolders.excessiveFolders__Disk_Config
    }
    
    get excessiveFolders__Config_DB() {
        return this._excessiveFolders.excessiveFolders__Config_DB
    }
    
    get excessiveFolders__DB_Config() {
        return this._excessiveFolders.excessiveFolders__DB_Config
    }
    
    get excessiveFolders__DB_Disc() {
        return this._excessiveFolders.excessiveFolders__DB_Disk
    }
    
    get excessiveFolders__Disc_DB() {
        return this._excessiveFolders.excessiveFolders__Disk_DB
    }
    
    get excessiveFolders__filesOnDisc() {
        return this._excessiveFolders.excessiveFolders__filesOnDisc
    }
    
    get excessiveFolders__filesInDB() {
        return this._excessiveFolders.excessiveFolders__filesInDB
    }
    
    reset_ExcessiveFolders__filesOnDisc() {
        this._excessiveFolders.excessiveFolders__filesOnDisc = []
    }
    
    reset_ExcessiveFolders__filesInDB() {
        this._excessiveFolders.excessiveFolders__filesInDB = []
    }
    
    /**
     * @param {boolean} flag
     */
    set usePagination(flag) {
        this._DBRequestConfig.usePagination = flag
    }
    
    /**
     * @param {object[]} results
     */
    set currentResults(results) {
        this._DBRequestConfig.currentResults = results
    }
    
    get moduleName() {
        return this._moduleName
    }
    
    set configFoldersSet(newPathsList) {
        this._configFoldersSet = new Set(newPathsList)
    }
    
    get configFoldersSet() {
        return this._configFoldersSet
    }
    
    set DiscFoldersSet(newPathsList) {
        this._DiscFoldersSet = new Set(newPathsList)
    }
    
    get DiscFoldersSet() {
        return this._DiscFoldersSet
    }
    
    get DiscFoldersList() {
        return Array.from(this._DiscFoldersSet)
    }
    
    get DBFoldersSet() {
        return this._DBFoldersSet
    }
    
    
    /**
     * @param {string} status - status from STATUS object
     */
    set status(status) {
        this.config.status = status
    }
    
    set message(newMessage) {
        this.config.message = newMessage
    }
    
    set progress(progress) {
        this.config.progress = progress
    }
    
    set totalCount(count) {
        this.config.totalCount = count
    }
    
    set config(newConfig) {
        this._config = newConfig
    }
    
    /**
     * @param {{
     *     currentPage: number,
     *     nPerPage: number,
     *     resultsCount: number,
     *     totalPages: number,
     * }} paginationObj
     */
    set pagination(paginationObj) {
        this._DBRequestConfig.pagination = {
            ...this._DBRequestConfig.pagination,
            ...paginationObj
        }
    }
    
    get config() {
        return this._config
    }
    
    startProcess() {
        this.status = STATUS.INIT
        this.message = 'Process init ...'
        this.sendRequest()
        this.processChaining()
            .then(() => {
                this.status = STATUS.DONE
                this.progress = 100
                this.message = 'Files test is complete'
            })
            .catch(error => {
                this.status = STATUS.ERROR
                this.message = `Error: ${error}`
            })
            .finally(() => {
                this.sendRequest()
            })
    }
    
    async processChaining() {
        await this.getFoldersListFromDBConfig(10)
        await this.getFolderListFromDisc(10)
        await this.getFolderListFromDB(10)
        await this.getExcessiveFolders__Config_Disk(5)
        await this.getExcessiveFolders__Config_DB(5)
        await this.getExcessiveFolders__DB_Config(5)
        await this.getExcessiveFolders__DB_Disc(5)
        await this.getExcessiveFolders__Disc_DB(5)
        await this.getExcessiveFolders__Disc_Config(5)
        await this.getExcessiveFiles__onlyDiscFolders(10)
        await this.getExcessiveFiles__onlyExcessiveDBFolders(10)
    }
    
    async getExcessiveFolders__Config_Disk(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'Start finding extra folders in the database config (disk comparison) ...'
        this.increaseProgress(process)
        this.sendRequest()
        await delay()
        
        this._excessiveFolders.excessiveFolders__Config_Disk = []
        
        this.configFoldersSet.forEach((value) => {
            !this.DiscFoldersSet.has(value) && this._excessiveFolders.excessiveFolders__Config_Disk.push(value)
        })
        
        this.message = `Finish finding extra folders in the database config (disc comparison): ${this.excessiveFolders__Config_Disk.length} folders`
        this.sendRequest()
        this.status = STATUS.PENDING_SUCCESS
    }
    
    async getExcessiveFolders__Disc_Config(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'Start finding extra folders in the disc (DB config comparison) ...'
        this.increaseProgress(process)
        this.sendRequest()
        await delay()
        
        this._excessiveFolders.excessiveFolders__Disk_Config = []
        
        this.DiscFoldersSet.forEach((value) => {
            !this.configFoldersSet.has(value) && this._excessiveFolders.excessiveFolders__Disk_Config.push(value)
        })
        
        this.message = `Finish finding extra folders in the disc (DB config comparison): ${this.excessiveFolders__Disk_Config.length} folders`
        this.sendRequest()
        this.status = STATUS.PENDING_SUCCESS
    }
    
    async getExcessiveFolders__Config_DB(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'Start finding extra folders in the database config (DB comparison) ...'
        this.increaseProgress(process)
        this.sendRequest()
        await delay()
        
        this._excessiveFolders.excessiveFolders__Config_DB = []
        
        this.configFoldersSet.forEach((value) => {
            !this.DBFoldersSet.has(value) && this._excessiveFolders.excessiveFolders__Config_DB.push(value)
        })
        
        this.message = `Finish finding extra folders in the database config (DB comparison): ${this.excessiveFolders__Config_DB.length} folders`
        this.sendRequest()
        this.status = STATUS.PENDING_SUCCESS
    }
    
    async getExcessiveFolders__DB_Config(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'Start finding extra folders in the DB (DB_config comparison) ...'
        this.increaseProgress(process)
        this.sendRequest()
        await delay()
        
        this._excessiveFolders.excessiveFolders__DB_Config = []
        
        this.DBFoldersSet.forEach((value) => {
            !this.configFoldersSet.has(value) && this._excessiveFolders.excessiveFolders__DB_Config.push(value)
        })
        
        this.message = `Finish finding extra folders in the DB (DB_config comparison): ${this.excessiveFolders__DB_Config.length} folders`
        this.sendRequest()
        this.status = STATUS.PENDING_SUCCESS
    }
    
    async getExcessiveFolders__DB_Disc(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'Start finding extra folders in the DB (disc comparison) ...'
        this.increaseProgress(process)
        this.sendRequest()
        await delay()
        
        this._excessiveFolders.excessiveFolders__DB_Disk = []
        
        this.DBFoldersSet.forEach((value) => {
            !this.DiscFoldersSet.has(value) && this._excessiveFolders.excessiveFolders__DB_Disk.push(value)
        })
        
        this.message = `Finish finding extra folders in the DB (disc comparison): ${this.excessiveFolders__DB_Disc.length} folders`
        this.sendRequest()
        this.status = STATUS.PENDING_SUCCESS
    }
    
    async getExcessiveFolders__Disc_DB(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'Start finding extra folders in the disc (DB comparison) ...'
        this.increaseProgress(process)
        this.sendRequest()
        await delay()
        
        this._excessiveFolders.excessiveFolders__Disk_DB = []
        
        this.DiscFoldersSet.forEach((value) => {
            !this.DBFoldersSet.has(value) && this._excessiveFolders.excessiveFolders__Disk_DB.push(value)
        })
        
        this.message = `Finish finding extra folders in the disc (DB comparison): ${this.excessiveFolders__Disc_DB.length} folders`
        this.sendRequest()
        this.status = STATUS.PENDING_SUCCESS
    }
    
    
    async getFoldersListFromDBConfig(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'loading directory list from DB config ...'
        this.increaseProgress(process)
        this.sendRequest()
        
        await delay()
        try {
            this._DBInstance.DBRequest = DBRequests.directoriesList
            const pathsListObject = await this._DBInstance.findOne('configCollection')
            this.configFoldersSet = pathsListObject.pathsArr
            this.message = `loading directory list from DB config: ${this.configFoldersSet.size} folders`
            this.sendRequest()
            this.status = STATUS.PENDING_SUCCESS
        } catch (error) {
            this.throwError(error.message)
        }
    }
    
    async getFolderListFromDisc(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'loading directory list from Disc ...'
        this.increaseProgress(process)
        this.sendRequest()
        
        await delay()
        try {
            const filesInRootDirectory = await this.getAllFoldersRecursively(DATABASE_FOLDER)
            this.DiscFoldersSet = filesInRootDirectory.directoriesList
            this.infoLog('getAllFoldersRecursively', 'DiscFoldersList')
            this.message = `loading directory list from Disc: ${this.DiscFoldersSet.size} folders`
            this.sendRequest()
            this.status = STATUS.PENDING_SUCCESS
        } catch (error) {
            this.throwError(error.message)
        }
    }
    
    async getExcessiveFiles__onlyDiscFolders(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'loading files from Disc ...'
        this.increaseProgress(process)
        this.sendRequest()
        this.usePagination = false
        
        this.reset_ExcessiveFolders__filesOnDisc()
        this.reset_ExcessiveFolders__filesInDB()
        
        await delay()
        try {
            for (const dirname of this.DiscFoldersSet) {
                const {filesFromDiscSet} = await this.getAllFilesFromDiscDirectory(dirname)
                await this.DBRequest({targetFolder: dirname, excludeSubdirectories: true})
                const currentDBResultsSet = new Set(this.DBRequestConfig.currentResults.map(item => removeExtraFirstSlash(item.filePath)))
    
                this.increaseNumberOfFilesOnDisc(filesFromDiscSet.size)
                this.increaseNumberOfFilesInDB(currentDBResultsSet.size)
                
                filesFromDiscSet.forEach(dirname => {
                    !currentDBResultsSet.has(dirname) && this.excessiveFolders__filesOnDisc.push(dirname)
                })
                currentDBResultsSet.forEach(dirname => {
                    !filesFromDiscSet.has(dirname) && this.excessiveFolders__filesInDB.push(dirname)
                })
                
                this.message = `loading files from Disc: ${dirname}`
                this.sendRequest()
            }
            
            this.status = STATUS.PENDING_SUCCESS
        } catch (error) {
            this.throwError(error.message)
        }
    }
    
    async getExcessiveFiles__onlyExcessiveDBFolders(process = 0) {
        await delay()
        this.message = 'loading files from excessive directories in DB ...'
        this.increaseProgress(process)
        this.sendRequest()
        this.usePagination = false
        
        try {
            for (const dirname of this.excessiveFolders__DB_Disc) {
                await this.DBRequest({targetFolder: dirname, excludeSubdirectories: true})
                const currentDBResultsSet = new Set(this.DBRequestConfig.currentResults.map(item => removeExtraFirstSlash(item.filePath)))
            
                this.increaseNumberOfFilesInDB(currentDBResultsSet.size)
                
                currentDBResultsSet.forEach(dirname => {
                    this.excessiveFolders__filesInDB.push(dirname)
                })
            
                this.message = `loading files from excessive directories in DB: ${dirname}`
                this.sendRequest()
            }
        
            this.status = STATUS.PENDING_SUCCESS
        } catch (error) {
            this.throwError(error.message)
        }
    }
    
    async getFolderListFromDB(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'loading directory list from DB ...'
        this.increaseProgress(process * 0.1)
        this.sendRequest()
        await delay()
        
        try {
            this.usePagination = true
            do {
                await this.DBRequest();
                
                const resultsWithSubfolders = getUniqPaths(uniq(
                    this.DBRequestConfig.currentResults.map(item => getFilePathWithoutName(item.filePath))
                ))
                resultsWithSubfolders.forEach(item => this.DBFoldersSet.add(removeExtraFirstSlash(item)))
                
                const {currentPage, totalPages} = this.DBRequestConfig.pagination;
                const processPart = currentPage && totalPages ? (process * 0.9) / totalPages : 0
                
                this.message = `loading directory list from DB: ${currentPage + 1} page, ${this.DBRequestConfig.currentResults.length} results`
                this.increaseProgress(processPart)
                this.sendRequest();
                this.pagination = {currentPage: currentPage + 1}
            } while (this.DBRequestConfig.pagination.currentPage + 1 <= this.DBRequestConfig.pagination.totalPages);
            
            this.pagination = paginationDefault
            await delay()
            this.status = STATUS.PENDING_SUCCESS
        } catch (error) {
            this.throwError(error.message)
        }
    }
    
    /**
     *
     * @param {string?} targetFolder
     * @param {boolean?} excludeSubdirectories
     * @returns {Promise<void>}
     * @constructor
     */
    async DBRequest({targetFolder, excludeSubdirectories} = {}) {
        const {pagination, usePagination} = this.DBRequestConfig
        const {currentPage, nPerPage} = pagination
        const conditionArr = []
        const responseWithPagination = [
            {$project: {"filePath": 1}},
            {$skip: currentPage > 0 ? ((currentPage - 1) * nPerPage) : 0},
            {$limit: nPerPage},
        ]
        const calculatedPaginationData = [
            {$count: 'resultsCount'},
            {
                $addFields: {
                    totalPages: {
                        $ceil: {
                            $divide: ['$resultsCount', nPerPage],
                        }
                    },
                }
            },
            {
                $addFields: {
                    currentPage: {
                        $cond: [{$gt: [currentPage, '$totalPages']}, 1, currentPage]
                    }
                }
            }
        ]
        
        const returningObject = {
            $facet: {
                response: usePagination ? responseWithPagination : [],
                pagination: usePagination ? calculatedPaginationData : []
            }
        }
        
        targetFolder && excludeSubdirectories && (conditionArr.push(
            DBRequests.getFilesExcludeFilesInSubfolders(targetFolder)
        ))
        targetFolder && !excludeSubdirectories && (conditionArr.push(
            {$expr: {$eq: [{$indexOfCP: [`$preview`, `/${targetFolder}/`]}, 0]}}
        ))
        
        const aggregation = conditionArr.length ? [
            {$match: {$and: conditionArr}},
            returningObject
        ] : [returningObject]
        
        const [mongoResponse] = await this._DBInstance.collection
            .aggregate(aggregation, {allowDiskUse: true})
            .toArray()
        
        this.applyRequestResults(mongoResponse)
    }
    
    applyRequestResults(mongoResponse) {
        const {needTotal, usePagination} = this.DBRequestConfig
        
        const {response, pagination} = mongoResponse
        const {resultsCount, totalPages} = pagination.length
            ? pagination[0]
            : {resultsCount: 0, totalPages: 0}
        
        usePagination && (this.pagination = {resultsCount, totalPages})
        needTotal && (this.totalCount = resultsCount)
        this.currentResults = response
    }
    
    async getAllFoldersRecursively(dirPath, filesInRootDirectory) {
        const files = await readdir(dirPath)
        
        filesInRootDirectory = filesInRootDirectory || {
            directoriesList: []
        }
        
        const filesResponse = files.map(async file => {
            if (file === '.DS_Store') return
            const fileStat = await stat(dirPath + "/" + file)
            if (fileStat.isDirectory()) {
                filesInRootDirectory.directoriesList.push((dirPath + "/" + file).replace(`${DATABASE_FOLDER}/`, ''))
                filesInRootDirectory = await this.getAllFoldersRecursively(dirPath + "/" + file, filesInRootDirectory)
            }
        })
        
        await Promise.all(filesResponse)
        
        return filesInRootDirectory
    }
    
    async getAllFilesFromDiscDirectory(dirPath) {
        const files = await readdir(`${DATABASE_FOLDER}/${dirPath}`)
        
        const filesFromDiscSet = new Set()
        
        const filesResponse = files.map(async file => {
            if (file === '.DS_Store') return
            const fileStat = await stat(`${DATABASE_FOLDER}/${dirPath}/${file}`)
            if (fileStat.isFile() && !file.startsWith('._')) {
                filesFromDiscSet.add(dirPath + "/" + file)
            }
        })
        
        await Promise.all(filesResponse)
        
        return {filesFromDiscSet}
    }
    
    sendRequest() {
        const requestObject = {
            action: this.moduleName,
            data: {
                status: this.config.status,
                progress: this.config.progress,
                message: this.config.message,
                data: {
                    configFoldersCount: this.configFoldersSet.size,
                    DiscFoldersCount: this.DiscFoldersSet.size,
                    DBFoldersCount: this.DBFoldersSet.size,
                    filesOnDisc: this.filesOnDisc,
                    filesInDB: this.filesInDB,
                    excessiveFolders__Config_Disk: this.excessiveFolders__Config_Disk,
                    excessiveFolders__Disk_Config: this.excessiveFolders__Disk_Config,
                    excessiveFolders__DB_Config: this.excessiveFolders__DB_Config,
                    excessiveFolders__Config_DB: this.excessiveFolders__Config_DB,
                    excessiveFolders__DB_Disc: this.excessiveFolders__DB_Disc,
                    excessiveFolders__Disc_DB: this.excessiveFolders__Disc_DB,
                    excessiveFolders__filesInDB: this.excessiveFolders__filesInDB,
                    excessiveFolders__filesOnDisc: this.excessiveFolders__filesOnDisc,
                }
            }
        }
        
        this.successLog('webSocket - sendRequest', requestObject)
        this._send(JSON.stringify(requestObject))
    }
}

module.exports = {FilesTest}
