const fs = require('fs-extra')
const moment = require("moment")
const createError = require("http-errors")
const {throwError} = require("./common")

/**
 * log to console exifTool response, return true if everything is ok,
 * throw error if something went wrong
 *
 * @param exifToolResponseArr
 * @return true
 */
const preparedResponse = exifToolResponseArr => {
	return exifToolResponseArr.reduce((sum, item, i) => {
		if (item.data) {
			console.log('exifTool-' + i + ':', item.data)
			return sum && true
		}
		if (item.error.includes('1 image files updated')) {
			console.log('exifTool-' + i + ':', '1 image files updated with WARNING')
			return sum && true
		}
		console.log('exifTool-' + i + ':', 'OOPS!', item.error)
		throw new Error('exifTool-' + i + ': OOPS!' + item.error)
	}, true)
}

/**
 * @param {string[]} fullPathsArr
 * @param {string[]} shortPaths
 * @param exiftoolProcess
 * @return {Promise<Object>}
 */
const getExifFromPhoto = async (fullPathsArr, shortPaths, exiftoolProcess) => {
	try {
		const pid = await exiftoolProcess.open('utf8')
		console.log('Started exiftool process %s', pid)
		
		const exifObjArr = {}
		for (let i = 0; i < fullPathsArr.length; i++) {
			console.log('getExifFromPhoto - filePath', fullPathsArr[i])
			const exifResponse = await exiftoolProcess.readMetadata(fullPathsArr[i], ['-File:all'])
			if (!exifResponse.data) throw new Error(exifResponse.error)
			exifObjArr[shortPaths[i]] = exifResponse.data[0]
		}
		
		return exifObjArr
	} catch (e) {
		throw throwError('getExifFromPhoto - ' + e.message)
	} finally {
		console.log('Closed exiftool')
		await exiftoolProcess.close()
	}
}

/**
 * Return array of exif strings
 *
 * @param {string[]} pathsArr - array of paths to the files
 * @param {any} exiftoolProcess
 * @returns {string[]}
 */
const getExifFromArr = async (pathsArr, exiftoolProcess) => {
	try {
		const pid = await exiftoolProcess.open('utf8')
		console.log('Started exiftool process %s', pid)
		
		const keywordsPromiseArr = pathsArr.map(async tempImgPath => {
			// const rs = fs.createReadStream(tempImgPath)
			const rs = tempImgPath.replace(/\//g, '\/')
			return exiftoolProcess.readMetadata(rs, ['-File:all'])
		})
		const exifResponse = await Promise.all(keywordsPromiseArr)
		
		await exiftoolProcess.close()
		console.log('Closed exiftool')
		
		return exifResponse
	} catch (e) {
		console.error(e)
		throw createError(500, `oops..`);
	}
}

/**
 * Push exif array.
 *
 * @param {string[]} pathsArr - array of paths to the files
 * @param {string[][]} changedKeywordsArr - array of keywords arrays
 * @param {[]} filedata - array of dataBase objects
 * @param {any} exiftoolProcess
 */
const pushExif = async (pathsArr, changedKeywordsArr, filedata, exiftoolProcess) => {
	const pid = await exiftoolProcess.open('utf8')
	
	console.log('Started exiftool process %s', pid)
	
	const responsePromise = await pathsArr.map(async (currentPath, i) => {
		const isInvalidFormat = filedata[i].type === 'video/avi'
		const isAvoidEmptyFields = filedata[i].type === 'image/gif'
		if (isInvalidFormat) {
			console.log('omit invalid format - ', filedata[i].type)
			return 'invalidFormat'
		}
		const currentPhotoPath = currentPath.replace(/\//g, '\/')
		const isChangedKeywordsItem = changedKeywordsArr[i] && changedKeywordsArr[i].length
		const keywords = isChangedKeywordsItem ? changedKeywordsArr[i] : ""
		
		let originalDate = null
		if (filedata[i].originalDate !== '' && filedata[i].originalDate !== '-') {
			originalDate = moment(filedata[i].originalDate, 'YYYY.MM.DD').format('YYYY:MM:DD hh:mm:ss')
		}
		
		const getExifField = (fieldName, fieldValue) => {
			if (isAvoidEmptyFields) {
				return fieldValue ? { [fieldName]: fieldValue.join(' ') } : undefined
			}
			return { [fieldName]: fieldValue }
		}
		
		const preparedExif = {
			...getExifField('Keywords', keywords),
			...getExifField('Subject', keywords),
			...(originalDate && {'DateTimeOriginal': originalDate}),
			...(originalDate && {'CreateDate': originalDate}),
			...(originalDate && {'MediaCreateDate': originalDate}),
		}
		
		const isEmptyExif = Object.keys(preparedExif).length === 0 && preparedExif.constructor === Object
		return isEmptyExif || await exiftoolProcess.writeMetadata(
			currentPhotoPath,
			preparedExif,
			['overwrite_original', 'codedcharacterset=utf8']
		)
	})
	const response = await Promise.all(responsePromise)
	
	await exiftoolProcess.close()
	console.log('Closed exiftool')
	
	const resWithoutInvalidFormats = response.filter(item => {
		return item !== 'invalidFormat' && item !== true
	})
	
	return preparedResponse(resWithoutInvalidFormats)
}

module.exports = {getExifFromPhoto, getExifFromArr, pushExif, preparedResponse}
