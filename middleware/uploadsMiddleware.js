import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { Readable, PassThrough } from "stream";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const storage = multer.memoryStorage();

export const upload = multer({
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
export const compressVideo = (req, res, next) => {
    if (!req.file) return next();

    const inputStream = Readable.from(req.file.buffer);
    const outputStream = new PassThrough();
    const chunks = [];

    ffmpeg(inputStream)
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
        req.file.buffer = Buffer.concat(chunks);
        req.file.size = req.file.buffer.length;
        next();
    });

    outputStream.on('error', err => {
        res.status(500).json({ error: 'Video compression failed: ' + err.message });
    });
};