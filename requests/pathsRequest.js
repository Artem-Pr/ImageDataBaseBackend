const createError = require("http-errors")
const {logger} = require("../utils/logger")

const pathRequest = (req, response) => {
    const configCollection = req.app.locals.configCollection
    configCollection.findOne({name: "paths"}, function (err, res) {
        if (err) {
            logger.error('configCollection.findOne (path)', {data: err})
            throw createError(400, `configCollection find path error`)
        }
        
        const pathsArrResponse = res ? res.pathsArr : []
    
        logger.http('GET-response', {message: '/paths', data: `long-list (pathsArrResponse: ${pathsArrResponse})`})
        response.send(pathsArrResponse)
    })
}

module.exports = {pathRequest}
