const {DATABASE_FOLDER, IMAGE_EXTENSIONS, POSTFIX} = require('../constants');
const {pickExtension, removeFileExt, asyncMoveFile, asyncCheckFolder} = require('../utils/common');
const {BasicClass} = require('./basicClass');

class FilePathsBasic extends BasicClass {
    _previewPostfix = {
        fullSize: POSTFIX.FULL_SIZE,
        preview: POSTFIX.PREVIEW,
    }
    _root = {
        original: '',
        originalPreview: '',
        target: '',
        targetPreview: '',
    }
    _basePathWithoutRootDirectory = ''
    
    /**
     *
     * @param {string} moduleName - used for logger
     *
     * @param {object} root - root directories for original and target files
     * @param {string?} root.original=uploadTemp - DATABASE_FOLDER_NAME | TEMP_FOLDER
     * @param {string?} root.originalPreview=uploadTemp - DATABASE_FOLDER_NAME | UPLOAD_TEMP_FOLDER | TEMP_FOLDER
     * @param {string?} root.target=/app/dataBase - DATABASE_FOLDER
     * @param {string?} root.targetPreview=/app/dataBase - PREVIEWS_FOLDER | UPLOAD_TEMP_FOLDER | TEMP_FOLDER
     *
     * @param {string} basePathWithoutRootDirectory - "main/2020" (example)
     */
    constructor(moduleName, root, basePathWithoutRootDirectory = '') {
        super(moduleName)
        
        this._moduleName = moduleName || 'FilePathsBasic'
        this.successLog('FilePathsBasic init - moduleName')
    
        if (!root) {
            const errorMessage = 'root is required parameter'
            this.errorLog(errorMessage)
            this.throwError(errorMessage)
        }
        this._root = root
        this._basePathWithoutRootDirectory = basePathWithoutRootDirectory
        
        this.successLog('FilePathsBasic init - root', root)
        this.successLog('FilePathsBasic init - basePathWithoutRootDirectory', basePathWithoutRootDirectory)
    }
    
    get previewPostfix() {
        return this._previewPostfix
    }
    
    get root() {
        return this._root
    }
    
    /**
     * @return {string} - example: "main/2020"
     */
    get basePathWithoutRootDirectory() {
        if (this._basePathWithoutRootDirectory) {
            return this._basePathWithoutRootDirectory
        } else {
            this.throwError(
                `variable "basePathWithoutRootDirectory" has not yet been set, but is required for the method`,
                true
            )
        }
    }
    
    getOriginalFileBasePath() {
        return this.root.original === DATABASE_FOLDER
            ? `${this.basePathWithoutRootDirectory}/`
            : ''
    }
    
    getOriginalPreviewBasePath() {
        return this.root.originalPreview === DATABASE_FOLDER
            ? `${this.basePathWithoutRootDirectory}/`
            : ''
    }
    
    /**
     * Get full path for originalFile:
     * root directory + basePathWithoutRootDirectory + file name
     *
     * @param {string} name - fileName.ext
     * @return {string} - /app/database/main/2022/fileName.ext
     */
    getOriginalFileFullPath(name) {
        return `${this.root.original}/${this.getOriginalFileBasePath()}${name}`
    }
    
    /**
     * Get preview or full size preview name with extension
     *
     * @param {string} name - file name
     * @param {boolean} isFullSize
     * @param {string?} thumbnailName
     * @return {string} - 74923089ced5c27bff56d3aa063a200f-preview.jpg
     */
    getPreviewName(name, isFullSize, thumbnailName) {
        if (thumbnailName) return thumbnailName
        
        const getExtension = (name) => {
            const originalExtension = pickExtension(name)
            const targetExtension = originalExtension === IMAGE_EXTENSIONS.HEIC
                ? IMAGE_EXTENSIONS.JPG
                : originalExtension
            
            return targetExtension || IMAGE_EXTENSIONS.JPG
        }
        
        const extension = getExtension(name)
        const fileNameWithoutExt = removeFileExt(name)
        const postfix = isFullSize ? this.previewPostfix.fullSize : this.previewPostfix.preview
        
        return `${fileNameWithoutExt}-${postfix}.${extension}`
    }
    
    /**
     * Get full path for originalPreview or originalFullSizeJpeg:
     * root directory + basePathWithoutRootDirectory + file name + postfix + ext
     *
     * @param {string} name - file name
     * @param {boolean} isFullSize
     * @param {string?} thumbnailName
     * @return {string} - uploadTemp/74923089ced5c27bff56d3aa063a200f-preview.jpg
     */
    getOriginalPreviewFullPath(name, isFullSize, thumbnailName) {
        return (
            `${this.root.originalPreview}/${this.getOriginalPreviewBasePath()}${this.getPreviewName(name, isFullSize, thumbnailName)}`
        )
    }
    
    /**
     * Get full target file without root directory
     *
     * @param {string} name - fileName.ext
     * @return {string} /main/2022/fileName.ext
     */
    getTargetFilePathWithoutRootDir(name) {
        const slash = this.basePathWithoutRootDirectory.startsWith('/') ? '' : '/'
        return `${slash}${this.basePathWithoutRootDirectory}/${name}`
    }
    
    /**
     * @param {string} normalizedFileType "image-jpeg" (without "/")
     * @param {string} fileSizeName "preview"
     * @param {string} date "2022.06.09 - changeDate"
     * @return {string} example - "image-jpeg/preview/2022.06.09 - changeDate"
     */
    getPreviewFullFolderName(normalizedFileType, fileSizeName, date) {
        return `${normalizedFileType}/${fileSizeName}/${date}`
    }
    
    /**
     * Move file to the new directory. Return rejected promise if something go wrong
     *
     * @param {string} originalLocation
     * @param {string} targetLocation
     * @return {Promise<string | Error>}
     */
    async changeFileLocation(originalLocation, targetLocation) {
        return await asyncMoveFile(originalLocation, targetLocation)
    }
    
    /**
     * Check target directory.
     * If the same file is already exist in that directory,
     * rejected promise will be returned
     *
     * @param {string} filePath - full filename for checking
     * @return {Promise<boolean>}
     */
    async checkIfFilePathExist(filePath) {
        return await asyncCheckFolder(filePath)
    }
}

module.exports = {FilePathsBasic}
