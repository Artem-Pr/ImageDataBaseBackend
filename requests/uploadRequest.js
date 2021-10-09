const {getExifFromArr, pushExif} = require("../utils/exifTool")
const moment = require("moment")
const {moveFileAndCleanTemp} = require("../utils/common")
const createError = require("http-errors")
const {addKeywordsToBase} = require("../utils/addKeywordsToBase")
const {addPathToBase} = require("../utils/addPathToBase")

// Сравниваем keywords из картинок и пришедшие (возможно измененные), записываем в массив новые keywords или null
// также походу добавляем все ключевые слова в массив keywordsRawList и затем в конфиг
const getKeywordsArr = (req, keywordsRawList, exifResponse, filedata) => {
	let newkeywordsRawList = []
	
	const keywordsArr = exifResponse.map((item, i) => {
		// keywords с фронта (возможно дополненные)
		const newKeywords = filedata[i].keywords
			? filedata[i].keywords.map(keyword => keyword.toString().trim())
			: []
		
		// добавляем в filedata дату создания фоточки (при необходимости)
		// нашел много разных вариантов даты, возможно надо их протестировать
		const originalDate =
			item.data[0].DateTimeOriginal ||
			item.data[0].CreateDate ||
			item.data[0].MediaCreateDate
		if (
			originalDate && (filedata[i].originalDate === '' || filedata[i].originalDate === '-')
		) {
			filedata[i].originalDate = moment(originalDate, 'YYYY:MM:DD hh:mm:ss').format('YYYY.MM.DD')
		}
		
		// keywords из exifTools (возможно не существуют, тогда возвращаем null)
		let originalKeywords = item.data[0].Keywords || []
		
		if (!Array.isArray(originalKeywords)) originalKeywords = [originalKeywords.toString()]
		else {
			originalKeywords = originalKeywords.map(item => {
				return item.toString().trim()
			})
		}
		
		newkeywordsRawList = [...keywordsRawList, ...originalKeywords, ...newKeywords, ...newkeywordsRawList]
		
		// Если keywords были удалены, то оставляем пустой массив
		if (filedata[i].keywords && filedata[i].keywords.length === 0) return []
		// Если keywords не изменены, то записываем в filedata оригинальные
		if (newKeywords.length) return newKeywords
		else return originalKeywords
	})
	
	// Складываем список keywords в config
	addKeywordsToBase(req, Array.from(new Set(newkeywordsRawList)))
	
	return keywordsArr
}


const uploadRequest = async (req, res, exiftoolProcess, databaseFolder) => {
	const url = new URL('http://localhost:5000' + req.url)
	const basePathWithoutRootDirectory = url.searchParams.get('path')
	const targetFolder = databaseFolder + '/' + basePathWithoutRootDirectory
	console.log('uploadRequest - targetFolder', targetFolder)
	let filedata = req.body
	if (!filedata) res.send("Ошибка при загрузке файлов")
	
	let pathsArr = filedata.map(dataItem => {
		console.log('fileDataItem', dataItem.name)
		return dataItem.tempPath
	})
	
	console.log('pathsArr', pathsArr)
	const exifResponse = await getExifFromArr(pathsArr, exiftoolProcess)
	
	// Сравниваем keywords из картинок и пришедшие (возможно измененные) внутри getKeywordsArr,
	// записываем в массив changedKeywordsArr новые keywords или null
	// также походу добавляем все ключевые слова в массив keywordsRawList и затем в конфиг
	let keywordsRawList = []
	const changedKeywordsArr = getKeywordsArr(req, keywordsRawList, exifResponse, filedata)
	console.log('changedKeywordsArr', changedKeywordsArr)
	
	// Записываем измененные ключевые слова в файлы в папке темп
	// Todo: cover all functions with try catch and return "throw createError(500, `oops..`)"
	await pushExif(pathsArr, changedKeywordsArr, filedata, exiftoolProcess)
	
	// Переносим картинки в папку библиотеки и добавляем в filedata относительные пути к картинкам
	filedata = filedata.map(item => {
		const targetPath = targetFolder + '/' + item.name
		console.log('targetPath', targetPath)
		
		//  Переносим видео превью туда же, куда и видео файлы
		let previewTargetPath = ''
		if (item.type.startsWith('video')) {
			const tempName = item.tempPath.slice('temp/'.length)
			const previewTempName = item.preview.slice('http://localhost:5000/images/'.length)
			const originalNamePreview = previewTempName.replace(tempName, item.name.slice(0, -4))
			previewTargetPath = targetFolder + '/' + originalNamePreview
			try {
				moveFileAndCleanTemp('temp/' + previewTempName, previewTargetPath)
			} catch (e) {
				console.error(e)
				throw createError(500, `moveFileAndCleanTemp error`)
			}
		}
		
		try {
			moveFileAndCleanTemp(item.tempPath, targetPath)
		} catch (e) {
			console.error(e)
			throw createError(500, `moveFileAndCleanTemp error`)
		}
		
		if (targetPath.startsWith(databaseFolder)) {
			item.filePath = targetPath.slice(databaseFolder.length)
			item.filePathPreview = previewTargetPath.slice(databaseFolder.length)
		} else {
			console.error('Lib Path Error! Oy-Oy!')
			throw createError(500, 'Lib Path Error! Oy-Oy!')
		}
		
		return item
	})
	
	// Подготавливаем файл базы данных
	filedata = filedata.map((image, i) => ({
		originalName: image.name,
		mimetype: image.type,
		size: image.size,
		megapixels: exifResponse[i].data[0].Megapixels,
		imageSize: exifResponse[i].data[0].ImageSize,
		keywords: changedKeywordsArr[i],
		changeDate: image.changeDate,
		originalDate: image.originalDate,
		filePath: image.filePath,
		preview: image.filePathPreview,
	}))
	
	
	//записываем путь в базу если он не равен ""
	basePathWithoutRootDirectory.trim() && addPathToBase(req, basePathWithoutRootDirectory)
	
	
	//записываем медиа файлы в базу
	const collection = req.app.locals.collection;
	try {
		const response = await collection.insertMany(filedata)
		console.log('UploadRequest - SUCCESS')
		console.log('insertedIds:', response.insertedIds)
		res.send("Файлы загружены")
	} catch (err) {
		console.log("collection insert error", err)
		throw createError(400, `collection insert error`)
	}
}

module.exports = {uploadRequest}
