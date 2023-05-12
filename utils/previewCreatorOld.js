const sharp = require('sharp');
const {PORT, UPLOAD_IMAGES_TEMP_FOLDER, UPLOAD_TEMP_FOLDER} = require('../constants');
const {isVideoDBFile, isHEICFile} = require('./common');
const {default: ThumbnailGenerator} = require('video-thumbnail-generator');
const {FilePathsBasic} = require('./filePathsBasic');
const {FilePathsStatic} = require('./filePathsStatic');

class PreviewCreator extends FilePathsBasic, FilePathsStatic {
    _config = {
        width: 200,
        height: 200,
        quality: 80,
        timestamps: 0,
        thumbnailSize: '1000x?',
        isFullSize: false,
        postfix: this.previewPostfix.preview,
        useTempFolder: false
    }
    _photoProps = {
        fullSizeJpg: '',
        fullSizeJpgPath: '',
        preview: '',
        tempPath: '',
    }
    
    /**
     * Create preview from photo or video
     *
     * @param {object} params
     * @param {object} params.filedata - image Blob or DB object
     * @param {string} params.filedata.originalname=test-IMG_6585.heic
     * @param {string} params.filedata.encoding=7bit
     * @param {string} params.filedata.mimetype=image/heic
     * @param {string} params.filedata.destination=uploadTemp
     * @param {string} params.filedata.filename=461e38886446803e980440e08f469e58
     * @param {string} params.filedata.path=uploadTemp/461e38886446803e980440e08f469e58
     * @param {number} params.filedata.size=2699094
     * @param {object} params.config - configuration file
     * @param {number?} params.config.width
     * @param {number?} params.config.height
     * @param {number?} params.config.quality
     * @param {number | string?} params.config.timestamps
     * @param {string?} params.config.thumbnailSize
     * @param {boolean?} params.config.useTempFolder - target directory for sharping files is temp folder
     */
    constructor(params) {
        const {filedata, config} = params
        super('PreviewCreator');
        this.filedata = filedata;
        config && this.setConfigSafely(config)
    }
    
    /**
     * @param {{
     *     width?: number,
     *     height?: number,
     *     quality?: number,
     *     timestamps?: string | number,
     *     thumbnailSize?: string,
     *     useTempFolder?: boolean,
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
    
    /**
     * @param {{
     *     width?: number,
     *     height?: number,
     *     quality?: number,
     *     timestamps?: string | number,
     *     thumbnailSize?: string,
     *     isFullSize?: boolean,
     *     postfix?: string,
     *     useTempFolder?: boolean,
     * }} config - configuration properties
     */
    set config(config) {
        this._config = {...this._config, ...config}
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
    
    addPostfixToFilename() {
        return `-${this._config.postfix}.jpg`
    }
    
    getFullFileName() {
        return `${this.filedata.path}${this.addPostfixToFilename()}`
    }
    
    getStaticPath() {
        return `http://localhost:${PORT}/${UPLOAD_IMAGES_TEMP_FOLDER}/${this.filedata.filename}${this.addPostfixToFilename()}`
    }
    
    async createFullSizePreview() {
        this.config = {
            isFullSize: true,
            postfix: this.previewPostfix.fullSize
        }
        
        await this.sharpPhoto()
        
        this.config = {
            isFullSize: false,
            postfix: this.previewPostfix.preview
        }
    }
    
    async startProcess() {
        if (isHEICFile(this.filedata)) {
            await this.createFullSizePreview()
        }
        
        if (isVideoDBFile(this.filedata)) {
            await this.makeVideoThumbnail()
        } else {
            await this.sharpPhoto()
        }
        
        this.successLog('startProcess', this.photoProps)
        return {result: this.photoProps}
    }
    
    async makeVideoThumbnail() {
        const tg = new ThumbnailGenerator({
            sourcePath: this.filedata.path,
            thumbnailPath: UPLOAD_TEMP_FOLDER + '/',
        });
        
        await tg.generate({
            // timestamps: ['5%'],
            // timestamps: ['01:30.000'],
            timestamps: [this._config.timestamps],
            size: this._config.thumbnailSize
        })
            .then((preview) => {
                const photoProps = {
                    preview: `http://localhost:${PORT}/${UPLOAD_IMAGES_TEMP_FOLDER}/${preview[0]}`,
                    tempPath: this.filedata.path,
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
        
        const resizedObject = this._config.isFullSize
            ? sharpObject
            : sharpObject
                .resize(this._config.width, this._config.height, {fit: 'outside'})
        
        await resizedObject
            .jpeg({quality: this._config.quality})
            .toFile(this.getFullFileName())
            .then(() => {
                const photoProps = this._config.isFullSize
                    ? {
                        fullSizeJpg: this.getStaticPath(),
                        fullSizeJpgPath: `${this.filedata.path}${this.addPostfixToFilename()}`
                    }
                    : {
                        preview: this.getStaticPath(),
                        tempPath: this.filedata.path,
                    }
                this.successLog('Sharp', this.filedata.originalname)
                this.photoProps = photoProps
            })
            .catch(err => this.throwError(err.message));
    }
    
    getPathToJPEGIfPossible() {
        return this.photoProps.fullSizeJpgPath && this.filedata.path
    }
}

module.exports = {PreviewCreator}
