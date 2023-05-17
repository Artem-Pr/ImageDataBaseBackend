const {
    PORT,
    TEMP_FOLDER,
    UPLOAD_TEMP_FOLDER,
    IMAGES_TEMP_FOLDER,
    UPLOAD_IMAGES_TEMP_FOLDER,
    DATABASE_FOLDER,
    DATABASE_FOLDER_NAME,
    PREVIEWS_FOLDER,
    PREVIEWS_FOLDER_NAME,
} = require('../constants');

class FilePathsStatic {
    _host = `http://localhost:${PORT}`
    _static = {
        [TEMP_FOLDER]: IMAGES_TEMP_FOLDER,
        [UPLOAD_TEMP_FOLDER]: UPLOAD_IMAGES_TEMP_FOLDER,
        [DATABASE_FOLDER]: DATABASE_FOLDER_NAME,
        [PREVIEWS_FOLDER]: PREVIEWS_FOLDER_NAME,
    }
    _root = {
        source: '',
        preview: '',
    }
    _filePathsWithoutRootDir = {
        sourceFullName: '',
        previewFullName: '',
        fullSizeJpgFullName: '',
    }
    
    /**
     * Create static fileNames from root folder names and base folder paths
     *
     * @param {object} filePathsWithoutRootDir
     * @param {string} filePathsWithoutRootDir.sourceFullName=/main/IMG_20220704_230754.jpeg
     * @param {string} filePathsWithoutRootDir.previewFullName=/IMG_20220704_230754-preview.jpeg
     * @param {string} filePathsWithoutRootDir.fullSizeJpgFullName=/image-heic/fullSize/2023.01.27-changeDate/test-IMG_6538-fullSize.jpg
     *
     * @param {object} root
     * @param {string} root.source=/app/dataBase TEMP_FOLDER | UPLOAD_TEMP_FOLDER | DATABASE_FOLDER | PREVIEWS_FOLDER
     * @param {string} root.preview=/app/previews TEMP_FOLDER | UPLOAD_TEMP_FOLDER | DATABASE_FOLDER | PREVIEWS_FOLDER
     */
    constructor(filePathsWithoutRootDir, root) {
        this._filePathsWithoutRootDir = filePathsWithoutRootDir
        this._root = root
    }
    
    get root() {
        return this._root
    }
    
    getOriginalStaticPath() {
        return this._filePathsWithoutRootDir.sourceFullName
            ? `${this._host}/${this._static[this._root.source]}${this._filePathsWithoutRootDir.sourceFullName}`
            : ''
    }
    
    getPreviewStaticPath() {
        return this._filePathsWithoutRootDir.previewFullName
            ? `${this._host}/${this._static[this._root.preview]}${this._filePathsWithoutRootDir.previewFullName}`
            : ''
    }
    
    getFullSizeJPEGStaticPath() {
        return this._filePathsWithoutRootDir.fullSizeJpgFullName
            ? `${this._host}/${this._static[this._root.preview]}${this._filePathsWithoutRootDir.fullSizeJpgFullName}`
            : ''
    }
    
    /**
     * @param {string} thumbnailName - cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png
     * @return {string}
     */
    getThumbnailStaticPath(thumbnailName) {
        return `${this._host}/${this._static[this._root.preview]}/${thumbnailName}`
    }
}

module.exports = {FilePathsStatic}
