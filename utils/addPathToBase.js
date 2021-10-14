const {logger} = require("./logger")

/**
 * @param req
 * @param {string} basePathWithoutRootDirectory
 * @return {Promise<string>} basePathWithoutRootDirectory or '' if this directory is exists
 */
const addPathToBase = async (req, basePathWithoutRootDirectory) => {
    const configCollection = req.app.locals.configCollection;
    try {
        const response = await configCollection.findOne({name: "paths"})
        
        if (!response) {
            await configCollection.insertOne({name: "paths", pathsArr: [basePathWithoutRootDirectory]})
            logger.info('Add path to config:', {message: basePathWithoutRootDirectory, module: 'addPathToBase'})
            return basePathWithoutRootDirectory
        }
        
        const pathsSet = new Set(response.pathsArr)
        if (pathsSet.has(basePathWithoutRootDirectory)) return ''
        
        pathsSet.add(basePathWithoutRootDirectory)
        pathsSet.delete('')
        const newPathsArr = Array.from(pathsSet).sort()
        
        await configCollection.updateOne({name: "paths"}, {$set: {pathsArr: newPathsArr}})
        logger.info('Add path to config:', {message: basePathWithoutRootDirectory, module: 'addPathToBase'})
        return basePathWithoutRootDirectory
    } catch (error) {
        logger.error('addPathToBase ERROR: insert path -', {
            message: basePathWithoutRootDirectory,
            data: error,
            module: 'addPathToBase'
        })
        throw new Error(`addPathToBase ERROR: insert path - ${basePathWithoutRootDirectory}, ${error}`)
    }
}

module.exports = {addPathToBase}
