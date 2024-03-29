const fs = require('fs-extra')
const {
    updateFiledata,
    originalData,
    originalPathsList,
} = require("./Data")
const {
    renameFile,
    pickFileName,
    asyncMoveFile,
    asyncRemove,
    updateNamePath,
    replaceWithoutExt,
    backupFiles,
    cleanBackup,
    removeFilesArr,
    filesRecovery,
    getUniqPaths,
    getSubdirectories,
} = require("../utils/common")

describe('Common functions: ', () => {
    beforeAll(() => {
        // temp cleaning
        console.log('temp cleaning')
        fs.emptyDirSync('temp')
    })
    afterEach(() => {
        // temp cleaning
        console.log('temp cleaning')
        fs.emptyDirSync('temp')
    })
    
    describe('getUniqPaths: ', () => {
        const paths = [
            'tests',
            '',
            'пустая папка',
            'tests/test-images/проверка локализации1/video',
            'tests/test-images/проверка локализации2',
        ]
        
        test('should return an array of unique paths including subfolders', () => {
            expect(getUniqPaths(paths)).toHaveLength(6)
            expect(getUniqPaths([])).toHaveLength(0)
            expect(getUniqPaths(['', ''])).toHaveLength(0)
        })
    })
    describe('Rename File func: ', () => {
        const originalFileName = 'tests/test-images/image001-map.jpg'
        const newFileName = 'tests/test-images/image001-map__renamed.jpg'
        
        test('should return ERROR if there is an incorrect name', async () => {
            expect(fs.existsSync(originalFileName)).toBe(true)
            try {
                await renameFile(originalFileName, 'tests/test-videos/image001-map.jpg')
            } catch (error) {
                expect(error.message).toBe('fs.rename ERROR: tests/test-videos/image001-map.jpg')
            }
        })
        
        test('should return ERROR if there is an existing new file name', async () => {
            fs.copySync(originalFileName, newFileName)
            expect(fs.existsSync(originalFileName)).toBe(true)
            try {
                await renameFile(originalFileName, newFileName)
            } catch (error) {
                expect(error.message).toBe('fs.rename ERROR: this file already exists - tests/test-images/image001-map__renamed.jpg')
            } finally {
                fs.removeSync(newFileName)
            }
        })
        
        test('should rename image file', async () => {
            expect(fs.existsSync(originalFileName)).toBe(true)
            await renameFile(originalFileName, newFileName)
            expect(fs.existsSync(newFileName)).toBe(true)
            await renameFile(newFileName, originalFileName)
            expect(fs.existsSync(originalFileName)).toBe(true)
        })
        
        test('should return newImageName', async () => {
            expect(fs.existsSync(originalFileName)).toBe(true)
            const response = await renameFile(originalFileName, newFileName)
            expect(response).toBe(newFileName)
            await renameFile(newFileName, originalFileName)
            expect(fs.existsSync(originalFileName)).toBe(true)
        })
    })
    describe('pickFileName:', () => {
        test('should return file name from file path', () => {
            const filePath = 'tests/tempVideos/YDXJ1442-thumbnail-1000x562-0001.png'
            const fileName = 'YDXJ1442.png'
            expect(pickFileName(filePath)).toBe('YDXJ1442-thumbnail-1000x562-0001.png')
            expect(pickFileName(fileName)).toBe('YDXJ1442.png')
        })
    })
    describe('asyncMoveFile: ', () => {
        test('should move file to new directory', async () => {
            const originalFilePath = 'tests/test-images/image001-map.jpg'
            const newFilePath = 'tests/testDirectory/проверка локализации/image001-map.jpg'
            
            const response = await asyncMoveFile(originalFilePath, newFilePath)
            expect(response).toBe(newFilePath)
            expect(fs.existsSync(originalFilePath)).toBeFalsy()
            expect(fs.existsSync(newFilePath)).toBeTruthy()
            
            // move to original directory
            const response2 = await asyncMoveFile(newFilePath, originalFilePath)
            expect(response2).toBe(originalFilePath)
            expect(fs.existsSync(originalFilePath)).toBeTruthy()
            expect(fs.existsSync(newFilePath)).toBeFalsy()
        })
        test('should return an error if the same file exists', async () => {
            const originalFilePath = 'tests/test-images/image001-map.jpg'
            const newFilePath = 'tests/testDirectory/проверка локализации/image001-map.jpg'
            
            fs.copySync(originalFilePath, newFilePath)
            try {
                await asyncMoveFile(originalFilePath, newFilePath)
            } catch (error) {
                expect(error.message).toBe(`fs.move Error: dest already exists. - ${newFilePath}`)
            }
            
            // remove copied file
            fs.removeSync(newFilePath)
        })
        test('should overwrite file if needed', async () => {
            const originalFilePath = 'tests/test-images/image001-map.jpg'
            const newFilePath = 'tests/testDirectory/проверка локализации/image001-map.jpg'
            
            fs.copySync(originalFilePath, newFilePath)
            await asyncMoveFile(newFilePath, originalFilePath, true)
        })
    })
    describe('asyncRemove: ', () => {
        const originalFilePath = 'tests/test-images/image001-map.jpg'
        const newFilePath = 'tests/testDirectory/проверка локализации/test-dir/test-subdir/image001-map.jpg'
        
        beforeEach(() => {
            fs.mkdirpSync('tests/testDirectory/проверка локализации/test-dir/test-subdir')
            fs.mkdirpSync('tests/testDirectory/проверка локализации/test-dir/тестовая папка')
            fs.copySync(originalFilePath, newFilePath)
        })
        afterEach(() => {
            fs.removeSync('tests/testDirectory/проверка локализации/test-dir')
        })
        test('should correctly remove folder with all subfolders and files', async () => {
            const isDirExist0 = fs.pathExistsSync('tests/testDirectory/проверка локализации/test-dir')
            const isDirExist1 = fs.pathExistsSync('tests/testDirectory/проверка локализации/test-dir/test-subdir')
            const isDirExist2 = fs.pathExistsSync('tests/testDirectory/проверка локализации/test-dir/тестовая папка')
            const isDirExist3 = fs.pathExistsSync('tests/testDirectory/проверка локализации/test-dir/test-subdir/image001-map.jpg')
            expect(isDirExist0 && isDirExist1 && isDirExist2 && isDirExist3).toBeTruthy()
            await asyncRemove('tests/testDirectory/проверка локализации/test-dir')
            const isDirExist = fs.pathExistsSync('tests/testDirectory/проверка локализации/test-dir')
            expect(isDirExist).toBeFalsy()
        })
    })
    describe('updateNamePath: ', () => {
        test('should return new namePath', async () => {
            const newNamePath = updateNamePath(originalData[0], updateFiledata[0])
            expect(newNamePath).toBe('tests/test-images/123.jpg')
        })
    })
    describe('replaceWithoutExt: ', () => {
        test('should return new string with replaced file name in it', () => {
            const newFileName = 'bom-bom.mp4'
            const oldFileName = 'image002-map.jpg'
            const stringForReplacement = 'tests/test-images/image002-map-thumbnail-1000x562-0001.png'
            const resultString = 'tests/test-images/bom-bom-thumbnail-1000x562-0001.png'
            
            expect(replaceWithoutExt(newFileName, oldFileName, stringForReplacement)).toBe(resultString)
        })
    })
    describe('backupFiles: ', () => {
        test('should return array of tempPath objects', async () => {
            const originalFileName1 = 'tests/test-images/image001-map.jpg'
            const originalFileName2 = 'tests/test-images/image002-map.jpg'
            const filesBackup = await backupFiles([originalFileName1, originalFileName2])
            
            // const filesBackup = await Promise.all(filesBackupPromise)
            
            expect(filesBackup).toHaveLength(2)
            
            const backup1 = filesBackup[0]
            const backup2 = filesBackup[1]
            
            expect(backup1.backupPath.startsWith('temp/backup')).toBeTruthy()
            expect(backup1.backupPath).toHaveLength(17)
            expect(backup2.backupPath.startsWith('temp/backup')).toBeTruthy()
            expect(backup2.backupPath).toHaveLength(17)
            expect(backup1.originalPath.startsWith('tests/')).toBeTruthy()
            expect(backup2.originalPath.startsWith('tests/')).toBeTruthy()
        })
        test('should create temp files', async () => {
            const originalFileName1 = 'tests/test-images/image001-map.jpg'
            const originalFileName2 = 'tests/test-images/image002-map.jpg'
            const filesBackup = await backupFiles([originalFileName1, originalFileName2])
            
            const backup1 = filesBackup[0]
            const backup2 = filesBackup[1]
            
            expect(fs.existsSync(backup1.backupPath)).toBeTruthy()
            expect(fs.existsSync(backup2.backupPath)).toBeTruthy()
            expect(fs.existsSync(backup1.originalPath)).toBeTruthy()
            expect(fs.existsSync(backup2.originalPath)).toBeTruthy()
        })
        test('should return Error if originalPath is wrong', async () => {
            const originalFileName1 = 'tests/test-images/wrong-address.jpg'
            const originalFileName2 = 'tests/test-images/image001-map.jpg'
            try {
                await backupFiles([originalFileName1, originalFileName2])
            } catch (error) {
                expect(error.message).toBe('BACKUP_FILES: fs.copy Error: ENOENT: no such file or directory, stat \'tests/test-images/wrong-address.jpg\'')
            }
        })
    })
    describe('cleanBackup: ', () => {
        test('should clean temp folder (remove only backup files)', async () => {
            const originalFileName1 = 'tests/test-images/image001-map.jpg'
            const originalFileName2 = 'tests/test-images/image002-map.jpg'
            const File1NewDist = 'temp/image001-map.jpg'
            const File2NewDist = 'temp/image002-map.jpg'
            const newFile1 = 'temp/backup123456'
            const newFile2 = 'temp/backup654321'
            const tempPathObjArr = [
                {backupPath: newFile1, originalPath: originalFileName1},
                {backupPath: newFile2, originalPath: originalFileName2},
            ]
            
            fs.copySync(originalFileName1, File1NewDist)
            fs.copySync(originalFileName2, File2NewDist)
            fs.copySync(originalFileName1, newFile1)
            fs.copySync(originalFileName2, newFile2)
            
            await cleanBackup(tempPathObjArr)
            
            expect(fs.existsSync(originalFileName1)).toBeTruthy()
            expect(fs.existsSync(originalFileName2)).toBeTruthy()
            expect(fs.existsSync(File1NewDist)).toBeTruthy()
            expect(fs.existsSync(File2NewDist)).toBeTruthy()
            expect(fs.existsSync(newFile1)).toBeFalsy()
            expect(fs.existsSync(newFile2)).toBeFalsy()
        })
    })
    describe('removeFilesArr: ', () => {
        test('should remove all files from array', async () => {
            const originalFileName1 = 'tests/test-images/image001-map.jpg'
            const originalFileName2 = 'tests/test-images/image002-map.jpg'
            const File1NewDist = 'temp/image001-map.jpg'
            const File2NewDist = 'temp/image002-map.jpg'
            fs.copySync(originalFileName1, File1NewDist)
            fs.copySync(originalFileName2, File2NewDist)
            expect(fs.existsSync(File1NewDist)).toBeTruthy()
            expect(fs.existsSync(File2NewDist)).toBeTruthy()
            
            await removeFilesArr([File1NewDist, File2NewDist])
            
            expect(fs.existsSync(File1NewDist)).toBeFalsy()
            expect(fs.existsSync(File2NewDist)).toBeFalsy()
        })
    })
    describe('fileRecovery: ', () => {
        test('should recover files', async () => {
            const originalFileName1 = 'tests/test-images/image001-map.jpg'
            const originalFileName2 = 'tests/test-images/image002-map.jpg'
            const File1NewDist = 'temp/image001-map.jpg'
            const File2NewDist = 'temp/image002-map.jpg'
            const newFile1 = 'temp/backup123456'
            const newFile2 = 'temp/backup654321'
            const tempPathObjArr = [
                {backupPath: newFile1, originalPath: originalFileName1},
                {backupPath: newFile2, originalPath: originalFileName2},
            ]
            
            fs.copySync(originalFileName1, File1NewDist)
            fs.copySync(originalFileName2, File2NewDist)
            fs.moveSync(originalFileName1, newFile1)
            fs.copySync(originalFileName2, newFile2)
            
            const res = await filesRecovery(tempPathObjArr, [])
            
            expect(res).toBe(true)
            expect(fs.existsSync(originalFileName1)).toBeTruthy()
            expect(fs.existsSync(originalFileName2)).toBeTruthy()
            expect(fs.existsSync(File1NewDist)).toBeTruthy()
            expect(fs.existsSync(File2NewDist)).toBeTruthy()
            expect(fs.existsSync(newFile1)).toBeFalsy()
            expect(fs.existsSync(newFile2)).toBeFalsy()
        })
        test('should remove excessive files', async () => {
            const originalFileName1 = 'tests/test-images/image001-map.jpg'
            const originalFileName2 = 'tests/test-images/image002-map.jpg'
            const updatedName1 = 'tests/test-images/bom1.jpg'
            const updatedName2 = 'tests/test-images/bom2.jpg'
            const newFile1 = 'temp/backup123456'
            const newFile2 = 'temp/backup654321'
            const tempPathObjArr = [
                {backupPath: newFile1, originalPath: originalFileName1},
                {backupPath: newFile2, originalPath: originalFileName2},
            ]
            
            fs.copySync(originalFileName1, newFile1)
            fs.copySync(originalFileName2, newFile2)
            fs.copySync(originalFileName1, updatedName1)
            fs.copySync(originalFileName2, updatedName2)
            
            const res = await filesRecovery(tempPathObjArr, [updatedName1, updatedName2])
            
            expect(res).toBe(true)
            expect(fs.existsSync(originalFileName1)).toBeTruthy()
            expect(fs.existsSync(originalFileName2)).toBeTruthy()
            expect(fs.existsSync(updatedName1)).toBeFalsy()
            expect(fs.existsSync(updatedName2)).toBeFalsy()
            expect(fs.existsSync(newFile1)).toBeFalsy()
            expect(fs.existsSync(newFile2)).toBeFalsy()
        })
        test('should return Error if there are no backup files', async () => {
            const originalFileName1 = 'tests/test-images/image001-map.jpg'
            const originalFileName2 = 'tests/test-images/image002-map.jpg'
            const newFile1 = 'temp/backup123456'
            const newFile2 = 'temp/backup654321'
            const tempPathObjArr = [
                {backupPath: newFile1, originalPath: originalFileName1},
                {backupPath: newFile2, originalPath: originalFileName2},
            ]
            
            try {
                await filesRecovery(tempPathObjArr)
            } catch (error) {
                expect(error.message).toBe(`RECOVERY_ERROR: fs.move Error: ENOENT: no such file or directory, stat 'temp/backup123456' - tests/test-images/image001-map.jpg`)
            }
        })
    })
    describe('getSubdirectories: ', () => {
        const dir1 = 'tests/test-images'
        const dir2 = 'природа'
        const dir3 = 'bom'
        const dir4 = 'природа/активный отдых'
        const dir5 = 'пустая папка'
        const dir6 = 'there is no such folder'
        
        test('should return actual number of subdirectories', () => {
            const {numberOfSubdirectories: numberOfSubDir1} = getSubdirectories(dir1, originalPathsList)
            const {numberOfSubdirectories: numberOfSubDir2} = getSubdirectories(dir2, originalPathsList)
            const {numberOfSubdirectories: numberOfSubDir3} = getSubdirectories(dir3, originalPathsList)
            const {numberOfSubdirectories: numberOfSubDir4, subDirectories} = getSubdirectories(dir4, originalPathsList)
            const {numberOfSubdirectories: numberOfSubDir5} = getSubdirectories(dir5, originalPathsList)
            const {numberOfSubdirectories: numberOfSubDir6} = getSubdirectories(dir6, originalPathsList)
            expect(numberOfSubDir1).toBe(1)
            expect(numberOfSubDir2).toBe(6)
            expect(numberOfSubDir3).toBe(3)
            expect(numberOfSubDir4).toBe(2)
            expect(numberOfSubDir5).toBe(0)
            expect(numberOfSubDir6).toBe(0)
            expect(subDirectories).toEqual(["природа/активный отдых/video", "природа/активный отдых/эстония"])
        })
    })
})
