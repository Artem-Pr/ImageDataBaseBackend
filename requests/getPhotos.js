const fs = require("fs-extra")
const sharp = require("sharp")
const {isEmpty} = require("ramda")
const {logger} = require("../utils/logger")
const {dateToString, removeFileExt, isVideoDBFile} = require('../utils/common')
const {DBRequests} = require('../utils/DBController');
const {
    PORT,
    IMAGES_TEMP_FOLDER,
    DATABASE_FOLDER_NAME,
    TEMP_FOLDER,
    DATABASE_FOLDER,
} = require('../constants')

const getName = (dbObject) => removeFileExt(dbObject.originalName)
// const getName = (dbObject) => dbObject.size //нужно для изменения вариантов сравнения

const isOtherFolder = (dbObject, folder) => dbObject.filePath.startsWith(`/${folder}/`)

const createPreviewAndSendFiles = async (
    res,
    filteredPhotos,
    searchPagination,
    filesSizeSum,
    isFullSizePreview,
) => {
    logger.debug('filteredPhotos.length: ', {message: filteredPhotos.length})
    const filesWithTempPathPromise = filteredPhotos.map(async item => {
        const fullPath = DATABASE_FOLDER + item.filePath
        const staticPath = DATABASE_FOLDER_NAME + item.filePath
        const isVideo = isVideoDBFile(item)
        
        if (isFullSizePreview) {
            logger.info('FULL SIZE PREVIEW MODE: ON', {message: item.originalName})
            item.originalPath = `http://localhost:${PORT}/${staticPath}`
            item.tempPath = item.filePath
            item.preview = isVideo
                ? `http://localhost:${PORT}/${DATABASE_FOLDER_NAME}${item.preview}`
                : `http://localhost:${PORT}/${staticPath}`
        } else {
            // если тип "video", то не делаем превью, а просто достаем его из папки, иначе делаем превью
            if (isVideo) {
                const fullPreviewPath = DATABASE_FOLDER_NAME + item.preview
                item.originalPath = `http://localhost:${PORT}/${staticPath}`
                item.preview = `http://localhost:${PORT}/${fullPreviewPath}`
                item.tempPath = item.filePath
            } else {
                logger.info('FULL SIZE PREVIEW MODE: OFF', {message: item.originalName})
                const randomName = Math.floor(Math.random() * 1000000).toString().padStart(6, "0")
                await sharp(fullPath)
                    .withMetadata()
                    .clone()
                    .resize(300, 300, {fit: 'outside'})
                    .jpeg({quality: 80})
                    .toFile(`${TEMP_FOLDER}/${randomName}-preview.jpg`)
                    .then(() => {
                        item.originalPath = `http://localhost:${PORT}/${staticPath}`
                        item.preview = `http://localhost:${PORT}/${IMAGES_TEMP_FOLDER}/${randomName}-preview.jpg`
                        item.tempPath = item.filePath
                        logger.info('Sharp SUCCESS:', {message: item.originalName})
                    })
                    .catch(err => logger.error('OOPS!, Sharp ERROR:', {data: err}))
            }
        }
        
        return {
            ...item,
            ...(item.originalDate && {originalDate: dateToString(item.originalDate)})
        }
    })
    const filesWithTempPath = await Promise.all(filesWithTempPathPromise)
    const responseObject = {
        files: filesWithTempPath,
        searchPagination,
        filesSizeSum
    }
    logger.http('POST-response', {
        message: '/filtered-photos',
        data: {
            filesLength: responseObject.files.length,
            searchPagination: responseObject.searchPagination,
            filesSizeSum
        }
    })
    res.send(responseObject)
}

//Todo: add tests
/**
 * Checking the number of files in a directory
 *
 * @param {
 *  {
 *      app: {locals: {collection: {
 *          aggregate: (Array, object) => ({toArray: () => Promise<any>})
 *      }}},
 *      body: null
 *  }
 * } req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {object} res - response object. Minimal: {send: null}
 */
const getFilesFromDB = async (req, res) => {
    let filedata = req.body
    if (!filedata) {
        logger.error("Request doesn't contain filedata")
        res.send('Downloading files error')
        return
    }
    
    const randomSort = Boolean(filedata.randomSort)
    const sorting = filedata.sorting
    const folderPath = filedata.folderPath
    const nPerPage = +filedata.perPage || 0
    const isNameComparison = Boolean(filedata.isNameComparison)
    const comparisonFolder = filedata.comparisonFolder
    const showSubfolders = filedata.showSubfolders
    const includeAllTags = true
    const types = filedata.mimetypes || []
    const isFullSizePreview = Boolean(filedata.isFullSizePreview)
    const filterDateRange = filedata.dateRange
    let currentPage = +filedata.page || 1
    let searchTags = filedata.searchTags || []
    let excludeTags = filedata.excludeTags || []
    
    if (searchTags && !Array.isArray(searchTags)) searchTags = [searchTags]
    if (excludeTags && !Array.isArray(excludeTags)) excludeTags = [excludeTags]
    
    
    logger.debug('randomSort', {data: randomSort})
    logger.debug('sorting', {data: JSON.stringify(sorting)})
    
    logger.debug('isNameComparison', {data: isNameComparison})
    logger.debug('comparisonFolder', {data: comparisonFolder})
    
    logger.debug('folderPath', {data: folderPath})
    logger.debug('showSubfolders', {data: showSubfolders})
    logger.debug('searchTags', {data: searchTags})
    logger.debug('excludeTags', {data: excludeTags})
    logger.debug('types', {data: types})
    logger.debug('filterDateRange', {data: filterDateRange})
    
    // очищаем temp
    fs.emptyDirSync(TEMP_FOLDER)
    
    const conditionArr = []
    
    if (folderPath && showSubfolders) conditionArr.push(
        {$expr: {$eq: [{$indexOfCP: ['$filePath', `/${folderPath}/`]}, 0]}}
    )
    if (folderPath && !showSubfolders) {
        conditionArr.push(DBRequests.getFilesExcludeFilesInSubfolders(folderPath))
    }
    
    const searchTagsCondition = includeAllTags
        ? {keywords: {$all: searchTags || []}}
        : {keywords: {$in: searchTags || []}}
    if (searchTags.length) conditionArr.push(searchTagsCondition)
    if (excludeTags.length) conditionArr.push({keywords: {$nin: excludeTags || []}})
    if (types.length) {
        const mimeTypeObjArr = types.map(type => ({mimetype: type}))
        conditionArr.push({$or: mimeTypeObjArr})
    }
    if (filterDateRange) {
        const startDate = new Date(filterDateRange[0])
        const endDate = new Date(filterDateRange[1])
        
        conditionArr.push(
            {originalDate:{$gte: startDate, $lt: endDate}}
        )
    }
    
    const findObject = conditionArr.length ? {$and: conditionArr} : {}
    
    const collection = req.app.locals.collection
    
    const aggregationMatch = {$match: findObject}
    const aggregationSort = {$sort: sorting}
    const aggregationSample = {$sample: {size: nPerPage}}
    const aggregationResponse = {
        $facet: {
            response: [
                {$skip: currentPage > 0 ? ((currentPage - 1) * nPerPage) : 0},
                {$limit: nPerPage},
            ],
            total: [
                {$group: {_id: null, filesSizeSum: {$sum: '$size'}}},
                {$unset: "_id"}
            ],
            pagination: [
                {$count: 'resultsCount'},
                {
                    $addFields: {
                        totalPages: {
                            $ceil: {
                                $divide: ['$resultsCount', nPerPage],
                            }
                        },
                    }
                },
                {
                    $addFields: {
                        currentPage: {
                            $cond: [{$gt: [currentPage, '$totalPages']}, 1, currentPage]
                        }
                    }
                }
            ]
        }
    }
    
    let aggregationArray = [aggregationMatch]
    !(randomSort || isEmpty(sorting)) && aggregationArray.push(aggregationSort)
    randomSort && aggregationArray.push(aggregationSample)
    aggregationArray.push(aggregationResponse)
    
    const comparisonAggregationArray = [
        {$match: findObject},
        {$sort: {originalName: 1}},
        {
            $facet: {
                response: [],
                total: [
                    {$group: {_id: null, filesSizeSum: {$sum: '$size'}}},
                    {$unset: "_id"}
                ],
                pagination: []
            }
        }
    ]
    
    try {
        const [mongoResponse] = await collection
            .aggregate(
                isNameComparison
                    ? comparisonAggregationArray
                    : aggregationArray,
                {allowDiskUse: true})
            .toArray()
        
        const {response, total, pagination} = mongoResponse
        const filesSizeSum = total[0] ? total[0].filesSizeSum : 0
        
        logger.debug('rootLibPath', {message: DATABASE_FOLDER})
        logger.info('Sharp start. Number of photos:', {message: response.length})
        
        if (!isNameComparison) {
            const {resultsCount, totalPages, currentPage} = pagination.length
                ? pagination[0]
                : {resultsCount: 0, totalPages: 0, currentPage: 0}
            const searchPagination = {currentPage, totalPages, nPerPage, resultsCount}
            
            await createPreviewAndSendFiles(res, response, searchPagination, filesSizeSum, isFullSizePreview)
            return
        }
        
        const filteredPhotos = response.filter((item, idx) => {
            const prevItem = idx > 0 && response[idx - 1]
            const nextItem = idx < response.length && response[idx + 1]
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
        
        const searchPagination = {currentPage: 1, totalPages: 1, nPerPage: 100, resultsCount: 0}
        await createPreviewAndSendFiles(res, filteredPhotos, searchPagination, filesSizeSum, isFullSizePreview)
    } catch (err) {
        logger.error("collection load error:", {message: err.message})
        res.status(500).send({message: `collection load error: ${err.message}`})
    }
}

module.exports = {getFilesFromDB}
