
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { Readable, PassThrough } = require('stream');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const compressionEnabled = process.env.ENABLE_VIDEO_COMPRESSION !== 'false';

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'video/mp4',         //.mp4
            'video/quicktime',  // .mov
            'video/x-msvideo',  // .avi
            'video/x-matroska'  // .mkv
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'), false);
        }
    }
});

// Compression middleware — use this after upload
const compressVideo = (req, res, next) => {
    if (!req.file) return next();
    if (!compressionEnabled) return next();

    const inputStream = Readable.from(req.file.buffer);
    const outputStream = new PassThrough();
    const chunks = [];
    let completed = false;

    const finishOnce = (handler) => {
        if (completed) return;
        completed = true;
        handler();
    };

    const command = ffmpeg(inputStream)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('1280x720')
        .outputOptions([
            '-crf 23',
            '-preset medium',    // better compression while keeping quality
            '-movflags frag_keyframe+empty_moov' // allows streaming output
        ])
        .format('mp4')         // always output as mp4 regardless of input format
        .pipe(outputStream);

    outputStream.on('data', chunk => chunks.push(chunk));

    outputStream.on('end', () => {
        finishOnce(() => {
            req.file.buffer = Buffer.concat(chunks);
            req.file.size = req.file.buffer.length;
            req.file.mimetype = 'video/mp4';
            next();
        });
    });

    outputStream.on('error', err => {
        console.error('Compressed video stream failed, uploading original file instead:', err.message);
        finishOnce(() => next());
    });

    command.on('error', (err) => {
        console.error('Video compression failed, uploading original file instead:', err.message);
        finishOnce(() => next());
    });
};

module.exports = { upload, compressVideo };
