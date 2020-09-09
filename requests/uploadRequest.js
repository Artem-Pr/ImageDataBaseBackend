import {getExifFromArr, pushExif} from "../utils/exifTool"
import moment from "moment"
import {getConfig, moveFileAndCleanTemp} from "../utils/common"
import createError from "http-errors"
import fs from "fs-extra"

// Складываем список keywords в config
const putKeywordsToConfigFile = (configPath, keywordsRawList) => {
	const config = JSON.parse(getConfig(configPath))
	const keywordsSet = new Set([...config.keywords, ...keywordsRawList])
	const configObj = { ...config, keywords: [...keywordsSet].sort() }
	fs.writeFileSync(configPath, JSON.stringify(configObj))
}

// Сравниваем keywords из картинок и пришедшие (возможно измененные), записываем в массив новые keywords или null
// также походу добавляем все ключевые слова в массив keywordsRawList
const getKeywordsArr = (keywordsRawList, exifResponse, filedata) => {
	return exifResponse.map((item, i) => {
		// keywords с фронта (возможно дополненные)
		const newKeywords = filedata[i].keywords
			? filedata[i].keywords.map(item => item.toString().trim())
			: []
		
		// добавляем в filedata дату создания фоточки
		// нашел много разных вариантов даты, возможно надо их протестировать
		const originalDate = item.data[0].DateTimeOriginal
		if (originalDate) {
			filedata[i].originalDate = moment(originalDate, 'YYYY:MM:DD hh:mm:ss').format('DD.MM.YYYY')
		}
		
		// keywords из exifTools (возможно не существуют, тогда возвращаем null)
		let originalKeywords = item.data[0].Keywords || []
		
		if (!Array.isArray(originalKeywords)) originalKeywords = [originalKeywords]
		else {
			originalKeywords = originalKeywords.map(item => {
				console.log('item', item.toString())
				return item.toString().trim()
			})
		}
		
		keywordsRawList = [...keywordsRawList, ...originalKeywords, ...newKeywords]
		
		// Если keywords были удалены, то оставляем пустой массив
		if (filedata[i].keywords && filedata[i].keywords.length === 0) return []
		// Если keywords не изменены, то записываем в filedata оригинальные
		if (newKeywords.length) return newKeywords
		else return originalKeywords
	})
}



export const uploadRequest = async (req, res, exiftoolProcess, configPath) => {
	const targetFolder = req.headers.path
	let filedata = req.body
	if (!filedata) res.send("Ошибка при загрузке файла")
	console.log('filedataArr', filedata)
	
	let pathsArr = filedata.map(dataItem => {
		console.log('fileDataItem', dataItem)
		return dataItem.tempPath
	})
	
	console.log('pathsArr', pathsArr)
	const exifResponse = await getExifFromArr(pathsArr, exiftoolProcess)
	
	// Сравниваем keywords из картинок и пришедшие (возможно измененные) внутри getKeywordsArr,
	// записываем в массив changedKeywordsArr новые keywords или null
	// также походу добавляем все ключевые слова в массив keywordsRawList
	let keywordsRawList = []
	const changedKeywordsArr = getKeywordsArr(keywordsRawList, exifResponse, filedata)
	console.log('changedKeywordsArr', changedKeywordsArr)
	
	// Записываем измененные ключевые слова в файлы в папке темп
	await pushExif(pathsArr, changedKeywordsArr, exiftoolProcess)
	
	// Получаем корневой адрес библиотеки
	const libPath = JSON.parse(getConfig(configPath)).libPath
	
	// Переносим картинки в папку библиотеки и добавляем в filedata относительные пути к картинкам
	filedata = filedata.map(item => {
		const targetPath = targetFolder + '/' + item.name
		try {
			moveFileAndCleanTemp(item.tempPath, targetPath)
		} catch (e) {
			console.error(e)
			throw createError(500, `moveFileAndCleanTemp error`)
		}
		
		if (targetPath.startsWith(libPath)) {
			item.filePath = targetPath.slice(libPath.length)
		} else {
			console.error('Lib Path Error! Oy-Oy!')
			throw createError(500, 'Lib Path Error! Oy-Oy!')
		}
		
		return item
	})
	
	// Складываем список keywords в config
	putKeywordsToConfigFile(configPath, keywordsRawList)
	
	// Подготавливаем файл базы данных
	filedata = filedata.map((image, i) => ({
		originalName: image.name,
		mimetype: image.type,
		size: image.size,
		megapixels: image.megapixels,
		keywords: changedKeywordsArr[i],
		changeDate: image.changeDate,
		originalDate: image.originalDate,
		filePath: image.filePath,
	}))
	
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
