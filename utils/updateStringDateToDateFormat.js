const moment = require('moment')
const {DBController, DBRequests} = require('./DBController')
const {logger} = require('./logger')

const updateStringDateToDateFormat = async (req) => {
    const collectionController = new DBController(req, DBRequests.allFiles)
    collectionController.collectionType = 'collection'
    const originalDBCollection = await collectionController.find()
    
    console.log('originalDBCollection', originalDBCollection)
    const updatedCollection = originalDBCollection.map(({_id, originalDate}) => {
        const dateInDateFormat = moment.utc(originalDate, 'YYYY.MM.DD').toDate()
        collectionController.DBUpdate = DBRequests.updateDate(dateInDateFormat)
        collectionController.DBRequest = DBRequests.byId(_id)
        return collectionController
            .updateOne()
            .then(response => {
                return (response.modifiedCount === 1)
            })
    })
    
    const collectionResponse = await Promise.all(updatedCollection)
    if (collectionResponse.every(item => item === true)) {
        logger.debug('Collection update - SUCCESS', {module: 'updateStringDateToDateFormat'})
    } else {
        logger.error('Collection update - ERROR', {module: 'updateStringDateToDateFormat', data: collectionResponse})
    }
}

module.exports = {updateStringDateToDateFormat}
