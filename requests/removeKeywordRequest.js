const {logger} = require('../utils/logger')
const {getUnusedKeywordsFromDB} = require('./getUnusedKeywordsRequest')

/**
 * @param {object} res - response object. Minimal: {send: null}
 * @param {string} message
 */
const sendErrorMessage = (res, message) => {
    logger.http('DELETE-response', {message: '/keyword/:keyword', data: {message}})
    res.status(400).send({message})
}

/**
 * Request to remove an unused keyword from the database config
 *
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {object} res - response object. Minimal: {send: null}
 */
const removeKeywordRequest = async (req, res) => {
    const { keyword } = req.params;
    const configCollection = req.app.locals.configCollection;
    
    try {
        const unusedKeywordsList = await getUnusedKeywordsFromDB(req)
        const keywordIsUnused = unusedKeywordsList.includes(keyword)
        
        if (!keywordIsUnused) {
            sendErrorMessage(res, 'Keyword is not Unused')
            return
        }
    
        const {modifiedCount} = await configCollection.updateOne(
            { name: 'keywords' },
            { $pull: { keywordsArr: keyword } }
        );
        
        if (modifiedCount !== 1) {
            sendErrorMessage(res, `modifiedCount: ${modifiedCount}`)
            return
        }
        
        logger.http('DELETE-response', {message: '/keyword/:keyword', data: {success: 'Keyword removed'}})
        res.status(200).send({success: 'Keyword removed'})
    } catch (err) {
        logger.error("collection load error:", {message: err.message})
        res.status(500).send({message: `collection load error: ${err.message}`})
    }
}

module.exports = {removeKeywordRequest}
