const ObjectId = require('mongodb').ObjectID

const originalFiledata = [{
	_id: ObjectId("5fef484b497f3af84699e88c"),
	originalName: 'image001-map.jpg',
	mimetype: 'image/jpeg',
	size: 2000000,
	megapixels: 8,
	imageSize: '3000x3000',
	keywords: ['map', 'forest', 'estonia'],
	changeDate: '2011.11.11',
	originalDate: '2010.10.10',
	filePath: 'tests/test-images/image001-map.jpg',
	preview: '',
}, {
	_id: ObjectId("5fef4856497f3af84699e77e"),
	originalName: 'image002-map.jpg',
	mimetype: 'image/jpeg',
	size: 1000000,
	megapixels: 10,
	imageSize: '2000x2000',
	keywords: ['bike', 'Olga', 'estonia'],
	changeDate: '2011.12.12',
	originalDate: '2010.01.01',
	filePath: 'tests/test-images/image002-map.jpg',
	preview: '',
}]

const updateFiledata = [
	{
		id: '5fef484b497f3af84699e88c',
		updatedFields: {
			originalName: '123.jpg',
			originalDate: '2019.06.24',
			keywords: []
		}
	},
	{
		id: '5fef4856497f3af84699e77e',
		updatedFields: {
			originalName: 'bom-bom.jpg',
			originalDate: '2019.06.20',
			keywords: ['green']
		}
	}
]

const updatedFileDateForReturningValues = [
	{
		id: '5fef484b497f3af84699e88c',
		updatedFields: {
			originalName: 'image001-map.jpg',
			originalDate: '2010.10.10',
			keywords: ['map', 'forest', 'estonia']
		}
	},
	{
		id: '5fef4856497f3af84699e77e',
		updatedFields: {
			originalName: 'image002-map.jpg',
			originalDate: '2010.01.01',
			keywords: ['bike', 'Olga', 'estonia']
		}
	}
]

const pushExifFiledata = [
	{
		originalDate: '2019.06.24',
		changeDate: '2019.06.24',
		name: 'IMG_20190624_102400.jpg',
		tempPath: 'tests/tempPhotos/d922425fe7b767cd947799521332ed52',
		type: 'image/jpeg',
		size: 1932980,
		megapixels: '',
		keywords: null,
		preview: 'http://localhost:5000/images/d922425fe7b767cd947799521332ed52-preview.jpg'
	},
	{
		originalDate: '2019.06.24',
		changeDate: '2019.06.24',
		name: 'IMG_20190624_110224.jpg',
		tempPath: 'tests/tempPhotos/663b0881e406189cf53437abd7e687b6',
		type: 'image/jpeg',
		size: 1434050,
		megapixels: '',
		keywords: null,
		preview: 'http://localhost:5000/images/663b0881e406189cf53437abd7e687b6-preview.jpg'
	}
]

const pushExifFiledataVideo = [
	{
		originalDate: '2019.06.24',
		changeDate: '2019.06.24',
		name: 'IMG_20190624_102400.jpg',
		tempPath: 'tests/tempVideos/YDXJ1442.mp4',
		type: 'image/jpeg',
		size: 1932980,
		megapixels: '',
		keywords: null,
		// preview: 'http://localhost:5000/images/d922425fe7b767cd947799521332ed52-preview.jpg'
	}
]

module.exports = {
	originalFiledata,
	updateFiledata,
	pushExifFiledata,
	pushExifFiledataVideo,
	updatedFileDateForReturningValues
}
