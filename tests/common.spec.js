const fs = require('fs-extra')
const {asyncMoveFile} = require("../utils/common")
const {renameFile} = require("../utils/common")

describe('Common functions: ', () => {
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
			const fileName = 'image001-map.jpg'
			const originalFilePath = 'tests/test-images'
			const newFilePath = 'tests/testDirectory/проверка локализации'
			
			const response = await asyncMoveFile(fileName, originalFilePath, newFilePath)
			expect(response).toBe(newFilePath)
			expect(fs.existsSync(originalFilePath + '/' + fileName)).toBeFalsy()
			expect(fs.existsSync(newFilePath + '/' + fileName)).toBeTruthy()
			
			// move to original directory
			const response2 = await asyncMoveFile(fileName, newFilePath, originalFilePath)
			expect(response2).toBe(originalFilePath)
			expect(fs.existsSync(originalFilePath + '/' + fileName)).toBeTruthy()
			expect(fs.existsSync(newFilePath + '/' + fileName)).toBeFalsy()
		})
		
		test('should return an error if the same file exists', async () => {
			const fileName = 'image001-map.jpg'
			const originalFilePath = 'tests/test-images'
			const newFilePath = 'tests/testDirectory/проверка локализации'
			
			fs.copySync(originalFilePath + '/' + fileName, newFilePath + '/' + fileName)
			try {
				await asyncMoveFile(fileName, originalFilePath, newFilePath)
			} catch (error) {
				expect(error.message).toBe(`fs.move Error: dest already exists. - ${newFilePath}/${fileName}`)
			}
			
			// remove copied file
			fs.removeSync(newFilePath + '/' + fileName)
		})
	})
})
