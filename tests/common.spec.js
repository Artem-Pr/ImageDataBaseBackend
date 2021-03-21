const fs = require('fs-extra')
const {renameFile} = require("../utils/common")

describe('Common functions: ', () => {
	describe('Rename File func', () => {
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
})
