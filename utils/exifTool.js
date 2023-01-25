const moment = require("moment")
const createError = require("http-errors")
const {throwError} = require("./common")
const {logger} = require("./logger")
const {dateTimeFormat} = require('./dateFormat');

/**
 * log exifTool response, return true if everything is ok,
 * throw error if something went wrong
 *
 * @param exifToolResponseArr
 * @return true
 */
const preparedResponse = exifToolResponseArr => {
    return exifToolResponseArr.reduce((sum, item, i) => {
        if (item.data) {
            logger.info(`exifTool-${i}:`, {data: item.data})
            return sum && true
        }
        if (item.error.includes('1 image files updated')) {
            logger.info(`exifTool-${i}:`, {message: '1 image files updated with WARNING'})
            return sum && true
        }
        logger.error(`exifTool-${i}:`, {data: item.error})
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
    const exifObjArr = {}
    
    try {
        const pid = await exiftoolProcess.open('utf8')
        logger.info('Started exiftool process %s', {data: pid})
        
        for (let i = 0; i < fullPathsArr.length; i++) {
            logger.debug('getExifFromPhoto - filePath:', {message: fullPathsArr[i]})
            const exifResponse = await exiftoolProcess.readMetadata(fullPathsArr[i], ['-File:all'])
            if (!exifResponse.data) throw new Error(exifResponse.error)
            exifObjArr[shortPaths[i]] = exifResponse.data[0]
        }
    } catch (e) {
        throw throwError('getExifFromPhoto - ' + e.message)
    } finally {
        logger.info('Close exiftool')
        await exiftoolProcess.close()
    }
    
    return exifObjArr
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
        logger.info('Started exiftool process %s', {data: pid})
        
        const keywordsPromiseArr = pathsArr.map(async tempImgPath => {
            // const rs = fs.createReadStream(tempImgPath)
            const rs = tempImgPath.replace(/\//g, '\/')
            return exiftoolProcess.readMetadata(rs, ['-File:all'])
        })
        const exifResponse = await Promise.all(keywordsPromiseArr)
        
        await exiftoolProcess.close()
        logger.info('Close exiftool')
        
        return exifResponse
    } catch (e) {
        logger.error('',{data: e})
        throw createError(500, `oops..`);
    }
}

/**
 *
 * @param {string} type
 * @return {boolean}
 */
const isInvalidFormat = (type) => (type === 'video/avi') || (type === 'video/wmv')

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
    
    logger.info('Started exiftool process %s', {data: pid})
    
    const responsePromise = pathsArr.map(async (currentPath, i) => {
        const isAvoidEmptyFields = filedata[i].type === 'image/gif'
        if (isInvalidFormat(filedata[i].type)) {
            logger.info('omit invalid format -', {message: filedata[i].type})
            return 'invalidFormat'
        }
        const currentPhotoPath = currentPath.replace(/\//g, '\/')
        const isChangedKeywordsItem = changedKeywordsArr[i] && changedKeywordsArr[i].length
        const keywords = isChangedKeywordsItem ? changedKeywordsArr[i] : ""
        
        let originalDate = null
        if (
            filedata[i].originalDate
            && filedata[i].originalDate !== ''
            && filedata[i].originalDate !== '-'
        ) {
            originalDate = moment(filedata[i].originalDate, dateTimeFormat).format(dateTimeFormat)
        }
        
        const getExifField = (fieldName, fieldValue) => {
            if (isAvoidEmptyFields) {
                return fieldValue ? {[fieldName]: fieldValue.join(' ')} : undefined
            }
            return {[fieldName]: fieldValue}
        }
        
        const preparedExif = {
            ...getExifField('Keywords', keywords),
            ...getExifField('Subject', keywords),
            ...(originalDate && {'DateTimeOriginal': originalDate}),
            ...(originalDate && {'CreateDate': originalDate}),
            ...(originalDate && {'MediaCreateDate': originalDate}),
            ...(filedata[i].rating && {'Rating': filedata[i].rating}),
            ...(filedata[i].description && {'Description': filedata[i].description}),
            ...(filedata[i].description && {'ImageDescription': filedata[i].description}),
            ...(filedata[i].description && {'Caption-Abstract': filedata[i].description}),
            ...(filedata[i].description && {'UserComment': filedata[i].description}),
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
    logger.info('Closed exiftool')
    
    const resWithoutInvalidFormats = response.filter(item => {
        return item !== 'invalidFormat' && item !== true
    })
    
    return preparedResponse(resWithoutInvalidFormats)
}

module.exports = {getExifFromPhoto, getExifFromArr, pushExif, preparedResponse}
