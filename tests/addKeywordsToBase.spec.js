const {getKeywordsFromUpdateFields} = require("../utils/addKeywordsToBase")
const {updateFiledata, updatedFileDateForReturningValues} = require("./Data")
const {deepCopy} = require("../utils/common")

describe('getKeywordsFromUpdateFields: ', () => {
	let updateFields
	
	beforeAll(() => {
		updateFields = deepCopy([...updateFiledata, ...updatedFileDateForReturningValues])
			.map(item => item.updatedFields)
	})
	
	test('get new Keywords array', () => {
		expect(getKeywordsFromUpdateFields(updateFields)).toEqual(["green", "map", "forest", "estonia", "bike", "Olga"])
	})
})
