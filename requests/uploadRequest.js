const {getExifFromArr, pushExif} = require("../utils/exifTool")
const moment = require("moment")
const {getConfig, moveFileAndCleanTemp} = require("../utils/common")
const createError = require("http-errors")
const addPathToBase = require("../utils/addPathToBase")

// Складываем список keywords в config
const putKeywordsToConfig = (req, configPath, keywordsRawList) => {
	const configCollection = req.app.locals.configCollection;
	configCollection.findOne({name: "keywords"}, function (err, res) {
		if (err) {
			console.log('configCollection.findOne (keywords) - oops!', err)
			throw createError(400, `configCollection find keywords error`)
		}
		if (!res) {
			configCollection.insertOne({name: "keywords", keywordsArr: keywordsRawList.sort()}, function (err) {
				if (err) {
					console.log("Oops!- configCollection insert keywords error", err)
					throw createError(400, `configCollection insert keywords error`)
				}
			})
		} else {
			const keywordsSet = new Set([...res.keywordsArr, ...keywordsRawList])
			keywordsSet.delete('')
			const newKeywordsArr = Array.from(keywordsSet).sort()
			configCollection.updateOne({name: "keywords"}, {$set: {keywordsArr: newKeywordsArr}}, function (err) {
				if (err) {
					console.log("Oops!- configCollection updateOne keywordsArr Error - ", err)
					throw createError(400, `configCollection updateOne keywordsArr error`)
				}
			})
		}
	})
}

// Сравниваем keywords из картинок и пришедшие (возможно измененные), записываем в массив новые keywords или null
// также походу добавляем все ключевые слова в массив keywordsRawList и затем в конфиг
const getKeywordsArr = (req, keywordsRawList, exifResponse, filedata, configPath) => {
	let newkeywordsRawList = []
	
	const keywordsArr = exifResponse.map((item, i) => {
		// keywords с фронта (возможно дополненные)
		const newKeywords = filedata[i].keywords
			? filedata[i].keywords.map(item => item.toString().trim())
			: []
		
		// добавляем в filedata дату создания фоточки (при необходимости)
		// нашел много разных вариантов даты, возможно надо их протестировать
		const originalDate =
			item.data[0].DateTimeOriginal ||
			item.data[0].CreateDate ||
			item.data[0].MediaCreateDate
		console.log('originalDate-------------', originalDate)
		console.log('filedata[i].originalDate-------------', filedata[i].originalDate)
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
				console.log('item', item.toString())
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
	putKeywordsToConfig(req, configPath, newkeywordsRawList)
	
	return keywordsArr
}


const uploadRequest = async (req, res, exiftoolProcess, configPath, databaseFolder) => {
	const basePathWithoutRootDirectory = req.headers.path
	const targetFolder = databaseFolder + '/' + basePathWithoutRootDirectory
	let filedata = req.body
	if (!filedata) res.send("Ошибка при загрузке файла")
	console.log('filedataArr', filedata)
	
	let pathsArr = filedata.map(dataItem => {
		console.log('fileDataItem', dataItem)
		return dataItem.tempPath
	})
	
	console.log('pathsArr', pathsArr)
	const exifResponse = await getExifFromArr(pathsArr, exiftoolProcess)
	console.log('exifResponse---------', exifResponse.map(item => item.data))
	console.log('filedataArr----------', filedata)
	
	// Сравниваем keywords из картинок и пришедшие (возможно измененные) внутри getKeywordsArr,
	// записываем в массив changedKeywordsArr новые keywords или null
	// также походу добавляем все ключевые слова в массив keywordsRawList и затем в конфиг
	let keywordsRawList = []
	const changedKeywordsArr = getKeywordsArr(req, keywordsRawList, exifResponse, filedata, configPath)
	console.log('changedKeywordsArr', changedKeywordsArr)
	
	// Записываем измененные ключевые слова в файлы в папке темп
	// Todo: cover all functions with try catch and return "throw createError(500, `oops..`)"
	await pushExif(pathsArr, changedKeywordsArr, filedata, exiftoolProcess)
	
	// Получаем корневой адрес библиотеки
	const libPath = JSON.parse(getConfig(configPath)).libPath
	
	// Переносим картинки в папку библиотеки и добавляем в filedata относительные пути к картинкам
	filedata = filedata.map(item => {
		const targetPath = targetFolder + '/' + item.name
		console.log('item.tempPath', item.tempPath)
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
		
		if (targetPath.startsWith(libPath)) {
			item.filePath = targetPath.slice(libPath.length)
			item.filePathPreview = previewTargetPath.slice(libPath.length)
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
	collection.insertMany(filedata, function (err, result) {
		if (err) {
			console.log("collection insert error", err)
			throw createError(400, `collection insert error`)
		}
		console.log(result)
		res.send("Файл загружен")
	})
}

module.exports = {uploadRequest}
