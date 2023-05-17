const {dateToString, isHEICFile} = require('../common');
const moment = require('moment');
const {dateTimeFormat, dateFormat} = require('../dateFormat');
const {FilePathsBasic} = require('../filePathsBasic');
const {PREVIEWS_FOLDER, useHashForPreviewName} = require('../../constants');
const {FilePathsManagerUtils} = require('./filePathsManagerUtils');

class FilePathsManager extends FilePathsBasic {
    _filedata = {
        changeDate: null,
        originalDate: '-',
        targetName: '',
        originalName: '',
        thumbnailName: '',
        mimetype: '',
        isFullSizeJpgPath: false,
        hashName: '',
    }
    /**
     * @type {{
     *   targetFile: {
     *     isExist: undefined | boolean | Promise<boolean>,
     *     isSuccessfullyMoved: undefined | boolean | Promise<boolean>,
     *   },
     *   targetPreview: {
     *     isExist: undefined | boolean | Promise<boolean>,
     *     isSuccessfullyMoved: undefined | boolean | Promise<boolean>,
     *   },
     *   targetFullSizeJpeg: {
     *     isExist: undefined | boolean | Promise<boolean>,
     *     isSuccessfullyMoved: undefined | boolean | Promise<boolean>,
     *   },
     *   filesSummary: {
     *     isSomeTargetExist: undefined | boolean | Promise<boolean>,
     *     allMoved: undefined | boolean | Promise<boolean>,
     *   }}},
     * @private
     */
    _filesStatuses = {
        targetFile: {
            isExist: undefined,
            isSuccessfullyMoved: undefined,
        },
        targetPreview: {
            isExist: undefined,
            isSuccessfullyMoved: undefined,
        },
        targetFullSizeJpeg: {
            isExist: undefined,
            isSuccessfullyMoved: undefined,
        },
        filesSummary: {
            isSomeTargetExist: undefined,
            allMoved: undefined,
        }
    }
    
    /**
     * @param {object} filedata - Blob, DB or uploading file object
     * @param {'filedata'?} filedata.fieldname=filedata
     * @param {string?} filedata.name=IMG_6649.heic - uploading object name
     * @param {string?} filedata.originalname=test-IMG_6538.jpg - Blob object name
     * @param {string?} filedata.originalName=IMG_6649.heic - DB object name
     *
     * @param {object} root - root directories for original and target files
     * @param {string?} root.original=uploadTemp - DATABASE_FOLDER_NAME | TEMP_FOLDER
     * @param {string?} root.originalPreview=uploadTemp - DATABASE_FOLDER_NAME | UPLOAD_TEMP_FOLDER | TEMP_FOLDER
     * @param {string?} root.target=/app/dataBase - DATABASE_FOLDER
     * @param {string?} root.targetPreview=/app/previews - PREVIEWS_FOLDER | UPLOAD_TEMP_FOLDER | TEMP_FOLDER
     *
     * @param {string} basePathWithoutRootDirectory - target basePath: "main/2020" (example).
     * @param {string?} hashName='74923089ced5c27bff56d3aa063a200f'
     */
    constructor(filedata, root, basePathWithoutRootDirectory, hashName) {
        super('FilePathsManager', root, basePathWithoutRootDirectory);
    
        const preparedFiledata = FilePathsManagerUtils.prepareFileData(filedata)
        this.saveFiledata(preparedFiledata, hashName)
        
        this.successLog('FilePathsManager init - filedata', preparedFiledata)
    }
    
    /**
     * @param {object} filedata
     * @param {number?} filedata.changeDate=1654774720420 (example).
     * @param {string | '-'?} filedata.originalDate - 2023.01.16 17:23 (example).
     * @param {string} filedata.targetName=IMG_6649.mp4 (example).
     * @param {string} filedata.originalName=74923089ced5c27bff56d3aa063a200f (+ subdirectories and .ext if needed)
     * @param {string?} filedata.thumbnailName=74923089ced5c27bff56d3aa063a200f-thumbnail-1000x562-0001.png (example).
     * @param {string} filedata.mimetype=image/heic (example).
     *
     * @param {string?} hashName='74923089ced5c27bff56d3aa063a200f'
     */
    saveFiledata(filedata, hashName) {
        const isFullSizeJpgPath = isHEICFile(filedata)
        const originalDate = filedata.originalDate || '-'
        const changeDate = filedata.changeDate || Date.now()
        this._filedata = {
            ...this._filedata,
            ...filedata,
            changeDate,
            originalDate,
            isFullSizeJpgPath,
            hashName: useHashForPreviewName ? hashName : ''
        }
    }
    
    get filedata() {
        if (this._filedata) {
            return this._filedata
        } else {
            this.throwError(`The filedata has not yet been set, but is required for the method`, true)
        }
    }
    
    get fullPathsObj() {
        if (this._fullPathsObj) {
            return this._fullPathsObj
        } else {
            this.throwError(`The fullPathsObj has not yet been set, but is required for the method`, true)
        }
    }
    
    get basePaths() {
        if (this._basePaths) {
            return this._basePaths
        } else {
            this.throwError(`The basePaths has not yet been set, but is required for the method`, true)
        }
    }
    
    /**
     * Returns preview folder name depends on originalDate
     *
     * @param {boolean?} isFullSize
     * @return {string} preview folder name - "image-jpeg/preview/2022.06.09 - changeDate"
     */
    getStringDateFolderName(isFullSize) {
        const {originalDate, changeDate, mimetype} = this.filedata
        
        try {
            const folderDependsOnSize = Boolean(isFullSize)
                ? this.previewPostfix.fullSize
                : this.previewPostfix.preview
            
            const dateFolderName = originalDate === '-'
                ? dateToString(changeDate, true) + ' - changeDate'
                : moment(originalDate, dateTimeFormat).format(dateFormat) + ' - originalDate'
            
            const normalizedType = mimetype.replace('/', '-')
            
            return this.getPreviewFullFolderName(normalizedType, folderDependsOnSize, dateFolderName)
        } catch (err) {
            this.throwError(`getStringDateFolderName - ${err}`)
        }
    }
    
    /**
     * Returns base path for targetPreview or targetFullSizeJpeg
     * depends on root folder
     *
     * @param {boolean} isFullSize
     * @return {string} preview base path - "image-jpeg/preview/2022.06.09 - changeDate" or ""
     */
    getTargetPreviewBasePath(isFullSize) {
        return this.root.targetPreview === PREVIEWS_FOLDER
            ? `${this.getStringDateFolderName(isFullSize)}/`
            : ''
    }
    
    // TODO: пока не используется
    getThumbnailName() {
        const {hashName, thumbnailName} = this.filedata
        const getHashName = () => {
            const [_name, postfix] = thumbnailName.split('-thumbnail-')
            return `${hashName}-thumbnail-${postfix}`
        }
        const currentName = useHashForPreviewName ? getHashName() : thumbnailName
        this.infoLog('getThumbnailName', 'currentName', currentName)
        
        return `/${this.getTargetPreviewBasePath(false)}${currentName}`
    }
    
    /**
     * Returns full preview or full fullSize path without root directory
     *
     * @param {boolean?} isFullSize
     * @return {string} preview path without root dir  -
     * "/image-jpeg/preview/2022.06.09 - changeDate/fileName-fullSize.jpg"
     * or "/fileName-fullSize.jpg"
     * or ""
     */
    getPreviewPathWithoutRootDir(isFullSize) {
        const {isFullSizeJpgPath, targetName, hashName, thumbnailName} = this.filedata
        
        if (isFullSize && !isFullSizeJpgPath) return ''
    
        if (thumbnailName) return `/${this.getTargetPreviewBasePath(false)}${thumbnailName}`
        
        const currentName = useHashForPreviewName ? hashName : targetName
        return `/${this.getTargetPreviewBasePath(isFullSize)}${this.getPreviewName(currentName, isFullSize)}`
    }
    
    createAllFullPathsForTheFile() {
        try {
            const {
                isFullSizeJpgPath,
                targetName,
                originalName,
                thumbnailName,
            } = this.filedata
            
            
            const originalFullSizeJpeg = isFullSizeJpgPath
                ? this.getOriginalPreviewFullPath(originalName, true)
                : ''
            
            const targetFilePath = this.root.target ? this.getTargetFilePathWithoutRootDir(targetName) : ''
            const targetFullSizeJpegPath = this.root.targetPreview ? this.getPreviewPathWithoutRootDir(true) : ''
            const targetPreviewPath = this.root.targetPreview ? this.getPreviewPathWithoutRootDir(false) : ''
            
            this._fullPathsObj = {
                originalFile: this.root.original ? this.getOriginalFileFullPath(originalName) : '',
                originalFullSizeJpeg: this.root.originalPreview ? originalFullSizeJpeg : '',
                originalPreview: this.root.originalPreview ? this.getOriginalPreviewFullPath(originalName, false, thumbnailName) : '',
                targetFile: targetFilePath,
                targetFullSizeJpeg: targetFullSizeJpegPath,
                targetPreview: targetPreviewPath,
                fullPathTargetFile: targetFilePath ? `${this.root.target}${targetFilePath}` : '',
                fullPathTargetFullSizeJpeg: targetFullSizeJpegPath ? `${this.root.targetPreview}${targetFullSizeJpegPath}` : '',
                fullPathTargetPreview: targetPreviewPath ? `${this.root.targetPreview}${targetPreviewPath}` : '',
            }
            this._basePaths = {
                originalFile: this.fullPathsObj.originalFile ? this.getOriginalFileBasePath() : '',
                originalPreview: this.fullPathsObj.originalFullSizeJpeg ? this.getOriginalPreviewBasePath() : '',
                targetFile: this.fullPathsObj.targetFile ? this.basePathWithoutRootDirectory : '',
                targetPreview: this.fullPathsObj.targetPreview ? this.getTargetPreviewBasePath(false): '',
                targetFullSizeJpeg: this.fullPathsObj.targetFullSizeJpeg ? this.getTargetPreviewBasePath(true): '',
            }
            this.successLog('createAllFullPathsForTheFile', this._fullPathsObj)
            
            return {
                checkTargetDirectories: () => this.checkTargetDirectories(),
                fullPathsObj: this.fullPathsObj,
                basePaths: this.basePaths
            }
        } catch (err) {
            this.throwError(`createAllFullPathsForTheFile - ${err}`)
        }
    }
    
    checkIfTargetFileIsExist() {
        this._filesStatuses.targetFile.isExist = this.checkIfFilePathExist(this.fullPathsObj.fullPathTargetFile)
        this._filesStatuses.targetFile.isExist.then((response) => {
            this.infoLog('this._filesStatuses.targetFile.isExist', response.toString(), this.fullPathsObj.fullPathTargetFile)
        })
    }
    
    checkIfTargetPreviewIsExist() {
        this._filesStatuses.targetPreview.isExist = this.checkIfFilePathExist(this.fullPathsObj.fullPathTargetPreview)
        this._filesStatuses.targetPreview.isExist.then((response) => {
            this.infoLog('this._filesStatuses.targetPreview.isExist', response.toString(), this.fullPathsObj.fullPathTargetPreview)
        })
    }
    
    checkIfTargetFullSizeJpegIsExist() {
        this._filesStatuses.targetFullSizeJpeg.isExist = this.checkIfFilePathExist(this.fullPathsObj.fullPathTargetFullSizeJpeg)
        this._filesStatuses.targetFullSizeJpeg.isExist.then((response) => {
            this.infoLog('this._filesStatuses.targetFullSizeJpeg.isExist', response.toString(), this.fullPathsObj.fullPathTargetFullSizeJpeg)
        })
    }
    
    checkTargetDirectories() {
        this.checkIfTargetFileIsExist()
        this.checkIfTargetFullSizeJpegIsExist()
        this.checkIfTargetPreviewIsExist()
        
        this._filesStatuses.filesSummary.isSomeTargetExist = Promise.all([
            this._filesStatuses.targetFile.isExist,
            this._filesStatuses.targetPreview.isExist,
            this._filesStatuses.targetFullSizeJpeg.isExist
        ]).then((response) => {
            const isSomeTargetExist = response.reduce((accum, current) => accum || current)
            this.infoLog('this._filesStatuses.filesSummary.isSomeTargetExist', isSomeTargetExist.toString())
            return isSomeTargetExist
        })
        
        return {
            safelyMoveTargetFile: () => this.safelyMoveTargetFile(),
            safelyMoveTargetFullSizeJpeg: () => this.safelyMoveTargetFullSizeJpeg(),
            safelyMoveTargetPreview: () => this.safelyMoveTargetPreview(),
            combineResults: () => this.combineResults(),
        }
    }
    
    safelyMoveTargetFile() {
        if (this.fullPathsObj.originalFile && this.fullPathsObj.fullPathTargetFile) {
            const checkAllFiles = this._filesStatuses.filesSummary.isSomeTargetExist !== undefined
            const checkIfExist = checkAllFiles
                ? this._filesStatuses.filesSummary.isSomeTargetExist
                : this._filesStatuses.targetFile.isExist
            
            checkIfExist
                .then((isExist) => {
                    if (isExist) {
                        return Promise.reject(new Error(checkAllFiles ? 'Target is exist' : 'TargetFile is exist'))
                    } else {
                        this._filesStatuses.targetFile.isSuccessfullyMoved =
                            this.changeFileLocation(this.fullPathsObj.originalFile, this.fullPathsObj.fullPathTargetFile)
                        return this._filesStatuses.targetFile.isSuccessfullyMoved
                    }
                })
                .catch((err) => {
                    this.errorLog('safelyMoveTargetFile', err.message)
                    this.throwError(err.message)
                })
        } else {
            this.infoLog('safelyMoveTargetFile skipped', undefined, {
                originalFile: this.fullPathsObj.originalFile,
                fullPathTargetFile: this.fullPathsObj.fullPathTargetFile,
            })
            this._filesStatuses.targetFile.isSuccessfullyMoved = true
        }
        
        return {
            safelyMoveTargetFullSizeJpeg: () => this.safelyMoveTargetFullSizeJpeg(),
            safelyMoveTargetPreview: () => this.safelyMoveTargetPreview(),
            combineResults: () => this.combineResults()
        }
    }
    
    safelyMoveTargetFullSizeJpeg() {
        if (this.fullPathsObj.originalFullSizeJpeg && this.fullPathsObj.fullPathTargetFullSizeJpeg) {
            const checkAllFiles = this._filesStatuses.filesSummary.isSomeTargetExist !== undefined
            const checkIfExist = checkAllFiles
                ? this._filesStatuses.filesSummary.isSomeTargetExist
                : this._filesStatuses.targetFullSizeJpeg.isExist
            
            checkIfExist
                .then((isExist) => {
                    if (isExist) {
                        return Promise.reject(new Error(checkAllFiles ? 'Target is exist' : 'targetFullSizeJpeg is exist'))
                    } else {
                        this._filesStatuses.targetFullSizeJpeg.isSuccessfullyMoved =
                            this.changeFileLocation(this.fullPathsObj.originalFullSizeJpeg, this.fullPathsObj.fullPathTargetFullSizeJpeg)
                        return this._filesStatuses.targetFullSizeJpeg.isSuccessfullyMoved
                    }
                })
                .catch((err) => {
                    this.errorLog('safelyMoveTargetFullSizeJpeg', err.message)
                    this.throwError(err.message)
                })
        } else {
            this.infoLog('safelyMoveTargetFullSizeJpeg skipped', undefined, {
                originalFullSizeJpeg: this.fullPathsObj.originalFullSizeJpeg,
                fullPathTargetFullSizeJpeg: this.fullPathsObj.fullPathTargetFullSizeJpeg,
            })
            this._filesStatuses.targetFile.isSuccessfullyMoved = true
        }
        
        return {
            safelyMoveTargetFile: () => this.safelyMoveTargetFile(),
            safelyMoveTargetPreview: () => this.safelyMoveTargetPreview(),
            combineResults: () => this.combineResults()
        }
    }
    
    safelyMoveTargetPreview() {
        if (this.fullPathsObj.originalPreview && this.fullPathsObj.fullPathTargetPreview) {
            const checkAllFiles = this._filesStatuses.filesSummary.isSomeTargetExist !== undefined
            const checkIfExist = checkAllFiles
                ? this._filesStatuses.filesSummary.isSomeTargetExist
                : this._filesStatuses.targetPreview.isExist
            
            checkIfExist
                .then((isExist) => {
                    if (isExist) {
                        return Promise.reject(new Error(checkAllFiles ? 'Target is exist' : 'targetPreview is exist'))
                    } else {
                        this._filesStatuses.targetPreview.isSuccessfullyMoved =
                            this.changeFileLocation(this.fullPathsObj.originalPreview, this.fullPathsObj.fullPathTargetPreview)
                        return this._filesStatuses.targetPreview.isSuccessfullyMoved
                    }
                })
                .catch((err) => {
                    this.errorLog('safelyMoveTargetPreview', err.message)
                    this.throwError(err.message)
                })
        } else {
            this.infoLog('safelyMoveTargetPreview skipped', undefined, {
                originalPreview: this.fullPathsObj.originalPreview,
                fullPathTargetPreview: this.fullPathsObj.fullPathTargetPreview,
            })
            this._filesStatuses.targetFile.isSuccessfullyMoved = true
        }
        
        return {
            safelyMoveTargetFile: () => this.safelyMoveTargetFile(),
            safelyMoveTargetFullSizeJpeg: () => this.safelyMoveTargetFullSizeJpeg(),
            combineResults: () => this.combineResults()
        }
    }
    
    combineResults() {
        const checkDirectoriesIsExist = this._filesStatuses.filesSummary.isSomeTargetExist !== undefined
            ? this._filesStatuses.filesSummary.isSomeTargetExist
            : Promise.all([
                this._filesStatuses.targetFile.isExist,
                this._filesStatuses.targetPreview.isExist,
                this._filesStatuses.targetFullSizeJpeg.isExist,
            ])
        
        const successfullyMovedFiles = checkDirectoriesIsExist.then(async () => {
            const movingResult = await Promise.all([
                this._filesStatuses.targetFile.isSuccessfullyMoved,
                this._filesStatuses.targetPreview.isSuccessfullyMoved,
                this._filesStatuses.targetFullSizeJpeg.isSuccessfullyMoved,
            ])
            
            const preparedResults = {
                targetFile: movingResult[0] && this.fullPathsObj.targetFile,
                targetPreview: movingResult[1] && this.fullPathsObj.targetPreview,
                targetFullSizeJpeg: movingResult[2] && this.fullPathsObj.targetFullSizeJpeg,
            }
            this.infoLog('combineResults', 'movingResult', preparedResults)
            
            return preparedResults
        })
        
        return {
            checkDirectoriesIsExist: () => checkDirectoriesIsExist,
            getSuccessfullyMovedFiles: () => successfullyMovedFiles
        }
    }
}

module.exports = {FilePathsManager}
