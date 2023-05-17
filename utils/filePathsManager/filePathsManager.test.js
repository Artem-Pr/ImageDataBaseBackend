const {FilePathsManager} = require('./filePathsManager');
const {UPLOAD_TEMP_FOLDER, DATABASE_FOLDER, PREVIEWS_FOLDER} = require('../../constants');
const {FilePathsManagerUtils} = require('./filePathsManagerUtils');

jest.mock('../../constants', () => ({
    ...jest.requireActual('../../constants'),
    UPLOAD_TEMP_FOLDER: 'mockedUploadTemp',
    DATABASE_FOLDER: '/app/mockedDataBase',
    PREVIEWS_FOLDER: '/app/mockedPreviews',
    useHashForPreviewName: true,
}))

jest
    .useFakeTimers('modern')
    .setSystemTime(new Date('2012-01-26'))

const mockedJPEGFiledataBlob = {
    "fieldname": "filedata",
    "originalname": "IMG_20190624_102400.jpg",
    "encoding": "7bit",
    "mimetype": "image/jpeg",
    "destination": "uploadTemp",
    "filename": "4b5ebcfca0376e1131960a1244807c53",
    "path": "uploadTemp/4b5ebcfca0376e1131960a1244807c53",
    "size": 1932980
}

const mockedHEICFileDataBlob = {
    "fieldname": "filedata",
    "originalname": "test-IMG_6538.heic",
    "encoding": "7bit",
    "mimetype": "image/heic",
    "destination": "uploadTemp",
    "filename": "af638985f4b4c4db8e53d2db00a296fe",
    "path": "uploadTemp/af638985f4b4c4db8e53d2db00a296fe",
    "size": 918700
}

const mockedVideoFiledataBlob = {
    "fieldname": "filedata",
    "originalname": "VID_20190623_091549.mp4",
    "encoding": "7bit",
    "mimetype": "video/mp4",
    "destination": "uploadTemp",
    "filename": "3e09f0cfef2b8b8598aa38049f0cdba7",
    "path": "uploadTemp/3e09f0cfef2b8b8598aa38049f0cdba7",
    "size": 68367649
}

const mockedVideoFiledataFromUploadingObject = {
    "changeDate": 1561259748000,
    "name": "VID_20190623_091549.mp4",
    "size": 68367649,
    "type": "video/mp4",
    "preview": "http://localhost:5000/upload_images/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png",
    "tempPath": "uploadTemp/cc9387e690dd2f3cf8a797f7d5e7194a",
    "originalDate": "-",
    "keywords": null,
    "megapixels": "",
    "rating": 0,
    "description": ""
}

const mockedJPEGFiledataFromUploadingObject = {
    "changeDate": 1561352594000, //2023.01.27
    "name": "IMG_20190624_110312.jpg",
    "size": 2812368,
    "type": "image/jpeg",
    "fullSizeJpgPath": "",
    "preview": "http://localhost:5000/upload_images/49dd3818db90f12b55c851d1e923f6d2-preview.jpg",
    "tempPath": "uploadTemp/49dd3818db90f12b55c851d1e923f6d2",
    "originalPath": "",
    "originalDate": "2019.06.24 11:03",
    "keywords": null,
    "megapixels": "",
    "rating": 0,
    "description": ""
}

const mockedHEICFiledataFromUploadingObject = {
    "changeDate": 1674852868640,
    "name": "test-IMG_6538.heic",
    "size": 918700,
    "type": "image/heic",
    "fullSizeJpgPath": "uploadTemp/af638985f4b4c4db8e53d2db00a296fe-fullSize.jpg",
    "preview": "http://localhost:5000/upload_images/af638985f4b4c4db8e53d2db00a296fe-preview.jpg",
    "tempPath": "uploadTemp/af638985f4b4c4db8e53d2db00a296fe",
    "originalPath": "http://localhost:5000/upload_images/af638985f4b4c4db8e53d2db00a296fe-fullSize.jpg",
    "originalDate": "-",
    "keywords": null,
    "megapixels": "",
    "rating": 0,
    "description": ""
}

const mockedHashName = '74923089ced5c27bff56d3aa063a200f'

describe('FilePathsManager', () => {
    let root
    
    beforeEach(() => {
        root = {
            original: UPLOAD_TEMP_FOLDER,
            originalPreview: UPLOAD_TEMP_FOLDER,
            target: DATABASE_FOLDER,
            targetPreview: PREVIEWS_FOLDER,
        }
    })
    
    describe('static FilePathsManagerUtils: prepareFiledataFromBlob', () => {
        it('should return prepared object', () => {
            const preparedFileData = FilePathsManagerUtils.prepareFileData(mockedHEICFileDataBlob)
            
            expect(preparedFileData).toEqual({
                originalName: 'af638985f4b4c4db8e53d2db00a296fe',
                targetName: 'test-IMG_6538.heic',
                mimetype: 'image/heic'
            })
        })
    })
    
    describe('static FilePathsManagerUtils: prepareFiledataFromUploadingObject', () => {
        it('should return prepared object from HEIC', () => {
            const preparedFileData = FilePathsManagerUtils.prepareFileData(mockedHEICFiledataFromUploadingObject)
            
            expect(preparedFileData).toEqual({
                changeDate: 1674852868640,
                originalDate: '-',
                targetName: 'test-IMG_6538.heic',
                originalName: 'af638985f4b4c4db8e53d2db00a296fe',
                mimetype: 'image/heic',
            })
        })
        it('should return prepared object from MP4', () => {
            const preparedFileData = FilePathsManagerUtils.prepareFileData(mockedVideoFiledataFromUploadingObject)
            
            expect(preparedFileData).toEqual({
                changeDate: 1561259748000,
                originalDate: '-',
                targetName: 'VID_20190623_091549.mp4',
                originalName: 'cc9387e690dd2f3cf8a797f7d5e7194a',
                mimetype: 'video/mp4',
                thumbnailName: 'cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png'
            })
        })
    })
    
    describe('getStringDateFolderName', () => {
        it('should return preview baseFolderName if originalDate = undefined and changeDate = undefined', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedHEICFileDataBlob, root, 'main/2020', mockedHashName)
            
            expect(filePathsManagerInstance.getStringDateFolderName())
                .toBe('image-heic/preview/2012.01.26 - changeDate')
        })
        it('should return preview baseFolderName', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedJPEGFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
            
            expect(filePathsManagerInstance.getStringDateFolderName())
                .toBe('image-jpeg/preview/2019.06.24 - originalDate')
        })
        it('should return preview baseFolderName if originalDate = undefined and changeDate = undefined', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedHEICFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
            
            expect(filePathsManagerInstance.getStringDateFolderName(true))
                .toBe('image-heic/fullSize/2023.01.27 - changeDate')
        })
        it('should return preview baseFolderName for MP4', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedVideoFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
            
            expect(filePathsManagerInstance.getStringDateFolderName())
                .toBe('video-mp4/preview/2019.06.23 - changeDate')
        })
    })
    
    describe('getTargetPreviewBasePath', () => {
        it('should return preview base folder', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedHEICFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
            
            expect(filePathsManagerInstance.getTargetPreviewBasePath())
                .toBe('image-heic/preview/2023.01.27 - changeDate/')
        })
        it('should return "" if targetPreview !== PREVIEWS_FOLDER', () => {
            root.targetPreview = UPLOAD_TEMP_FOLDER
            const filePathsManagerInstance = new FilePathsManager(mockedHEICFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
            
            expect(filePathsManagerInstance.getTargetPreviewBasePath())
                .toBe('')
        })
    })
    
    describe('getPreviewPathWithoutRootDir', () => {
        it('should return path for MP4 (from upload object)', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedVideoFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
            expect(filePathsManagerInstance.getPreviewPathWithoutRootDir(false))
                .toBe('/video-mp4/preview/2019.06.23 - changeDate/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png')
        })
        it('should return path for JPG (from upload object)', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedJPEGFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
            expect(filePathsManagerInstance.getPreviewPathWithoutRootDir(false))
                .toBe('/image-jpeg/preview/2019.06.24 - originalDate/74923089ced5c27bff56d3aa063a200f-preview.jpg')
        })
        it('should return path for HEIC (from upload object)', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedHEICFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
            expect(filePathsManagerInstance.getPreviewPathWithoutRootDir(false))
                .toBe('/image-heic/preview/2023.01.27 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg')
        })
        it('should return fullSize path for HEIC (from upload object)', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedHEICFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
            expect(filePathsManagerInstance.getPreviewPathWithoutRootDir(true))
                .toBe('/image-heic/fullSize/2023.01.27 - changeDate/74923089ced5c27bff56d3aa063a200f-fullSize.jpg')
        })
        it('should return empty path for HEIC (from upload object)', () => {
            root.targetPreview = UPLOAD_TEMP_FOLDER
            const filePathsManagerInstance = new FilePathsManager(mockedHEICFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
            expect(filePathsManagerInstance.getPreviewPathWithoutRootDir(false))
                .toBe('/74923089ced5c27bff56d3aa063a200f-preview.jpg')
        })
        it('should return path for HEIC (from Blob object)', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedHEICFileDataBlob, root, 'main/2020', mockedHashName)
            expect(filePathsManagerInstance.getPreviewPathWithoutRootDir(false))
                .toBe('/image-heic/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg')
        })
        it('should return path for MP4 (from Blob object) THIS SHOULD BE NOT THUMBNAIL FILENAME', () => {
            const filePathsManagerInstance = new FilePathsManager(mockedVideoFiledataBlob, root, 'main/2020', mockedHashName)
            expect(filePathsManagerInstance.getPreviewPathWithoutRootDir(false))
                .toBe('/video-mp4/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg')
        })
    })
    
    describe('createAllFullPathsForTheFile', () => {
        describe('root: default', () => {
            it('should create paths for JPG file from BLOB', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedJPEGFiledataBlob, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/IMG_20190624_102400.jpg",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "/app/mockedPreviews/image-jpeg/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "mockedUploadTemp/4b5ebcfca0376e1131960a1244807c53",
                    originalFullSizeJpeg: "",
                    originalPreview: "mockedUploadTemp/4b5ebcfca0376e1131960a1244807c53-preview.jpg",
                    targetFile: "/main/2020/IMG_20190624_102400.jpg",
                    targetFullSizeJpeg: "",
                    targetPreview: "/image-jpeg/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
                
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "",
                    targetPreview: "image-jpeg/preview/2012.01.26 - changeDate/",
                })
            })
            it('should create paths for HEIC file from BLOB', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedHEICFileDataBlob, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/test-IMG_6538.heic",
                    fullPathTargetFullSizeJpeg: "/app/mockedPreviews/image-heic/fullSize/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    fullPathTargetPreview: "/app/mockedPreviews/image-heic/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe",
                    originalFullSizeJpeg: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe-fullSize.jpg",
                    originalPreview: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe-preview.jpg",
                    targetFile: "/main/2020/test-IMG_6538.heic",
                    targetFullSizeJpeg: "/image-heic/fullSize/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    targetPreview: "/image-heic/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "image-heic/fullSize/2012.01.26 - changeDate/",
                    targetPreview: "image-heic/preview/2012.01.26 - changeDate/",
                })
            })
            it('should create paths for MP4 file from BLOB', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedVideoFiledataBlob, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/VID_20190623_091549.mp4",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "/app/mockedPreviews/video-mp4/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "mockedUploadTemp/3e09f0cfef2b8b8598aa38049f0cdba7",
                    originalFullSizeJpeg: "",
                    originalPreview: "mockedUploadTemp/3e09f0cfef2b8b8598aa38049f0cdba7-preview.jpg",
                    targetFile: "/main/2020/VID_20190623_091549.mp4",
                    targetFullSizeJpeg: "",
                    targetPreview: "/video-mp4/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "",
                    targetPreview: "video-mp4/preview/2012.01.26 - changeDate/",
                })
            })
            it('should create paths for JPG file from uploading object', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedJPEGFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/IMG_20190624_110312.jpg",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "/app/mockedPreviews/image-jpeg/preview/2019.06.24 - originalDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "mockedUploadTemp/49dd3818db90f12b55c851d1e923f6d2",
                    originalFullSizeJpeg: "",
                    originalPreview: "mockedUploadTemp/49dd3818db90f12b55c851d1e923f6d2-preview.jpg",
                    targetFile: "/main/2020/IMG_20190624_110312.jpg",
                    targetFullSizeJpeg: "",
                    targetPreview: "/image-jpeg/preview/2019.06.24 - originalDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "",
                    targetPreview: "image-jpeg/preview/2019.06.24 - originalDate/",
                })
            })
            it('should create paths for HEIC file from uploading object', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedHEICFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/test-IMG_6538.heic",
                    fullPathTargetFullSizeJpeg: "/app/mockedPreviews/image-heic/fullSize/2023.01.27 - changeDate/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    fullPathTargetPreview: "/app/mockedPreviews/image-heic/preview/2023.01.27 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe",
                    originalFullSizeJpeg: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe-fullSize.jpg",
                    originalPreview: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe-preview.jpg",
                    targetFile: "/main/2020/test-IMG_6538.heic",
                    targetFullSizeJpeg: "/image-heic/fullSize/2023.01.27 - changeDate/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    targetPreview: "/image-heic/preview/2023.01.27 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "image-heic/fullSize/2023.01.27 - changeDate/",
                    targetPreview: "image-heic/preview/2023.01.27 - changeDate/",
                })
            })
            it('should create paths for MP4 file from uploading object', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedVideoFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/VID_20190623_091549.mp4",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "/app/mockedPreviews/video-mp4/preview/2019.06.23 - changeDate/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png",
                    originalFile: "mockedUploadTemp/cc9387e690dd2f3cf8a797f7d5e7194a",
                    originalFullSizeJpeg: "",
                    originalPreview: "mockedUploadTemp/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png",
                    targetFile: "/main/2020/VID_20190623_091549.mp4",
                    targetFullSizeJpeg: "",
                    targetPreview: "/video-mp4/preview/2019.06.23 - changeDate/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "",
                    targetPreview: "video-mp4/preview/2019.06.23 - changeDate/",
                })
            })
        })
        describe('root: targetPreview: UPLOAD_TEMP_FOLDER', () => {
            beforeEach(() => {
                root = {
                    original: UPLOAD_TEMP_FOLDER,
                    originalPreview: UPLOAD_TEMP_FOLDER,
                    target: DATABASE_FOLDER,
                    targetPreview: UPLOAD_TEMP_FOLDER,
                }
            })
            
            it('should create paths for JPG file from BLOB', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedJPEGFiledataBlob, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/IMG_20190624_102400.jpg",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "mockedUploadTemp/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "mockedUploadTemp/4b5ebcfca0376e1131960a1244807c53",
                    originalFullSizeJpeg: "",
                    originalPreview: "mockedUploadTemp/4b5ebcfca0376e1131960a1244807c53-preview.jpg",
                    targetFile: "/main/2020/IMG_20190624_102400.jpg",
                    targetFullSizeJpeg: "",
                    targetPreview: "/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "",
                    targetPreview: "",
                })
            })
            it('should create paths for HEIC file from BLOB', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedHEICFileDataBlob, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/test-IMG_6538.heic",
                    fullPathTargetFullSizeJpeg: "mockedUploadTemp/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    fullPathTargetPreview: "mockedUploadTemp/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe",
                    originalFullSizeJpeg: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe-fullSize.jpg",
                    originalPreview: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe-preview.jpg",
                    targetFile: "/main/2020/test-IMG_6538.heic",
                    targetFullSizeJpeg: "/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    targetPreview: "/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "",
                    targetPreview: "",
                })
            })
            it('should create paths for MP4 file from BLOB', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedVideoFiledataBlob, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/VID_20190623_091549.mp4",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "mockedUploadTemp/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "mockedUploadTemp/3e09f0cfef2b8b8598aa38049f0cdba7",
                    originalFullSizeJpeg: "",
                    originalPreview: "mockedUploadTemp/3e09f0cfef2b8b8598aa38049f0cdba7-preview.jpg",
                    targetFile: "/main/2020/VID_20190623_091549.mp4",
                    targetFullSizeJpeg: "",
                    targetPreview: "/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "",
                    targetPreview: "",
                })
            })
            it('should create paths for JPG file from uploading object', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedJPEGFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/IMG_20190624_110312.jpg",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "mockedUploadTemp/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "mockedUploadTemp/49dd3818db90f12b55c851d1e923f6d2",
                    originalFullSizeJpeg: "",
                    originalPreview: "mockedUploadTemp/49dd3818db90f12b55c851d1e923f6d2-preview.jpg",
                    targetFile: "/main/2020/IMG_20190624_110312.jpg",
                    targetFullSizeJpeg: "",
                    targetPreview: "/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "",
                    targetPreview: "",
                })
            })
            it('should create paths for HEIC file from uploading object', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedHEICFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/test-IMG_6538.heic",
                    fullPathTargetFullSizeJpeg: "mockedUploadTemp/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    fullPathTargetPreview: "mockedUploadTemp/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe",
                    originalFullSizeJpeg: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe-fullSize.jpg",
                    originalPreview: "mockedUploadTemp/af638985f4b4c4db8e53d2db00a296fe-preview.jpg",
                    targetFile: "/main/2020/test-IMG_6538.heic",
                    targetFullSizeJpeg: "/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    targetPreview: "/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "",
                    targetPreview: "",
                })
            })
            it('should create paths for MP4 file from uploading object', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedVideoFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "/app/mockedDataBase/main/2020/VID_20190623_091549.mp4",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "mockedUploadTemp/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png",
                    originalFile: "mockedUploadTemp/cc9387e690dd2f3cf8a797f7d5e7194a",
                    originalFullSizeJpeg: "",
                    originalPreview: "mockedUploadTemp/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png",
                    targetFile: "/main/2020/VID_20190623_091549.mp4",
                    targetFullSizeJpeg: "",
                    targetPreview: "/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "main/2020",
                    targetFullSizeJpeg: "",
                    targetPreview: "",
                })
            })
        })
        describe('root: move only preview', () => {
            beforeEach(() => {
                root = {
                    originalPreview: DATABASE_FOLDER,
                    targetPreview: PREVIEWS_FOLDER,
                }
            })
            
            it('should create paths for JPG file from BLOB', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedJPEGFiledataBlob, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "/app/mockedPreviews/image-jpeg/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "",
                    originalFullSizeJpeg: "",
                    originalPreview: "/app/mockedDataBase/main/2020/4b5ebcfca0376e1131960a1244807c53-preview.jpg",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "/image-jpeg/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "image-jpeg/preview/2012.01.26 - changeDate/",
                })
            })
            it('should create paths for HEIC file from BLOB', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedHEICFileDataBlob, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "",
                    fullPathTargetFullSizeJpeg: "/app/mockedPreviews/image-heic/fullSize/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    fullPathTargetPreview: "/app/mockedPreviews/image-heic/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "",
                    originalFullSizeJpeg: "/app/mockedDataBase/main/2020/af638985f4b4c4db8e53d2db00a296fe-fullSize.jpg",
                    originalPreview: "/app/mockedDataBase/main/2020/af638985f4b4c4db8e53d2db00a296fe-preview.jpg",
                    targetFile: "",
                    targetFullSizeJpeg: "/image-heic/fullSize/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    targetPreview: "/image-heic/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "main/2020/",
                    targetFile: "",
                    targetFullSizeJpeg: "image-heic/fullSize/2012.01.26 - changeDate/",
                    targetPreview: "image-heic/preview/2012.01.26 - changeDate/",
                })
            })
            it('should create paths for MP4 file from BLOB', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedVideoFiledataBlob, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "/app/mockedPreviews/video-mp4/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "",
                    originalFullSizeJpeg: "",
                    originalPreview: "/app/mockedDataBase/main/2020/3e09f0cfef2b8b8598aa38049f0cdba7-preview.jpg",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "/video-mp4/preview/2012.01.26 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "video-mp4/preview/2012.01.26 - changeDate/",
                })
            })
            it('should create paths for JPG file from uploading object', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedJPEGFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "/app/mockedPreviews/image-jpeg/preview/2019.06.24 - originalDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "",
                    originalFullSizeJpeg: "",
                    originalPreview: "/app/mockedDataBase/main/2020/49dd3818db90f12b55c851d1e923f6d2-preview.jpg",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "/image-jpeg/preview/2019.06.24 - originalDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "image-jpeg/preview/2019.06.24 - originalDate/",
                })
            })
            it('should create paths for HEIC file from uploading object', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedHEICFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "",
                    fullPathTargetFullSizeJpeg: "/app/mockedPreviews/image-heic/fullSize/2023.01.27 - changeDate/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    fullPathTargetPreview: "/app/mockedPreviews/image-heic/preview/2023.01.27 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "",
                    originalFullSizeJpeg: "/app/mockedDataBase/main/2020/af638985f4b4c4db8e53d2db00a296fe-fullSize.jpg",
                    originalPreview: "/app/mockedDataBase/main/2020/af638985f4b4c4db8e53d2db00a296fe-preview.jpg",
                    targetFile: "",
                    targetFullSizeJpeg: "/image-heic/fullSize/2023.01.27 - changeDate/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    targetPreview: "/image-heic/preview/2023.01.27 - changeDate/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "main/2020/",
                    targetFile: "",
                    targetFullSizeJpeg: "image-heic/fullSize/2023.01.27 - changeDate/",
                    targetPreview: "image-heic/preview/2023.01.27 - changeDate/",
                })
            })
            it('should create paths for MP4 file from uploading object', () => {
                const filePathsManagerInstance = new FilePathsManager(mockedVideoFiledataFromUploadingObject, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "/app/mockedPreviews/video-mp4/preview/2019.06.23 - changeDate/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png",
                    originalFile: "",
                    originalFullSizeJpeg: "",
                    originalPreview: "/app/mockedDataBase/main/2020/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "/video-mp4/preview/2019.06.23 - changeDate/cc9387e690dd2f3cf8a797f7d5e7194a-thumbnail-1000x562-0001.png",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "",
                    originalPreview: "",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "video-mp4/preview/2019.06.23 - changeDate/",
                })
            })
        })
        describe('root: from Database to Upload folder', () => {
            const JPEGFiledata = {
                "changeDate": 1327536000000,
                "name": "IMG_20190624_102400.jpg",
                "size": 2812368,
                "type": "image/jpeg",
                "fullSizeJpgPath": "",
                "preview": "http://localhost:5000/upload_images/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                "tempPath": "uploadTemp/IMG_20190624_102400.jpg",
                "originalPath": "",
                "originalDate": "-",
                "keywords": null,
                "megapixels": "",
                "rating": 0,
                "description": ""
            }
    
            const HEICFiledata = {
                "changeDate": 1674852868640,
                "name": "IMG_20190624_102400.heic",
                "size": 918700,
                "type": "image/heic",
                "fullSizeJpgPath": "uploadTemp/74923089ced5c27bff56d3aa063a200f-fullSize.heic",
                "preview": "http://localhost:5000/upload_images/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                "tempPath": "uploadTemp/IMG_20190624_102400.heic",
                "originalPath": "http://localhost:5000/upload_images/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                "originalDate": "2019.06.24 11:03",
                "keywords": null,
                "megapixels": "",
                "rating": 0,
                "description": ""
            }
            
            beforeEach(() => {
                root = {
                    original: DATABASE_FOLDER,
                    targetPreview: UPLOAD_TEMP_FOLDER,
                }
            })
            
            it('should create paths for JPG file from JPEGFiledata', () => {
                const filePathsManagerInstance = new FilePathsManager(JPEGFiledata, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "",
                    fullPathTargetFullSizeJpeg: "",
                    fullPathTargetPreview: "mockedUploadTemp/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "/app/mockedDataBase/main/2020/IMG_20190624_102400.jpg",
                    originalFullSizeJpeg: "",
                    originalPreview: "",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "main/2020/",
                    originalPreview: "",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "",
                })
            })
            it('should create paths for HEIC file from HEICFiledata', () => {
                const filePathsManagerInstance = new FilePathsManager(HEICFiledata, root, 'main/2020', mockedHashName)
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .fullPathsObj
                ).toEqual({
                    fullPathTargetFile: "",
                    fullPathTargetFullSizeJpeg: "mockedUploadTemp/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    fullPathTargetPreview: "mockedUploadTemp/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                    originalFile: "/app/mockedDataBase/main/2020/IMG_20190624_102400.heic",
                    originalFullSizeJpeg: "",
                    originalPreview: "",
                    targetFile: "",
                    targetFullSizeJpeg: "/74923089ced5c27bff56d3aa063a200f-fullSize.jpg",
                    targetPreview: "/74923089ced5c27bff56d3aa063a200f-preview.jpg",
                })
    
                expect(filePathsManagerInstance
                    .createAllFullPathsForTheFile()
                    .basePaths
                ).toEqual({
                    originalFile: "main/2020/",
                    originalPreview: "",
                    targetFile: "",
                    targetFullSizeJpeg: "",
                    targetPreview: "",
                })
            })
        })
    })
})
