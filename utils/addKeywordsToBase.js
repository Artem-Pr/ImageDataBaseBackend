const createError = require("http-errors")
const {logger} = require("./logger")

/**
 * Todo: add test if there is no keywords field
 * @param {Array<Object>} updateFields {
            originalName: string,
            originalDate: string,
            filePath: string
            keywords: string[]
         }[]
 * @return {string[]} KeywordsList
 */
const getKeywordsFromUpdateFields = (updateFields) => {
    const keywordsList = updateFields.reduce(((previousValue, currentValue) => {
        return currentValue.keywords ? [...previousValue, ...currentValue.keywords] : previousValue
    }), [])
    return Array.from(new Set(keywordsList))
}

// Складываем список keywords в config
// Todo: update implementation using async await
// Todo: add tests
/**
 *
 * @param {Object} req
 * @param {Array<string>} keywordsRawList
 */
const addKeywordsToBase = (req, keywordsRawList) => {
    const newKeywords = [...keywordsRawList]
    const configCollection = req.app.locals.configCollection;
    configCollection.findOne({name: "keywords"}, function (err, res) {
        if (err) {
            logger.error('configCollection.findOne (keywords):', {data: err, module: 'addKeywordsToBase'})
            throw createError(400, `configCollection find keywords error`)
        }
        if (!res) {
            configCollection.insertOne({name: "keywords", keywordsArr: newKeywords.sort()}, function (err) {
                if (err) {
                    logger.error('configCollection insert keywords ERROR:', {data: err, module: 'addKeywordsToBase'})
                    throw createError(400, `configCollection insert keywords error`)
                }
            })
        } else {
            const keywordsSet = new Set([...res.keywordsArr, ...newKeywords])
            keywordsSet.delete('')
            const newKeywordsArr = Array.from(keywordsSet).sort()
            configCollection.updateOne({name: "keywords"}, {$set: {keywordsArr: newKeywordsArr}}, function (err) {
                if (err) {
                    logger.error('configCollection updateOne keywordsArr ERROR:', {
                        data: err,
                        module: 'addKeywordsToBase'
                    })
                    throw createError(400, `configCollection updateOne keywordsArr error`)
                }
                logger.info('addKeywordsToBase - SUCCESS')
            })
        }
    })
}

module.exports = {addKeywordsToBase, getKeywordsFromUpdateFields}
