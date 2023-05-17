const {FilePathsBasic} = require('./filePathsBasic');
const {UPLOAD_TEMP_FOLDER, DATABASE_FOLDER, PREVIEWS_FOLDER} = require('../constants');

jest.mock('../constants', () => ({
    ...jest.requireActual('../constants'),
    UPLOAD_TEMP_FOLDER: 'mockedUploadTemp',
    DATABASE_FOLDER: '/app/mockedDataBase',
    PREVIEWS_FOLDER: '/app/mockedPreviews',
}))

describe('filePathsBasic', () => {
    let root
    
    beforeEach(() => {
        root = {
            original: UPLOAD_TEMP_FOLDER,
            originalPreview: UPLOAD_TEMP_FOLDER,
            target: DATABASE_FOLDER,
            targetPreview: PREVIEWS_FOLDER,
        }
    })
    
    describe('getOriginalFileBasePath', () => {
        it('should return basePathWithoutRootDirectory', () => {
            root.original = DATABASE_FOLDER
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
            
            expect(filePathsBasicInstance.getOriginalFileBasePath()).toBe("main/2020/")
        })
        it('should return ""', () => {
            root.original = UPLOAD_TEMP_FOLDER
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
            
            expect(filePathsBasicInstance.getOriginalFileBasePath()).toBe("")
        })
    })
    
    describe('getOriginalPreviewBasePath', () => {
        it('should return basePathWithoutRootDirectory', () => {
            root.originalPreview = DATABASE_FOLDER
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
            
            expect(filePathsBasicInstance.getOriginalPreviewBasePath()).toBe("main/2020/")
        })
        it('should return ""', () => {
            root.originalPreview = UPLOAD_TEMP_FOLDER
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
            
            expect(filePathsBasicInstance.getOriginalPreviewBasePath()).toBe("")
        })
    })
    
    describe('getOriginalFileFullPath', () => {
        it('should return rootDirectory/basePathWithoutRootDirectory/fileName', () => {
            root.original = DATABASE_FOLDER
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
            
            expect(filePathsBasicInstance.getOriginalFileFullPath('fileName.ext'))
                .toBe('/app/mockedDataBase/main/2020/fileName.ext')
        })
        it('should return rootDirectory/fileName', () => {
            root.original = UPLOAD_TEMP_FOLDER
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
            
            expect(filePathsBasicInstance.getOriginalFileFullPath('fileName.ext')).toBe('mockedUploadTemp/fileName.ext')
        })
    })
    
    describe('getPreviewName', () => {
        it('should return preview name', () => {
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
            
            expect(filePathsBasicInstance.getPreviewName('fileName.ext')).toBe('fileName-preview.ext')
        })
        it('should return fullSize name', () => {
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
        
            expect(filePathsBasicInstance.getPreviewName('fileName.ext', true)).toBe('fileName-fullSize.ext')
        })
        it('should return thumbnailName', () => {
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
        
            expect(filePathsBasicInstance.getPreviewName('fileName.ext', true, 'thumbnailName')).toBe('thumbnailName')
        })
    })
    
    describe('getOriginalPreviewFullPath', () => {
        it('should return rootDirectory/basePathWithoutRootDirectory/fileName-postfix.ext', () => {
            root.originalPreview = DATABASE_FOLDER
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
            
            expect(filePathsBasicInstance.getOriginalPreviewFullPath('fileName.ext', false))
                .toBe('/app/mockedDataBase/main/2020/fileName-preview.ext')
        })
        it('should return rootTempDirectory/fileName-postfix', () => {
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
        
            expect(filePathsBasicInstance.getOriginalPreviewFullPath('fileName', true))
                .toBe('mockedUploadTemp/fileName-fullSize.jpg')
        })
        it('should return rootTempDirectory/thumbnailName', () => {
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
        
            expect(filePathsBasicInstance.getOriginalPreviewFullPath('fileName', true, 'thumbnailName.png'))
                .toBe('mockedUploadTemp/thumbnailName.png')
        })
    })
    
    describe('getTargetFilePathWithoutRootDir', () => {
        it('should return fullFileName without root directory', () => {
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
            
            expect(filePathsBasicInstance.getTargetFilePathWithoutRootDir('fileName.ext'))
                .toBe('/main/2020/fileName.ext')
        })
    })
    
    describe('getPreviewFullFolderName', () => {
        it('should return normalizedFileType/fileSizeName/date', () => {
            const filePathsBasicInstance = new FilePathsBasic('mockedModuleName', root, "main/2020")
            
            expect(filePathsBasicInstance.getPreviewFullFolderName(
                'image-jpeg',
                'preview',
                '2022.06.09 - changeDate'
            )).toBe('image-jpeg/preview/2022.06.09 - changeDate')
        })
    })
})
