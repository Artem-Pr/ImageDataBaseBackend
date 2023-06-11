const {readdir, stat} = require('fs/promises')
const {DBController, DBRequests} = require('../../utils/DBController');
const {BasicClass} = require('../../utils/basicClass');
const {PREVIEWS_FOLDER} = require('../../constants');
const {asyncCheckFolder, getFilePathWithoutName, removeExtraFirstSlash} = require('../../utils/common');
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
    nPerPage: 10,
    resultsCount: 0,
    totalPages: 0,
}

class SyncPreviews extends BasicClass {
    _moduleName = undefined
    _DBInstance = undefined
    _pathsList = []
    _send = undefined
    _previewFoldersSet = new Set()
    _mainPreviewDirectories = {
        'image-heic': false,
        'image-jpeg': false,
        'image-gif': false,
        'video-mp4': false,
    }
    _config = {
        status: STATUS.DEFAULT,
        progress: 0,
        totalCount: 0,
        currentCount: 0,
        message: '',
    }
    _DBRequestConfig = {
        areElementsWithPreview: true,
        needTotal: true,
        usePagination: false,
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
        const moduleName = 'SYNC_PREVIEWS'
        super(moduleName)
        this._moduleName = moduleName
        
        this._DBInstance = new DBController()
        this._DBInstance.DBCollection = locals.collection
        this._DBInstance.DBConfigCollection = locals.configCollection
        this._send = send
        this.successLog('SyncPreviews - constructor init')
    }
    
    increaseProgress(progress) {
        this.config.progress = this.config.progress + Math.round(progress)
    }
    
    get DBRequestConfig() {
        return this._DBRequestConfig
    }
    
    get previewFoldersSet() {
        return this._previewFoldersSet
    }
    
    /**
     * @param {string} folderPath
     */
    set previewFoldersSet(folderPath) {
        this._previewFoldersSet.add(folderPath)
    }
    
    /**
     * @param {boolean} flag
     */
    set usePagination(flag) {
        this._DBRequestConfig.usePagination = flag
    }
    
    get mainPreviewDirectories() {
        return this._mainPreviewDirectories
    }
    
    /**
     * @param {string} dirName
     * @param {boolean} isExist
     */
    set isMainPreviewDirectoryExist({dirName, isExist}) {
        this._mainPreviewDirectories[dirName] = isExist
    }
    
    /**
     * @param {boolean} needTotal
     */
    set needTotal(needTotal) {
        this._DBRequestConfig.needTotal = needTotal
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
    
    set pathsList(newPathsList) {
        this._pathsList = newPathsList
    }
    
    get pathsList() {
        return this._pathsList
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
                this.message = 'Preview sync is complete'
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
        await this.getTotalDBElementsWithPreview(10)
        await this.checkMainPreviewFolders(10)
        await this.getPathsListFromDisc(20)
        await this.syncMainPreviewsFolders(20)
        await this.getPreviewPathsListFromDB(10)
        await this.syncPreviewFolders(30)
    }
    
    async syncPreviewFolders(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'sync preview folders ...'
        this.increaseProgress(process * 0.1)
        this.sendRequest()
        await delay()
        
        const getNotExistedFolders = () => Array
            .from(this.previewFoldersSet)
            .filter(path => !this.pathsList.includes(PREVIEWS_FOLDER + path))
        
        try {
            const notExistedFolderList = getNotExistedFolders()
            if (notExistedFolderList.length) {
                const modifiedCountsPromise = notExistedFolderList.map(folder => {
                    return this.DBRemovePreview({targetFolder: removeExtraFirstSlash(folder)})
                        .then(({modifiedCount}) => {
                            this.message = `sync preview folders: ${modifiedCount} files has been updated`
                            this.increaseProgress(process * 0.9 / notExistedFolderList.length)
                            this.sendRequest()
                            return modifiedCount
                        })
                })
                
                await Promise.all(modifiedCountsPromise)
                await delay()
            } else {
                this.increaseProgress(process * 0.9)
            }
            this.message = 'sync preview folders: finished'
            this.sendRequest()
        } catch (error) {
            this.throwError(error.message)
        }
        
        this.status = STATUS.PENDING_SUCCESS
    }
    
    async getPreviewPathsListFromDB(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'loading preview directory list from DB ...'
        this.increaseProgress(process * 0.1)
        this.sendRequest()
        await delay()
        
        try {
            this.usePagination = true;
            do {
                await this.DBRequest();
                
                this.DBRequestConfig.currentResults.forEach(({preview}) => {
                    this.previewFoldersSet = getFilePathWithoutName(preview)
                })
                
                const filePathForTheMessage = this.DBRequestConfig.currentResults[0]
                    ? getFilePathWithoutName(this.DBRequestConfig.currentResults[0].preview)
                    : ''
                const {currentPage, totalPages} = this.DBRequestConfig.pagination;
                const processPart = currentPage && totalPages ? (process * 0.9) / totalPages : 0
                
                this.message = `loading preview directory list from DB: ${filePathForTheMessage}`
                this.increaseProgress(processPart)
                this.sendRequest();
                this.pagination = {currentPage: currentPage + 1}
            } while (this.DBRequestConfig.pagination.currentPage <= this.DBRequestConfig.pagination.totalPages);
            
            this.pagination = paginationDefault
            await delay()
            this.status = STATUS.PENDING_SUCCESS
        } catch (error) {
            this.throwError(error.message)
        }
    }
    
    async syncMainPreviewsFolders(progress = 0) {
        this.status = STATUS.PENDING;
        
        try {
            const dirNames = Object.keys(this.mainPreviewDirectories);
            const processPart = dirNames.length ? progress / dirNames.length : progress
            
            for (const dirName of dirNames) {
                const isDirExist = this.mainPreviewDirectories[dirName];
                if (!isDirExist) {
                    this.message = `sync main preview directories: ${dirName} ...`;
                    this.sendRequest();
                    await delay();
                    
                    const {modifiedCount} = await this.DBRemovePreview({targetFolder: dirName})
                    this.message = `sync main preview directories: ${dirName} - ${modifiedCount} files updated`;
                    this.increaseProgress(processPart)
                    this.sendRequest();
                    await delay();
                }
            }
            this.status = STATUS.PENDING_SUCCESS
        } catch (error) {
            this.throwError(error.message)
        }
    }
    
    async checkMainPreviewFolders(progress = 0) {
        this.status = STATUS.PENDING
        this.message = 'checking main previews folders on disc ...'
        this.increaseProgress(progress)
        this.sendRequest()
        await delay()
        
        /**
         * @param {{
         *     dirName,
         *     isExist
         * }[]} areFoldersExistArr
         */
        const setResults = (areFoldersExistArr) => (
            areFoldersExistArr.forEach(item => this.isMainPreviewDirectoryExist = item)
        )
        
        const areFoldersExistPromise = Object.keys(this.mainPreviewDirectories).map(dir => {
            this.infoLog('checkMainPreviewFolders', `${PREVIEWS_FOLDER}/${dir}`)
            return asyncCheckFolder(`${PREVIEWS_FOLDER}/${dir}`).then(result => ({
                dirName: dir,
                isExist: result
            }))
        })
        
        const areFoldersExistArr = await Promise.all(areFoldersExistPromise)
        this.infoLog('checkMainPreviewFolders', 'areFoldersExistArr', areFoldersExistArr)
        
        setResults(areFoldersExistArr)
        this.status = STATUS.PENDING_SUCCESS
    }
    
    /**
     *
     * @param {string} targetFolder
     * @returns {Promise<void>}
     * @constructor
     */
    async DBRemovePreview({targetFolder}) {
        return await this._DBInstance.collection.updateMany(
            {$expr: {$eq: [{$indexOfCP: [`$preview`, `/${targetFolder}/`]}, 0]}},
            {$set: {preview: ""}}
        )
    }
    
    /**
     *
     * @param {string} targetFolder
     * @param {boolean?} excludeSubdirectories
     * @returns {Promise<void>}
     * @constructor
     */
    async DBRequest({targetFolder, excludeSubdirectories} = {}) {
        const {areElementsWithPreview, pagination, usePagination} = this.DBRequestConfig
        const {currentPage, nPerPage} = pagination
        const conditionArr = []
        const responseWithPagination = [
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
        
        areElementsWithPreview && (conditionArr.push(
            {preview: {"$exists": true, "$ne": ""}}
        ))
        targetFolder && excludeSubdirectories && (conditionArr.push(
            DBRequests.getFilesExcludeFilesInSubfolders(targetFolder, 'preview')
        ))
        targetFolder && !excludeSubdirectories && (conditionArr.push(
            {$expr: {$eq: [{$indexOfCP: [`$preview`, `/${targetFolder}/`]}, 0]}}
        ))
        
        const aggregation = [
            {$match: {$and: conditionArr}},
            returningObject
        ]
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
        usePagination && response && response.length && (this.currentResults = response)
    }
    
    async getTotalDBElementsWithPreview(progress = 0) {
        this.status = STATUS.PENDING
        this.message = 'loading total elements with preview ...'
        this.increaseProgress(progress)
        this.sendRequest()
        
        await delay()
        try {
            await this.DBRequest()
            this.infoLog('getDBElementsWithPreviewCount', 'total elements with preview', this.config.totalCount)
            
            this.needTotal = false
            this.status = STATUS.PENDING_SUCCESS
        } catch (error) {
            this.throwError(error.message)
        }
    }
    
    async getPathsListFromDisc(progress = 0) {
        this.status = STATUS.PENDING
        this.message = 'loading directory list from Disc ...'
        this.increaseProgress(progress)
        this.sendRequest()
        
        await delay()
        try {
            const filesInRootDirectory = await this.getAllFoldersRecursively(PREVIEWS_FOLDER)
            this.pathsList = filesInRootDirectory.directoriesList
            this.infoLog('getAllFoldersRecursively', 'pathsList', this.pathsList)
            this.status = STATUS.PENDING_SUCCESS
        } catch (error) {
            this.throwError(error.message)
        }
    }
    
    async getAllFoldersRecursively(dirPath, filesInRootDirectory) {
        const files = await readdir(dirPath)
        
        filesInRootDirectory = filesInRootDirectory || {
            directoriesList: []
        }
        
        const filesResponse = files.map(async file => {
            const fileStat = await stat(dirPath + "/" + file)
            if (fileStat.isDirectory()) {
                filesInRootDirectory.directoriesList.push(dirPath + "/" + file)
                filesInRootDirectory = await this.getAllFoldersRecursively(dirPath + "/" + file, filesInRootDirectory)
            }
        })
        
        await Promise.all(filesResponse)
        
        return filesInRootDirectory
    }
    
    sendRequest() {
        const requestObject = {
            action: this.moduleName,
            data: {
                status: this.config.status,
                progress: this.config.progress,
                message: this.config.message,
            }
        }
        
        this.successLog('webSocket - sendRequest', requestObject)
        this._send(JSON.stringify(requestObject))
    }
}

module.exports = {SyncPreviews}
