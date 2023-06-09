import {DBController, DBRequests} from '../../utils/DBController';
import {BasicClass} from '../../utils/basicClass';
import {createPreviewAndAddLinkToDB} from '../../utils/previewCreator/createPreviewAndAddLinkToDB';

const STATUS = {
    DEFAULT: 'default',
    INIT: 'init',
    PENDING: 'pending',
    PENDING_SUCCESS: 'pending-success',
    PENDING_ERROR: 'pending-error',
    STOPPED: 'stopped',
    DONE: 'done',
    ERROR: 'error'
}
const COMMON_DELAY = 1000
const delay = ms => new Promise(res => setTimeout(res, ms || COMMON_DELAY))

const paginationDefault = {
    currentPage: 1,
    nPerPage: 1,
    resultsCount: 0,
    totalPages: 0,
}

export class CreatePreviews extends BasicClass {
    _processWasStopped = false
    _folderPath = undefined
    _mimeTypes = []
    _moduleName = undefined
    _DBInstance = undefined
    _send = undefined
    _config = {
        status: STATUS.DEFAULT,
        progress: 0,
        totalCount: 0,
        currentCount: 0,
        message: '',
    }
    _DBRequestConfig = {
        areElementsWithPreview: false,
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
     * @param {{folderPath: string, mimeTypes: string[]}} data
     */
    constructor(locals, send, data) {
        const moduleName = 'CREATE_PREVIEWS'
        super(moduleName)
        this._folderPath = data.folderPath
        this._mimeTypes = data.mimeTypes
        this._moduleName = moduleName
        
        this._DBInstance = new DBController()
        this._DBInstance.DBCollection = locals.collection
        this._DBInstance.DBConfigCollection = locals.configCollection
        this._send = send
        this.successLog('CreatePreviews - constructor init')
    }
    
    increaseProgress(progress) {
        this.config.progress = this.config.progress + progress
    }
    
    get processWasStopped() {
        return this._processWasStopped
    }
    
    get folderPath() {
        return this._folderPath
    }
    
    get mimeTypes() {
        return this._mimeTypes
    }
    
    get DBRequestConfig() {
        return this._DBRequestConfig
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
    
    /**
     * @param {string} status - status from STATUS object
     */
    set status(status) {
        this.config.status = status
    }
    
    get status() {
        return this.config.status
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
                this.message = 'Preview creation is complete'
            })
            .catch(error => {
                if (this.status !== STATUS.STOPPED) this.status = STATUS.ERROR
                this.message = error.message
                this.infoLog('Error caught', `STATUS: ${this.status}`)
                this._processWasStopped = false
            })
            .finally(() => {
                this.sendRequest()
            })
    }
    
    stopProcess() {
        this._processWasStopped = true
    }
    
    async processChaining() {
        await this.getFileFromDBAndCreatePreview(100)
    }
    
    async getFileFromDBAndCreatePreview(process = 0) {
        this.status = STATUS.PENDING
        this.message = 'loading previews list from DB ...'
        this.sendRequest()
        await delay()
        
        try {
            let curTotalPages = 0
            let curPage = 1
            
            do {
                this.DBRequestConfig
                await this.DBRequest();
                await createPreviewAndAddLinkToDB({
                    res: undefined,
                    filteredPhotos: this.DBRequestConfig.currentResults,
                    isFullSizePreview: false,
                    dontSavePreview: false,
                    req: {
                        app: {
                            locals: {
                                collection: this._DBInstance.collection,
                                configCollection: this._DBInstance.configCollection
                            }
                        }
                    }
                })
                
                const filePathForTheMessage = this.DBRequestConfig.currentResults[0]
                    ? this.DBRequestConfig.currentResults[0].originalName
                    : ''
                const {totalPages} = this.DBRequestConfig.pagination;
                if (!curTotalPages) curTotalPages = totalPages
                const processPart = totalPages ? process / curTotalPages : 0
                
                this.message = `creating preview for the file (${curPage} from ${curTotalPages}): ${filePathForTheMessage}`
                this.increaseProgress(processPart)
                this.sendRequest();
                ++curPage
            } while (curPage <= curTotalPages);
            
            this.pagination = paginationDefault
            await delay()
            this.status = STATUS.PENDING_SUCCESS
        } catch (error) {
            this.throwError(error.message)
        }
    }
    
    /**
     *
     * @param {string} preview
     * @param {boolean?} excludeSubdirectories
     * @returns {Promise<void>}
     * @constructor
     */
    async DBRequest({preview, excludeSubdirectories} = {}) {
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
        !areElementsWithPreview && (conditionArr.push(
            { $or: [{ "preview": { $exists: false } }, { "preview": "" }] }
        ))
        preview && excludeSubdirectories && (conditionArr.push(
            DBRequests.getFilesExcludeFilesInSubfolders(preview, 'preview')
        ))
        preview && !excludeSubdirectories && (conditionArr.push(
            {$expr: {$eq: [{$indexOfCP: ['$preview', `/${preview}/`]}, 0]}}
        ))
        this.folderPath && (conditionArr.push(
            {$expr: {$eq: [{$indexOfCP: ['$filePath', `/${this.folderPath}/`]}, 0]}}
        ))
        if (this.mimeTypes.length) {
            const mimeTypeObjArr = this.mimeTypes.map(type => ({mimetype: type}))
            conditionArr.push({$or: mimeTypeObjArr})
        }
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
        this.currentResults = response
    }
    
    sendRequest() {
        if (this.processWasStopped) {
            this.status = STATUS.STOPPED
            this.throwError('Process was stopped')
        }
        
        const requestObject = {
            action: this.moduleName,
            data: {
                status: this.config.status,
                progress: Math.round(this.config.progress),
                message: this.config.message,
            }
        }
        
        this.successLog('webSocket - sendRequest', requestObject)
        this._send(JSON.stringify(requestObject))
    }
}
