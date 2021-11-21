const {logger} = require("./logger")
const {throwError} = require("./common")

class DBRequests {
    static directoriesList = {name: "paths"}
    static allFiles = {}
    
    /**
     * @param {string} fieldName
     * @param {string} subString - searching string
     * @return {{$and: [{$expr: {$eq: [{$indexOfCP: (string|*)[]}, number]}}]}}
     */
    static byFieldUsingStartsWith(fieldName, subString) {
        return {$and: [{$expr: {$eq: [{$indexOfCP: [`$${fieldName}`, subString]}, 0]}}]}
    }
    
    /**
     * @param directoriesList
     * @return {{$set: {pathsArr}}}
     */
    static updateDirectoriesList(directoriesList) {
        return {$set: {pathsArr: directoriesList}}
    }
}

class DBController {
    /**
     * Save basic parameters and revert existing methods
     *
     * @param {object} req - request object. Minimal: {
     *   app: {locals: {collection: null}},
     *   body: null
     * }
     * @param {object} DBRequest - data base request object
     * @param {object} DBUpdate? - request for updating data base object
     * @return {object}
     */
    constructor(req, DBRequest, DBUpdate) {
        this._DBRequest = DBRequest
        this._DBUpdate = DBUpdate
        this.collection = req.app.locals.collection
        this.configCollection = req.app.locals.configCollection
        this.successLog('controller initialized')
        this._collectionType = undefined
    }
    
    /**
     *
     * @param updateRequest - request for updating data base object
     * @constructor
     */
    set DBUpdate(updateRequest) {
        this._DBUpdate = updateRequest
    }
    
    /**
     *
     * @param findRequest - data base request object
     * @constructor
     */
    set DBRequest(findRequest) {
        this._DBRequest = findRequest
    }
    
    /**
     *
     * @param {'collection' | 'configCollection' | undefined} type
     */
    set collectionType(type) {
        this._collectionType = type
    }
    
    /**
     * find DB objects
     *
     * @param {'collection' | 'configCollection' | undefined} collectionType
     * @return {Promise<object>} DB raw object
     */
    findObjects(collectionType) {
        try {
            return this[collectionType || this._collectionType].find(this._DBRequest)
        } catch (error) {
            logger.error('DBController - findObjects: ', {data: error})
            throwError('DBController - findObjects: ', true)
        }
    }
    
    /**
     * Remove DB objects
     *
     * @param {'collection' | 'configCollection' | undefined} collectionType
     * @return {Promise<object>} DB raw object
     */
    removeObjects(collectionType) {
        try {
            return this[collectionType || this._collectionType].deleteMany(this._DBRequest)
        } catch (error) {
            logger.error('DBController - removeObjects: ', {data: error})
            throwError('DBController - removeObjects: ', true)
        }
    }
    
    /**
     * Get DB object using "findOne"
     *
     * @param {'collection' | 'configCollection' | undefined} collectionType
     * @return {Promise<object>} DB object
     */
    findOne(collectionType) {
        try {
            return this[collectionType || this._collectionType].findOne(this._DBRequest)
        } catch (error) {
            logger.error('DBController - findOne: ', {data: error.message})
            throwError('DBController - findOne: ' + error.message, true)
        }
    }
    
    /**
     * Get DB objects array using "find"
     *
     * @param {'collection' | 'configCollection' | undefined} collectionType
     * @return {Promise<object[]>} DB object
     */
    find(collectionType) {
        try {
            return this[collectionType || this._collectionType].find(this._DBRequest).toArray()
        } catch (error) {
            logger.error('DBController - find: ', {data: error.message})
            throwError('DBController - find: ' + error.message, true)
        }
    }
    
    /**
     * Update DB object using "updateOne"
     *
     * @param {'collection' | 'configCollection' | undefined} collectionType
     * @return {Promise<any>}
     */
    updateOne(collectionType) {
        try {
            return this[collectionType || this._collectionType].updateOne(this._DBRequest, this._DBUpdate)
        } catch (error) {
            logger.error('DBController - findOne: ', {data: error})
            throwError('DBController - findOne: ', true)
        }
    }
    
    /**
     * Insert DB object
     * Merge DBRequest and insertObject
     *
     * @param {object} insertObject
     * @param {'collection' | 'configCollection' | undefined} collectionType
     * @return {Promise<any>}
     */
    insertOne(insertObject, collectionType) {
        try {
            console.log('{ ...this._DBRequest, ...insertObject}', { ...this._DBRequest, ...insertObject})
            return this[collectionType || this._collectionType].insertOne({ ...this._DBRequest, ...insertObject})
        } catch (error) {
            logger.error('DBController - insertOne: ', {data: error})
            throwError('DBController - insertOne: ', true)
        }
    }
    
    successLog(message, data) {
        logger.info(message, {
            message: ': SUCCESS',
            ...(data && {data}),
            module: 'DBController'
        })
    }
}

module.exports = {DBController, DBRequests}
