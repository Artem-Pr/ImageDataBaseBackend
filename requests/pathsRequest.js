const createError = require("http-errors")

const pathRequest = (req, response) => {
    const configCollection = req.app.locals.configCollection;
    configCollection.findOne({name: "paths"}, function (err, res) {
        if (err) {
            console.log('configCollection.findOne (path) - oops!', err)
            throw createError(400, `configCollection find path error`)
        }
        if (res) {
            response.send(res.pathsArr)
        } else {
            response.send([])
        }
    })
}

module.exports = {pathRequest}
