const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { PassThrough } = require('stream');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const compressionEnabled = process.env.ENABLE_VIDEO_COMPRESSION !== 'false';

// Auto-create uploads folder so the server doesn't crash on start
if (!fs.existsSync('uploads/')) {
    fs.mkdirSync('uploads/');
}

const storage = multer.diskStorage({ 
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
}); 

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'), false);
        }
    }
});

const compressVideo = (req, res, next) => {
    if (!req.file || !compressionEnabled) return next();

    const outputStream = new PassThrough();
    const chunks = [];
    let completed = false;

    const finishOnce = (handler) => {
        if (completed) return;
        completed = true;
        // Delete original file from disk to free up space
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        handler();
    };

    const command = ffmpeg(req.file.path)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('1280x720')
        .outputOptions([
            '-crf 28',
            '-preset ultrafast', 
            '-threads 0',   
            '-movflags frag_keyframe+empty_moov' 
        ])
        .format('mp4');

    outputStream.on('data', chunk => chunks.push(chunk));

    outputStream.on('end', () => {
        finishOnce(() => {
            req.file.buffer = Buffer.concat(chunks);
            req.file.size = req.file.buffer.length;
            req.file.mimetype = 'video/mp4';
            next();
        });
    });

    // Error handling must be INSIDE the function to access 'command' and 'next'
    outputStream.on('error', err => {
        console.error('Stream failed:', err.message);
        finishOnce(() => next());
    });

    command.on('error', (err) => {
        console.error('FFmpeg failed:', err.message);
        finishOnce(() => next());
    });

    command.pipe(outputStream, { end: true });
};

module.exports = { upload, compressVideo };
