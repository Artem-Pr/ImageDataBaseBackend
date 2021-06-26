const fs = require('fs-extra')
const moment = require("moment")
const createError = require("http-errors")

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

const getExifFormPhoto = async (tempImgPath, exiftoolProcess) => {
	try {
		const pid = await exiftoolProcess.open('utf8')
		console.log('Started exiftool process %s', pid)
		
		console.log('getExifFormPhoto - tempImgPath', tempImgPath)
		const rs = fs.createReadStream(tempImgPath)
		const exifResponse = await exiftoolProcess.readMetadata(rs, ['-File:all'])
		
		await exiftoolProcess.close()
		console.log('Closed exiftool')
		
		return exifResponse.data
	} catch (e) {
		console.error(e)
		throw createError(500, `oops..`);
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
			return await exiftoolProcess.readMetadata(rs, ['-File:all'])
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
	
	const responsePromise = await pathsArr.map(async (tempImgPath, i) => {
		const isInvalidFormat = filedata[i].type === 'video/avi'
		if (isInvalidFormat) {
			console.log('omit invalid format - ', filedata[i].type)
			return 'invalidFormat'
		}
		const currentPhotoPath = tempImgPath.replace(/\//g, '\/')
		const keywords = changedKeywordsArr[i]?.length ? changedKeywordsArr[i] : ""
		
		let originalDate = null
		if (filedata[i].originalDate !== '' && filedata[i].originalDate !== '-') {
			originalDate = moment(filedata[i].originalDate, 'YYYY.MM.DD').format('YYYY:MM:DD hh:mm:ss')
		}
		
		return await exiftoolProcess.writeMetadata(currentPhotoPath, {
			'keywords': keywords,
			'Subject': keywords,
			...(originalDate && {'DateTimeOriginal': originalDate}),
			...(originalDate && {'CreateDate': originalDate}),
			...(originalDate && {'MediaCreateDate': originalDate}),
		}, ['overwrite_original', 'codedcharacterset=utf8'])
	})
	const response = await Promise.all(responsePromise)
	
	await exiftoolProcess.close()
	console.log('Closed exiftool')
	
	const resWithoutInvalidFormats = response.filter(item => item !== 'invalidFormat')
	
	return preparedResponse(resWithoutInvalidFormats)
}

module.exports = {getExifFormPhoto, getExifFromArr, pushExif, preparedResponse}
