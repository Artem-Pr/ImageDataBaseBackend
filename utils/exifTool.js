import fs from 'fs-extra'
import moment from "moment";

export const getExifFormPhoto = async (tempImgPath, exiftoolProcess) => {
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

export const getExifFromArr = async (pathsArr, exiftoolProcess) => {
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

export const pushExif = async (pathsArr, changedKeywordsArr, filedata, exiftoolProcess) => {
	try {
		const pid = await exiftoolProcess.open('utf8')
		console.log('Started exiftool process %s', pid)
		
		const response = pathsArr.map(async (tempImgPath, i) => {
			// if (changedKeywordsArr[i] && changedKeywordsArr[i].length) {
				const currentPhotoPath = tempImgPath.replace(/\//g, '\/')
				
				const originalDate = moment(filedata[i].originalDate, 'DD.MM.YYYY').format('YYYY:MM:DD hh:mm:ss')
				
				const response = await exiftoolProcess.writeMetadata(currentPhotoPath, {
					'keywords': changedKeywordsArr[i],
					'Subject': changedKeywordsArr[i],
					'DateTimeOriginal': originalDate,
				}, ['overwrite_original', 'codedcharacterset=utf8'])
				console.log('writeMetadata-response: ', response)
				// if (!response.data && response.error) throw new Error(response.error)
				
				return response
			// } else {
			// 	return null
			// }
		})
		await Promise.all(response)
		
		await exiftoolProcess.close()
		console.log('Closed exiftool')
	} catch (e) {
		console.error(e)
		throw createError(500, `oops..`);
	}
}
