const {getExifFromArr, pushExif} = require("../utils/exifTool")
const moment = require("moment")
const {
    moveFileAndCleanTemp,
    getParam,
    stringToDate,
    getError,
    pickFileName,
    dateToString, getAndSendError,
} = require("../utils/common")
const createError = require("http-errors")
const {logger} = require("../utils/logger")
const {addKeywordsToBase} = require("../utils/addKeywordsToBase")
const {addPathToBase} = require("../utils/addPathToBase")
const {DBController, DBRequests} = require("../utils/DBController")
const {
    PORT,
    UPLOAD_IMAGES_TEMP_FOLDER,
    DATABASE_FOLDER,
    UPLOAD_TEMP_FOLDER,
    PREVIEWS_FOLDER,
    PREVIEWS_FOLDER_NAME,
} = require("../constants")
const {dateTimeFormat, dateFormat} = require('../utils/dateFormat');
const {PreviewCreator} = require('../utils/previewCreator/previewCreator');
const {FilePathsManager} = require('../utils/filePathsManager/filePathsManager');

// Сравниваем keywords из картинок и пришедшие (возможно измененные), записываем в массив новые keywords или null
// также походу добавляем все ключевые слова в массив keywordsRawList и затем в конфиг
const getKeywordsArr = (req, keywordsRawList, exifResponse, filedata) => {
    let newkeywordsRawList = []
    
    const keywordsArr = exifResponse.map((item, i) => {
        // keywords с фронта (возможно дополненные)
        const newKeywords = filedata[i].keywords
            ? filedata[i].keywords.map(keyword => keyword.toString().trim())
            : []
        
        // console.log('item.data[0].DateTimeOriginal-----', item.DateTimeOriginal)
        // console.log('item.data[0].CreateDate-----', item.CreateDate)
        // console.log('item.data[0].ModifyDate-----', item.ModifyDate)
        // console.log('item.data[0].MediaCreateDate-----', item.MediaCreateDate)
        // console.log('item.data[0].Keywords-----', item.Keywords)
        
        // IDB_backend_dev  | item.data[0].DateTimeOriginal----- 2008:01:01 12:00:00
        // IDB_backend_dev  | item.data[0].CreateDate----- 2008:01:01 12:00:00
        // IDB_backend_dev  | item.data[0].MediaCreateDate----- undefined
        // IDB_backend_dev  | item.data[0].Keywords----- [ 'Снег', 'лыжи', 'Оля' ]
        
        // добавляем в filedata дату создания фоточки (при необходимости)
        // нашел много разных вариантов даты, возможно надо их протестировать
        const originalDate =
            item.DateTimeOriginal ||
            item.CreateDate ||
            item.ModifyDate ||
            item.MediaCreateDate
        if (
            originalDate && (filedata[i].originalDate === '' || filedata[i].originalDate === '-')
        ) {
            filedata[i].originalDate = moment(originalDate.rawValue, dateTimeFormat).format(dateTimeFormat)
        }
        console.log('filedata[i].originalDate', filedata[i].originalDate)
        
        // keywords из exifTools (возможно не существуют, тогда возвращаем null)
        let originalKeywords = item.Keywords || []
        
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

/**
 * @param {{
 *   app: {locals: {collection: null | any}},
 *   body: null | any
 * }} req - request object
 * @param {string[]} targetPathArr
 * @return {Promise<object[]>} matchedFilesArr
 */
const checkIfFilesAreExist = async (req, targetPathArr) => {
    logger.debug('checkIfFilesAreExist - targetPathArr:', {data: targetPathArr})
    const collectionController = new DBController(
        req,
        DBRequests.findAnyFileUsingConditionOr('filePath', targetPathArr)
    )
    const matchedFilesArr = await collectionController.find('collection')
    logger.debug('matchedFilesArr:', {data: matchedFilesArr})
    return matchedFilesArr
}

const uploadRequest = async (req, res, exiftoolProcess) => {
    const basePathWithoutRootDirectory = getParam(req, 'path')
    const targetFolder = DATABASE_FOLDER + '/' + basePathWithoutRootDirectory
    logger.debug('uploadRequest - targetFolder:', {message: targetFolder, module: 'uploadRequest'})
    let filedata = req.body
    if (!filedata) {
        logger.error("Request doesn't contain filedata", {module: 'uploadRequest'})
        logger.http('POST-response', {message: '/upload', data: 'Uploading files error'})
        res.send({error: 'Uploading files error'})
    }
    
    const targetPathArr = filedata.map(({name}) => `/${basePathWithoutRootDirectory}/${name}`)
    
    // Проверка по базе данных, далее будет еще проверка по диску: checkTargetDirectories()
    const existedFilesArr = await checkIfFilesAreExist(req, targetPathArr)
    if (existedFilesArr.length) {
        const errorMessage = getError(
            `This file already exist: ${existedFilesArr.map(item => item.originalName)}`,
            'uploadRequest'
        )
        logger.http('POST-response', {message: '/upload', data: 'Error: file already exist'})
        res.send(errorMessage)
        return
    }
    
    let pathsArr = filedata.map(dataItem => {
        logger.debug('fileDataItem:', {message: dataItem.name, module: 'uploadRequest'})
        return dataItem.tempPath
    })
    
    logger.debug('pathsArr:', {data: pathsArr, module: 'uploadRequest'})
    const exifResponse = await getExifFromArr(pathsArr, exiftoolProcess)
    // console.log('exifResponse ------', exifResponse)
    // console.log('exifResponse 2 ------', exifResponse[0].data)
    // console.log('exifResponse 3 ------', exifResponse[0].data.toString())
    
    // Сравниваем keywords из картинок и пришедшие (возможно измененные) внутри getKeywordsArr,
    // записываем в массив changedKeywordsArr новые keywords или null
    // также походу добавляем все ключевые слова в массив keywordsRawList и затем в конфиг
    let keywordsRawList = []
    let changedKeywordsArr = getKeywordsArr(req, keywordsRawList, exifResponse, filedata)
    logger.debug('changedKeywordsArr:', {data: changedKeywordsArr, module: 'uploadRequest'})
    
    // Записываем измененные ключевые слова в файлы в папке темп
    // Todo: cover all functions with try catch and return "throw createError(500, `oops..`)"
    try {
        await pushExif(pathsArr, changedKeywordsArr, filedata, exiftoolProcess)
    } catch (error) {
        logger.error('pushExif - Error, continue uploading', {data: error.message})
        if (error.message.includes('File name:')) {
            res.send(getError(error.message, 'uploadRequest'))
            return
        }
    }
    
    /**
     * @type {{
     *    filedataItem: {
     *       changeDate: number,
     *       name: string,
     *       size: number,
     *       type: string,
     *       fullSizeJpgPath: string,
     *       preview: string,
     *       tempPath: string,
     *       originalPath: string,
     *       originalDate: string,
     *       keywords: null | string[],
     *       megapixels: string,
     *       rating: number,
     *       description: string,
     *     },
     *     filedataItem: object,
     *     movedFilesList: {
     *       targetFile: string,
     *       targetPreview: string,
     *       targetFullSizeJpeg: string
     *     },
     *     "exifResponseItem": {
     *        SourceFile: string,
     *        FileType: string,
     *        MIMEType: string,
     *        Megapixels: number,
     *        ImageSize: string,
     *        other: "...Long Exif list"
     *     },
     *     changedKeywordsArrItem: string[]
     * }[]}
     */
    let fullFileDataArr
    
    try {
        const root = {
            original: UPLOAD_TEMP_FOLDER,
            originalPreview: UPLOAD_TEMP_FOLDER,
            target: DATABASE_FOLDER,
            targetPreview: PREVIEWS_FOLDER,
        }
        
        const fullDataPromise = filedata.map(async (filedataItem, idx) => {
            const filePathsManager = new FilePathsManager(filedataItem, root, basePathWithoutRootDirectory)
            const successfullyMovedFiles = await filePathsManager
                .createAllFullPathsForTheFile()
                .checkTargetDirectories()
                .safelyMoveTargetFile()
                .safelyMoveTargetPreview()
                .safelyMoveTargetFullSizeJpeg()
                .combineResults()
                .getSuccessfullyMovedFiles()
            
            return {
                filedataItem,
                movedFilesList: successfullyMovedFiles,
                exifResponseItem: exifResponse[idx],
                changedKeywordsArrItem: changedKeywordsArr[idx]
            }
        })
        
        fullFileDataArr = await Promise.all(fullDataPromise)
        
        logger.debug('fullFileDataArr', {
            data: fullFileDataArr.map(item => (
                {
                    ...item, exifResponseItem: {
                        SourceFile: item.exifResponseItem.SourceFile,
                        FileType: item.exifResponseItem.FileType,
                        MIMEType: item.exifResponseItem.MIMEType,
                        Megapixels: item.exifResponseItem.Megapixels,
                        ImageSize: item.exifResponseItem.ImageSize,
                        other: '...Long Exif list'
                    }
                }
            )), module: 'uploadRequest'
        })
    } catch (err) {
        getAndSendError(
            res,
            "POST",
            '/upload',
            err.message,
            'previewPathList'
        )
    }
    
    // Подготавливаем файл базы данных
    filedata = fullFileDataArr.map(({
                                        filedataItem,
                                        changedKeywordsArrItem,
                                        exifResponseItem,
                                        movedFilesList
                                    }, idx) => ({
        originalName: filedataItem.name,
        mimetype: filedataItem.type,
        size: filedataItem.size,
        megapixels: exifResponseItem.Megapixels,
        imageSize: exifResponseItem.ImageSize,
        keywords: changedKeywordsArrItem,
        changeDate: filedataItem.changeDate,
        originalDate: stringToDate(filedataItem.originalDate),
        filePath: movedFilesList.targetFile,
        preview: movedFilesList.targetPreview,
        fullSizeJpg: movedFilesList.targetFullSizeJpeg || '',
        ...(filedataItem.rating && {rating: filedataItem.rating}),
        ...(filedataItem.description && {description: filedataItem.description}),
    }))
    
    
    //записываем путь в базу если он не равен ""
    basePathWithoutRootDirectory.trim() && void addPathToBase(req, basePathWithoutRootDirectory)
    
    
    //записываем медиа файлы в базу
    const collection = req.app.locals.collection;
    try {
        const response = await collection.insertMany(filedata)
        logger.info('UploadRequest - SUCCESS', {module: 'uploadRequest'})
        logger.debug('insertedIds:', {data: response.insertedIds, module: 'uploadRequest'})
        
        logger.http('POST-response', {message: '/upload', data: 'Files uploaded successfully'})
        res.send({success: 'Files uploaded successfully'})
    } catch (err) {
        logger.error('collection insert ERROR', {data: err, module: 'uploadRequest'})
        throw createError(400, `collection insert error`)
    }
}

module.exports = {uploadRequest}
