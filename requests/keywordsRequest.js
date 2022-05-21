const fs = require("fs-extra")
const createError = require("http-errors")
const {logger} = require("../utils/logger")

const keywordsRequest = (request, response, tempFolder) => {
    logger.debug('tempFolder', {message: tempFolder})
    // temp clearing
    fs.emptyDirSync(tempFolder);
    
    const configCollection = request.app.locals.configCollection;
    configCollection.findOne({name: "keywords"}, function (err, res) {
        if (err) {
            logger.error('configCollection.findOne (keywords)', {data: err})
            throw createError(400, `configCollection find keywords error`)
        }
    
        const keywordsRes = res ? res.keywordsArr : []
        
        logger.http('GET-response', {message: '/keywords', data: `long-list (keywordsRes: ${keywordsRes})`})
        response.send(keywordsRes)
    })
}

module.exports = {keywordsRequest}
