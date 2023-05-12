const sharp = require('sharp');
const {POSTFIX} = require('../../constants');
const {isVideoDBFile, isHEICFile} = require('../common');
const {default: ThumbnailGenerator} = require('video-thumbnail-generator');
const {FilePathsStatic} = require('../filePathsStatic');
const {BasicClass} = require('../basicClass');
const {PreviewCreatorUtils} = require('./previewCreatorUtils');

class PreviewCreator extends BasicClass {
    _config = {
        width: 200,
        height: 200,
        quality: 80,
        timestamps: 0,
        thumbnailSize: '1000x?',
        isFullSize: false,
        postfix: POSTFIX.PREVIEW,
    }
    _photoProps = {
        fullSizeJpg: '',
        fullSizeJpgPath: '',
        preview: '',
        tempPath: '',
    }
    
    _file = {
        name: '',
        mimetype: ''
    }
    
    /**
     * @param {string} sourceFullName=mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe
     * @param {string} targetPreview=/image-heic/preview/2023.01.27-changeDate/test-IMG_6538-preview.jpg
     * @param {string} targetFullSizeJpeg=/image-heic/fullSize/2023.01.27-changeDate/test-IMG_6538-fullSize.jpg
     * @param {string} sourceBaseFolder=main/2020
     * @param {string} targetBaseFolder=image-heic/fullSize/2023.01.27-changeDate
     */
    _originalPaths = {
        sourceFullName: '',
        targetPreview: '',
        targetFullSizeJpeg: '',
        sourceBaseFolder: '',
        targetBaseFolder: '',
    }
    
    /**
     * Create preview from photo or video
     *
     /**
     * @param {object} params.filedata - Blob or database file object
     * @param {object?} params.filedata.mimetype=image/heic
     * @param {object?} params.filedata.type=image/heic
     * @param {'filedata'?} params.filedata.fieldname=filedata - to recognize BLOB
     * @param {string?} params.filedata.name=IMG_6649.heic - to recognize uploading object
     * @param {object?} params.filedata.originalname=test-IMG_6538.jpg
     *
     * @param {object} params.root - root directories for original and target files
     * @param {string?} params.root.original=uploadTemp - DATABASE_FOLDER_NAME | TEMP_FOLDER
     * @param {string?} params.root.originalPreview=uploadTemp - DATABASE_FOLDER_NAME | UPLOAD_TEMP_FOLDER | TEMP_FOLDER
     * @param {string?} params.root.target=/app/dataBase - DATABASE_FOLDER
     * @param {string?} params.root.targetPreview=/app/previews - PREVIEWS_FOLDER | UPLOAD_TEMP_FOLDER | TEMP_FOLDER
     *
     * @param {object?} params.config - configuration file
     * @param {number?} params.config.width
     * @param {number?} params.config.height
     * @param {number?} params.config.quality
     * @param {number | string?} params.config.timestamps
     * @param {string?} params.config.thumbnailSize
     */
    constructor(params) {
        super('PreviewCreator')
        
        const {filedata, root} = params
        
        const {filePathsWithoutRootDir, basePaths} = PreviewCreatorUtils.getPaths(filedata, root)
        
        this._staticPathInstance = new FilePathsStatic(filePathsWithoutRootDir, {
            source: root.original,
            preview: root.targetPreview
        })
        this._file = PreviewCreatorUtils.prepareFileData(filedata)
        this._originalPaths = basePaths
        params.config && this.setConfigSafely(params.config)
        
        this.successLog('PreviewCreator - constructor')
        this.infoLog('PreviewCreator', 'staticPathInstance', this._staticPathInstance)
        this.infoLog('PreviewCreator', 'file', this._file)
        this.infoLog('PreviewCreator', 'originalPaths', this._originalPaths)
        this.infoLog('PreviewCreator', 'config', this.config)
    }
    
    /**
     * @param {{
     *     width?: number,
     *     height?: number,
     *     quality?: number,
     *     timestamps?: string | number,
     *     thumbnailSize?: string,
     * }} config - configuration properties
     */
    setConfigSafely({
                        width,
                        height,
                        quality,
                        timestamps,
                        thumbnailSize,
                        useTempFolder,
                    }) {
        this._config = {
            ...this._config,
            ...(width && {width}),
            ...(height && {height}),
            ...(quality && {quality}),
            ...(timestamps && {timestamps}),
            ...(thumbnailSize && {thumbnailSize}),
            ...(useTempFolder && {useTempFolder})
        }
    }
    
    get staticPathInstance() {
        if (this._staticPathInstance) {
            return this._staticPathInstance
        } else {
            this.throwError(`The staticPathInstance has not yet been set, but is required for the method`, true)
        }
    }
    
    /**
     * @param {{
     *     width?: number,
     *     height?: number,
     *     quality?: number,
     *     timestamps?: string | number,
     *     thumbnailSize?: string,
     *     isFullSize?: boolean,
     *     postfix?: string,
     * }} config - configuration properties
     */
    set config(config) {
        this._config = {...this._config, ...config}
    }
    
    get config() {
        return this._config
    }
    
    /**
     * @param {{
     *     fullSizeJpg?: number,
     *     fullSizeJpgPath?: number,
     *     preview?: number,
     *     tempPath?: number,
     * }} props
     */
    set photoProps(props) {
        this._photoProps = {...this._photoProps, ...props}
    }
    
    get photoProps() {
        return this._photoProps
    }
    
    get file() {
        return this._file
    }
    
    get originalPaths() {
        return this._originalPaths
    }
    
    getFullFileName() {
        return this.config.isFullSize
            ? this.staticPathInstance.root.preview + this.originalPaths.targetFullSizeJpeg
            : this.staticPathInstance.root.preview + this.originalPaths.targetPreview
    }
    
    async createFullSizePreview() {
        this.config = {
            isFullSize: true,
        }
        
        await this.sharpPhoto()
        
        this.config = {
            isFullSize: false,
        }
    }
    
    async startProcess() {
        if (isHEICFile(this.file)) {
            await this.createFullSizePreview()
        }
        
        if (isVideoDBFile(this.file)) {
            await this.makeVideoThumbnail()
        } else {
            await this.sharpPhoto()
        }
        
        this.successLog('startProcess', this.photoProps)
        return {result: this.photoProps}
    }
    
    async makeVideoThumbnail() {
        const tg = new ThumbnailGenerator({
            sourcePath: this.originalPaths.sourceFullName,
            thumbnailPath: `${this.staticPathInstance.root.preview}/${this.originalPaths.targetBaseFolder}/`,
        });
        
        await tg.generate({
            // timestamps: ['5%'],
            // timestamps: ['01:30.000'],
            timestamps: [this.config.timestamps],
            size: this.config.thumbnailSize
        })
            .then((preview) => {
                const photoProps = {
                    preview: this.staticPathInstance.getThumbnailStaticPath(preview[0]),
                    tempPath: this.originalPaths.sourceFullName,
                }
                this.successLog('ThumbnailGenerator', preview)
                this._photoProps = photoProps
            })
            .catch(err => this.throwError(err.message));
    }
    
    async sharpPhoto() {
        const fileToSharp = this.getPathToJPEGIfPossible()
        
        const sharpObject = sharp(fileToSharp)
            .withMetadata()
            .clone()
        
        const resizedObject = this.config.isFullSize
            ? sharpObject
            : sharpObject
                .resize(this.config.width, this.config.height, {fit: 'outside'})
        
        await resizedObject
            .jpeg({quality: this.config.quality})
            .toFile(this.getFullFileName())
            .then(() => {
                const photoProps = this.config.isFullSize
                    ? {
                        fullSizeJpg: this.staticPathInstance.getFullSizeJPEGStaticPath(),
                        fullSizeJpgPath: this.getFullFileName()
                    }
                    : {
                        preview: this.staticPathInstance.getPreviewStaticPath(),
                        tempPath: this.originalPaths.sourceFullName,
                    }
                this.successLog('Sharp', this.file.name)
                this.photoProps = photoProps
            })
            .catch(err => this.throwError(err.message));
    }
    
    getPathToJPEGIfPossible() {
        const fullName = this.photoProps.fullSizeJpgPath || this.originalPaths.sourceFullName
        this.infoLog('fullName for sharping', fullName)
        return fullName
    }
}

module.exports = {PreviewCreator}
