import fs from "fs-extra";
import {getConfig} from "../utils/common";

export const keywordsRequest = (response, tempFolder, configPath) => {
	console.log('tempFolder', tempFolder)
	console.log('configPath', configPath)
	// очищаем temp
	fs.emptyDirSync(tempFolder);
	// получаем конфиг
	const config = getConfig(configPath)
	response.send(config)
}