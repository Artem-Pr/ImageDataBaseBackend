const {logger} = require("../utils/logger")
const {getError, getSubdirectories} = require("../utils/common")

/**
 * Checking the number of files in a directory
 *
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {object} res - response object. Minimal: {send: null}
 */
const checkDirectory = async (req, res) => {
    const getDirectory = () => {
        if (!req.url) return null
        const url = new URL('http://localhost:5000' + req.url)
        const directory = url.searchParams.get('directory')
        if (!directory) {
            const error = getError('Request does not contain a required parameter')
            logger.http('GET-response', {message: '/check-directory', data: error})
            res.send(error)
        }
        return directory
    }
    
    const getDirectoryFromConfig = async directory => {
        const configCollection = req.app.locals.configCollection
        const directoriesList = await configCollection.findOne({name: "paths"})
        const isDirectory = directoriesList.pathsArr.includes(directory)
        if (!isDirectory) {
            const error = getError('There are no matching directories')
            logger.http('GET-response', {message: '/check-directory', data: error})
            res.send(error)
        }
        return {isDirectory, pathsArr: directoriesList.pathsArr}
    }
    
    try {
        const directory = getDirectory()
        if (!directory) return null
        const {isDirectory, pathsArr} = await getDirectoryFromConfig(directory)
        if (!isDirectory) return null
        const {numberOfSubdirectories} = getSubdirectories(directory, pathsArr)
        
        const collection = req.app.locals.collection
        const findObject = {$and: [{$expr: {$eq: [{$indexOfCP: ['$filePath', `/${directory}/`]}, 0]}}]}
        await collection
            .find(findObject)
            .count()
            .then(numberOfFiles => {
                logger.http('GET-response', {
                    message: '/check-directory',
                    data: {success: true, numberOfFiles, numberOfSubdirectories}
                })
                res.send({success: true, numberOfFiles, numberOfSubdirectories})
            })
    } catch (error) {
        logger.error(error.message, {module: 'checkDirectory'})
        logger.http('GET-response', {message: '/check-directory', data: error.message})
        res.send(error.message)
    }
}

module.exports = {checkDirectory}
