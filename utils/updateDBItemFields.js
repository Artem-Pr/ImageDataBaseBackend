const {DBController, DBRequests} = require('./DBController');
const {logger} = require('./logger');

/**
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {number} id - id of DB element
 * @param {object} fieldObject={preview: "/image-heic/fullSize/2023.01.16-originalDate/IMG_6649-fullSize.jpg"}
 *
 * @returns {Promise<void>}
 */
const updateDBItemFields = async (req, id, fieldObject) => {
    const collectionController = new DBController(
        req,
        DBRequests.byId(id),
        DBRequests.updateField(fieldObject)
    )
    collectionController.collectionType = 'collection'
    await collectionController.updateOne().then(response => {
        logger.info('collectionController.updateOne - SUCCESS:', {
            message: response.modifiedCount === 1,
            data: fieldObject
        })
    })
}

module.exports = {updateDBItemFields}
