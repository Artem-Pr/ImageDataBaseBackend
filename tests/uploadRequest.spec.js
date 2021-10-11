const {MongoClient} = require('mongodb')

describe('insert', () => {
    let testCollections
    let connection
    let db
    
    beforeAll(async () => {
        connection = await MongoClient.connect("mongodb://localhost:27017/", {
            useUnifiedTopology: true,
            useNewUrlParser: true
        })
        db = await connection.db('IDB')
        testCollections = db.collection('test')
    })
    
    afterAll(async () => {
        await connection.close()
        await db.close()
    })
    
    it('should insert a doc into collection', async () => {
        const mockUser = {_id: 'some-user-id', name: 'John'}
        await testCollections.insertOne(mockUser)
        
        const insertedUser = await testCollections.findOne({_id: 'some-user-id'})
        expect(insertedUser).toEqual(mockUser)
    })
    
    it('should delete a doc from collection', async () => {
        const mockUser = {_id: 'some-user-id'}
        await testCollections.deleteOne(mockUser)
        
        const insertedUser = await testCollections.findOne({_id: 'some-user-id'})
        expect(insertedUser).toBeNull()
    })
})
