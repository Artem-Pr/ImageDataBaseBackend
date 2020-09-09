import url from "url";
import fs from "fs-extra";
import createError from "http-errors";
import {getConfig} from "../utils/common";
import sharp from "sharp";

export const getFilesFromDB = async (req, res, tempFolder, configPath) => {
	const queryObject = url.parse(req.url, true).query
	let searchTags = queryObject['searchTags[]']
	let excludeTags = queryObject['excludeTags[]']
	if (searchTags && !Array.isArray(searchTags)) searchTags = [searchTags]
	if (excludeTags && !Array.isArray(excludeTags)) excludeTags = [excludeTags]
	console.log('searchTags', searchTags)
	console.log('excludeTags', excludeTags)
	
	// очищаем temp
	fs.emptyDirSync(tempFolder);
	
	const findObject = {
		$and:
			[
				{"keywords": { $in : searchTags || [] }},
				{"keywords": { $nin : excludeTags || [] }}
			]
	}
	
	const collection = req.app.locals.collection;
	
	collection.find(findObject).toArray(async function(err, photos){
		if (err) {
			console.log("collection load error", err)
			throw createError(400, `collection load error`)
		}
		
		const libPath = JSON.parse(getConfig(configPath)).libPath
		const filesWithTempPathPromise = photos.map(async item => {
			const fullPath = libPath + item.filePath
			const randomName = Math.floor(Math.random() * 1000000).toString().padStart(6, "0") + '-preview.jpg'
			await sharp(fullPath)
				.withMetadata()
				.clone()
				.resize(200)
				.jpeg({ quality: 80 })
				// .toBuffer({ resolveWithObject: true })
				.toFile('temp/' + randomName)
				.then(() => {
					item.preview = {
						preview: 'http://localhost:5000/images/' + randomName,
						tempPath: 'temp/' + randomName,
					}
				})
				.catch( err => console.log('err', err));
			return item
		})
		const filesWithTempPath = await Promise.all(filesWithTempPathPromise)
		res.send(filesWithTempPath)
	});
}