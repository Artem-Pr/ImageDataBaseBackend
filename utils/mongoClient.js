import {MongoClient} from "mongodb";
import createError from "http-errors";

export const mongoClient = new MongoClient("mongodb://localhost:27017/", {
	useUnifiedTopology: true,
	useNewUrlParser: true
})

export const pushDataToDB = async (res, mongoClient, filedata) => {
	await mongoClient.connect((err, client) => {
		if (err) {
			console.log("Connection error: ", err)
			throw createError(400, `oops..`)
		}
		console.log("Connected")
		
		const db = client.db("IDB")
		const collection = db.collection("photos")
		collection.insertMany(filedata, function (err, result) {
			if (err) {
				console.log("collection insert error", err)
				throw createError(400, `oops..`)
			}
			console.log(result)
			res.send("Файл загружен")
			client.close()
			console.log("Connect close")
		})
	})
}