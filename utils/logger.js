const {createLogger, format, transports} = require('winston')

const {combine, timestamp} = format

const loggerFormat = combine(
    timestamp(),
    format.json(),
)
const simpleLoggerFormat = combine(
    format.colorize(),
    format.simple(),
)
const config = {
    maxsize: 10000000,
    maxFiles: 5,
    format: loggerFormat,
}
const logger = createLogger({
    transports: [
        new transports.File({...config, filename: 'logger/error.log', level: 'error'}),
        new transports.File({...config, filename: 'logger/requests.log', level: 'verbose'}),
        new transports.File({...config, filename: 'logger/combined.log'}),
    ],
    exceptionHandlers: [
        new transports.File({...config, filename: 'logger/exceptions.log'})
    ],
    rejectionHandlers: [
        new transports.File({...config, filename: 'logger/rejections.log'})
    ]
});

if (process.env.NODE_ENV !== 'production') {
    const console = new transports.Console({format: simpleLoggerFormat})
    // const http = new transports.Http({format: simpleLoggerFormat, host: 'localhost', port: 8080})
    
    logger
        .add(console)
    // .add(http)
}

module.exports = {logger}
