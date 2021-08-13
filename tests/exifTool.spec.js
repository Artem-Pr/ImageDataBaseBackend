const exiftool = require('node-exiftool')
const exiftoolBin = require('dist-exiftool')
const exiftoolProcess = new exiftool.ExiftoolProcess(exiftoolBin)
const {pushExif, preparedResponse, getExifFormPhoto} = require("../utils/exifTool")
const {pushExifFiledata, pushExifFiledataVideo} = require("./Data")

describe('ExifTool: ', () => {
	describe('preparedResponse:', () => {
		test('should return "true" if everything is good', () => {
			const exifToolResponse = [
				{data: 'object or something else', error: null},
				{data: 'object or something else', error: null}
			]
			expect(preparedResponse(exifToolResponse)).toBeTruthy()
		})
		test('should return "true" if error include "1 image files updated"', () => {
			const exifToolResponse = [
				{
					data: null,
					error: 'Warning: [minor] Maker notes could not be parsed - tests/tempPhotos/663b0881e406189cf53437abd7e687b6\n' +
						'    1 image files updated'
				},
				{data: 'object or something else', error: null}
			]
			expect(preparedResponse(exifToolResponse)).toBeTruthy()
		})
		test('should throw Error if error is caught', () => {
			const exifToolResponse = [
				{data: 'object or something else', error: null},
				{data: null, error: 'Error: There are an ERROR here'}
			]
			try {
				preparedResponse(exifToolResponse)
			} catch (error) {
				console.log(error.message)
				const isErrorIncludesExifToolMessage = error.message.includes('exifTool-1: OOPS!')
				expect(isErrorIncludesExifToolMessage).toBeTruthy()
			}
		})
	})
	
	describe('pushExif: ', () => {
		let exifFiledata
		let keywordsArr
		let pathsArr
		
		beforeEach(() => {
			exifFiledata = JSON.parse(JSON.stringify(pushExifFiledata))
			keywordsArr = exifFiledata.map((_, i) => ['big' + i, 'boss' + i])
			pathsArr = exifFiledata.map(dataItem => dataItem.tempPath)
		})
		
		afterEach(async () => {
			await pushExif(pathsArr, keywordsArr, exifFiledata, exiftoolProcess)
		})
		
		
		describe('Photos:', () => {
			test('should return true if files were updated', async () => {
				const exifToolResponse = await pushExif(pathsArr, keywordsArr, exifFiledata, exiftoolProcess)
				expect(exifToolResponse).toBeTruthy()
			})
			test('should catch exifTool ERROR', async () => {
				const wrongPathsArr = ['tests/tempPhotos/bom-bom1', 'tests/tempPhotos/bom-bom2']
				try {
					await pushExif(wrongPathsArr, keywordsArr, exifFiledata, exiftoolProcess)
				} catch (error) {
					const isErrorIncludesExifToolMessage = error.message.includes('exifTool-0: OOPS!')
					expect(isErrorIncludesExifToolMessage).toBeTruthy()
				}
			})
			test('should update keywords', async () => {
				const shortPaths = exifFiledata.map(({ tempPath }) => tempPath)
				const originalExif = await getExifFormPhoto(pathsArr, shortPaths, exiftoolProcess)
				expect(JSON.stringify(originalExif[shortPaths[0]].Keywords)).toBe('["big0","boss0"]')
				const newKeywordsArr = exifFiledata.map(() => ['MGS5'])
				const exifToolResponse = await pushExif(pathsArr, newKeywordsArr, exifFiledata, exiftoolProcess)
				expect(exifToolResponse).toBeTruthy()
				const updatedExif = await getExifFormPhoto(pathsArr, shortPaths, exiftoolProcess)
				expect(JSON.stringify(updatedExif[shortPaths[0]].Keywords)).toBe("\"MGS5\"")
			})
			test('should update DateTimeOriginal', async () => {
				const originalExif = await getExifFormPhoto(pathsArr[0], exiftoolProcess)
				expect(originalExif[0].DateTimeOriginal).toBe('2019:06:24 12:00:00')
				exifFiledata[0].originalDate = '2019.06.25'
				const exifToolResponse = await pushExif(pathsArr, [], exifFiledata, exiftoolProcess)
				expect(exifToolResponse).toBeTruthy()
				const updatedExif = await getExifFormPhoto(pathsArr[0], exiftoolProcess)
				expect(updatedExif[0].DateTimeOriginal).toBe('2019:06:25 12:00:00')
			})
			test('should update CreateDate', async () => {
				const originalExif = await getExifFormPhoto(pathsArr[0], exiftoolProcess)
				expect(originalExif[0].CreateDate).toBe('2019:06:25 12:00:00')
				exifFiledata[0].originalDate = '2019.06.24'
				const exifToolResponse = await pushExif(pathsArr, [], exifFiledata, exiftoolProcess)
				expect(exifToolResponse).toBeTruthy()
				const updatedExif = await getExifFormPhoto(pathsArr[0], exiftoolProcess)
				expect(updatedExif[0].CreateDate).toBe('2019:06:24 12:00:00')
			})
		})
		
		describe('Videos:', () => {
			let exifVideoFiledata
			let pathsVideoArr
			let newKeywordsArr
			
			beforeEach(() => {
				exifVideoFiledata = JSON.parse(JSON.stringify(pushExifFiledataVideo))
				newKeywordsArr = exifVideoFiledata.map((_, i) => ['big' + i, 'boss' + i])
				pathsVideoArr = exifVideoFiledata.map(dataItem => dataItem.tempPath)
			})
			
			afterEach(async () => {
				await pushExif(pathsVideoArr, newKeywordsArr, exifVideoFiledata, exiftoolProcess)
			})
			
			test('should return true if files were updated', async () => {
				const exifToolResponse = await pushExif(pathsVideoArr, newKeywordsArr, exifVideoFiledata, exiftoolProcess)
				expect(exifToolResponse).toBeTruthy()
			})
			test('should update keywords (subject)', async () => {
				const originalExif = await getExifFormPhoto(pathsVideoArr[0], exiftoolProcess)
				expect(JSON.stringify(originalExif[0].Subject)).toBe('["big0","boss0"]')
				const newKeywordsArr = exifVideoFiledata.map(() => ['MGS5'])
				const exifToolResponse = await pushExif(pathsVideoArr, newKeywordsArr, exifVideoFiledata, exiftoolProcess)
				expect(exifToolResponse).toBeTruthy()
				const updatedExif = await getExifFormPhoto(pathsVideoArr[0], exiftoolProcess)
				expect(JSON.stringify(updatedExif[0].Subject)).toBe("\"MGS5\"")
			})
		})
	})
})
