const fs = require('fs-extra')
const {updateFiledata, originalFiledata} = require("./Data")
const {
	renameFile,
	asyncMoveFile,
	updateNamePath,
	backupFiles,
	cleanBackup,
	fileRecovery,
} = require("../utils/common")

describe('Common functions: ', () => {
	afterEach(() => {
		// temp cleaning
		fs.emptyDirSync('temp')
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
	})
	describe('updateNamePath: ', () => {
		test('should return new namePath', async () => {
			const newNamePath = updateNamePath(originalFiledata[0], updateFiledata[0])
			expect(newNamePath).toBe('tests/test-images/123.jpg')
		})
	})
	describe('backupFiles: ', () => {
		test('should return array of tempPath objects', async () => {
			const originalFileName1 = 'tests/test-images/image001-map.jpg'
			const originalFileName2 = 'tests/test-images/image002-map.jpg'
			const filesBackup = await backupFiles([originalFileName1, originalFileName2])
			
			expect(filesBackup).toHaveLength(2)
			
			const backup1 = filesBackup[0]
			const backup2 = filesBackup[1]
			
			expect(backup1?.backupPath.startsWith('temp/backup')).toBeTruthy()
			expect(backup1?.backupPath).toHaveLength(11)
			expect(backup2?.backupPath.startsWith('temp/backup')).toBeTruthy()
			expect(backup2?.backupPath).toHaveLength(11)
			expect(backup1?.originalPath.startsWith('tests/')).toBeTruthy()
			expect(backup2?.originalPath.startsWith('tests/')).toBeTruthy()
		})
		test('should create temp files', async () => {
			const originalFileName1 = 'tests/test-images/image001-map.jpg'
			const originalFileName2 = 'tests/test-images/image002-map.jpg'
			const filesBackup = await backupFiles([originalFileName1, originalFileName2])
			
			const backup1 = filesBackup[0]
			const backup2 = filesBackup[1]
			
			expect(fs.existsSync(backup1?.backupPath)).toBeTruthy()
			expect(fs.existsSync(backup2?.backupPath)).toBeTruthy()
			expect(fs.existsSync(backup1?.originalPath)).toBeTruthy()
			expect(fs.existsSync(backup2?.originalPath)).toBeTruthy()
		})
		test('should return Error if originalPath is wrong', async () => {
			const originalFileName1 = 'tests/test-images/image001-map.jpg'
			const originalFileName2 = 'tests/test-images/wrong-address.jpg'
			try {
				await backupFiles([originalFileName1, originalFileName2])
			} catch (error) {
				expect(error.message).toBe(`BACKUP_FILES: fs.copy Error:`)
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
			
			const res = await fileRecovery(tempPathObjArr)
			
			expect(res).toBe(true)
			expect(fs.existsSync(originalFileName1)).toBeTruthy()
			expect(fs.existsSync(originalFileName2)).toBeTruthy()
			expect(fs.existsSync(File1NewDist)).toBeTruthy()
			expect(fs.existsSync(File2NewDist)).toBeTruthy()
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
				await fileRecovery(tempPathObjArr)
			} catch (error) {
				expect(error.message).toBe(`RECOVERY_ERROR: fs.copy Error:`)
			}
		})
	})
})
