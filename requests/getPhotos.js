const fs = require("fs-extra")
const createError = require("http-errors")
const sharp = require("sharp")
const {logger} = require("../utils/logger")
const {dateToString, removeFileExt} = require('../utils/common')

const getName = (dbObject) => removeFileExt(dbObject.originalName)
// const getName = (dbObject) => dbObject.size

const isOtherFolder = (dbObject, folder) => dbObject.filePath.startsWith(`/${folder}/`)

const createPreviewAndSendFiles = async (
    res,
    filteredPhotos,
    databaseFolder,
    searchPagination
) => {
    logger.debug('filteredPhotos.length: ', {message: filteredPhotos.length})
    const filesWithTempPathPromise = filteredPhotos.map(async item => {
        const fullPath = databaseFolder + item.filePath
        const staticPath = 'database' + item.filePath
        
        // если тип "video", то не делаем превью, а просто достаем его из папки, иначе делаем превью
        if (item.mimetype.startsWith('video')) {
            const fullPreviewPath = 'database' + item.preview
            item.originalPath = 'http://localhost:5000/' + staticPath
            item.preview = 'http://localhost:5000/' + fullPreviewPath
            item.tempPath = item.filePath
        } else {
            const randomName = Math.floor(Math.random() * 1000000).toString().padStart(6, "0")
            await sharp(fullPath)
                .withMetadata()
                .clone()
                .resize(300, 300, {fit: 'outside'})
                .jpeg({quality: 80})
                .toFile('temp/' + randomName + '-preview.jpg')
                .then(() => {
                    item.originalPath = 'http://localhost:5000/' + staticPath
                    item.preview = 'http://localhost:5000/images/' + randomName + '-preview.jpg'
                    item.tempPath = item.filePath
                    logger.info('Sharp SUCCESS:', {message: item.originalName})
                })
                .catch(err => logger.error('OOPS!, Sharp ERROR:', {data: err}))
        }
        return {
            ...item,
            ...(item.originalDate && {originalDate: dateToString(item.originalDate)})
        }
    })
    const filesWithTempPath = await Promise.all(filesWithTempPathPromise)
    const responseObject = {
        files: filesWithTempPath,
        searchPagination
    }
    logger.http('POST-response', {
        message: '/filtered-photos',
        data: {
            filesLength: responseObject.files.length,
            searchPagination: responseObject.searchPagination
        }
    })
    res.send(responseObject)
}

//Todo: add tests
const getFilesFromDB = async (req, res, tempFolder, databaseFolder) => {
    let filedata = req.body
    if (!filedata) {
        logger.error("Request doesn't contain filedata")
        res.send('Downloading files error')
        return
    }
    
    const folderPath = filedata.folderPath
    const nPerPage = +filedata.perPage || 0
    const isNameComparison = Boolean(filedata.isNameComparison)
    const comparisonFolder = filedata.comparisonFolder
    const includeAllTags = true
    let currentPage = +filedata.page || 1
    let searchTags = filedata.searchTags || []
    let excludeTags = filedata.excludeTags || []
    
    if (searchTags && !Array.isArray(searchTags)) searchTags = [searchTags]
    if (excludeTags && !Array.isArray(excludeTags)) excludeTags = [excludeTags]
    
    
    logger.debug('isNameComparison', {data: isNameComparison})
    logger.debug('comparisonFolder', {data: comparisonFolder})
    
    logger.debug('folderPath', {data: folderPath})
    logger.debug('searchTags', {data: searchTags})
    logger.debug('excludeTags', {data: excludeTags})
    
    // очищаем temp
    fs.emptyDirSync(tempFolder)
    
    const conditionArr = []
    // if (folderPath) conditionArr.push({$expr: {$eq: ['$filePath', "/other2"]}})
    if (folderPath) conditionArr.push({$expr: {$eq: [{$indexOfCP: ['$filePath', `/${folderPath}/`]}, 0]}})
    
    const searchTagsCondition = includeAllTags
        ? {"keywords": {$all: searchTags || []}}
        : {"keywords": {$in: searchTags || []}}
    if (searchTags.length) conditionArr.push(searchTagsCondition)
    if (excludeTags.length) conditionArr.push({"keywords": {$nin: excludeTags || []}})
    
    const findObject = conditionArr.length ? {$and: conditionArr} : {}
    
    const collection = req.app.locals.collection
    let resultsCount = 0
    let totalPages = 0
    
    const AllFoundedResults = collection.find(findObject)
    await AllFoundedResults.count().then(response => {
        resultsCount = response
        totalPages = Math.ceil(resultsCount / nPerPage)
        if (currentPage > totalPages) currentPage = 1
    })
    
    if (isNameComparison) {
        AllFoundedResults
            .sort({originalName: 1})
            .toArray(async function (err, photos) {
                if (err) {
                    logger.error("collection load error", {data: err})
                    throw createError(400, `collection load error`)
                }
                
                logger.debug('rootLibPath', {message: databaseFolder})
                logger.info('Sharp start. Number of photos:', {message: photos.length})
                const filteredPhotos = photos.filter((item, idx) => {
                    const prevItem = idx > 0 && photos[idx - 1]
                    const nextItem = idx < photos.length && photos[idx + 1]
                    if (comparisonFolder) {
                        return prevItem && isOtherFolder(item, comparisonFolder) && getName(item).startsWith(getName(prevItem)) || // сравнение имен с папкой other
                            prevItem && isOtherFolder(prevItem, comparisonFolder) && getName(prevItem).startsWith(getName(item)) ||
                            nextItem && isOtherFolder(item, comparisonFolder) && getName(item).startsWith(getName(nextItem)) ||
                            nextItem && isOtherFolder(nextItem, comparisonFolder) && getName(nextItem).startsWith(getName(item));
                    } else {
                        return prevItem && getName(item).startsWith(getName(prevItem)) ||  // сравнение имен везде
                            prevItem && getName(prevItem).startsWith(getName(item)) ||
                            nextItem && getName(item).startsWith(getName(nextItem)) ||
                            nextItem && getName(nextItem).startsWith(getName(item));
                    }
                    // return prevItem && getName(item) === getName(prevItem) || // сравнение поля size (нужно исправить также getName)
                    //     prevItem && getName(prevItem) === getName(item) ||
                    //     nextItem && getName(item) === getName(nextItem) ||
                    //     nextItem && getName(nextItem) === getName(item);
                    
                })
                
                const searchPagination = {currentPage, totalPages, nPerPage, resultsCount}
                await createPreviewAndSendFiles(res, filteredPhotos, databaseFolder, searchPagination)
            });
    } else {
        AllFoundedResults
            // .sort({mimetype: 1, originalDate: -1, filePath: 1}) // сортировка по дате, фото и видео разделены
            // .sort({originalDate: -1, filePath: 1}) // Сортировка по дате, фото и видео в перемешку
            // .sort({mimetype: 1, _id: -1}) // Последние добавленные
            .sort({originalName: 1}) // Сортировка по имени
            .skip(currentPage > 0 ? ((currentPage - 1) * nPerPage) : 0)
            .limit(nPerPage)
            .toArray(async function (err, photos) {
                if (err) {
                    logger.error("collection load error", {data: err})
                    throw createError(400, `collection load error`)
                }
                
                logger.debug('rootLibPath', {message: databaseFolder})
                logger.info('Sharp start. Number of photos:', {message: photos.length})
                
                const searchPagination = {currentPage, totalPages, nPerPage, resultsCount}
                await createPreviewAndSendFiles(res, photos, databaseFolder, searchPagination)
            });
    }
    
}

module.exports = {getFilesFromDB}
