import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Get,
  Param,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { VideosService } from './videos.service.js';
import { Req, Res, NotFoundException } from '@nestjs/common';

import { createReadStream } from 'fs';

import { stat } from 'fs/promises';
import type { Request, Response } from 'express';

// Local storage directory
const uploadPath = join(process.cwd(), 'uploads');

// Create directory if it doesn't exist
mkdirSync(uploadPath, { recursive: true });

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  findAll() {
    return this.videosService.findAll();
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: uploadPath,

        filename: (req, file, callback) => {
          const uniqueName =
            randomUUID() + extname(file.originalname).toLowerCase();

          callback(null, uniqueName);
        },
      }),

      limits: {
        fileSize: 500 * 1024 * 1024,
      },

      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('video/')) {
          return callback(
            new BadRequestException('Only video files are allowed'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
  ) {
    if (!file) {
      throw new BadRequestException('Video file is required');
    }

    if (!title?.trim()) {
      throw new BadRequestException('Video title is required');
    }

    return this.videosService.create(file, title);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.videosService.findById(id);
  }

  @Delete(':id')
  deleteById(@Param('id') id: string) {
    return this.videosService.deleteById(id);
  }

  @Get('stream/:id')
  async streamVideo(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 1. Get video information and file path
    const { video, filePath } = await this.videosService.getVideoFile(id);

    // 2. Get file size
    const fileStats = await stat(filePath);
    const fileSize = fileStats.size;

    // 3. Get Range header from browser
    const range = req.headers.range;

    // Set common headers
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', video.mimeType);
    res.setHeader('Content-Disposition', 'inline');

    // 4. If browser does not request a specific range
    if (!range) {
      res.status(200);
      res.setHeader('Content-Length', fileSize);

      createReadStream(filePath).pipe(res);
      return;
    }

    // 5. Parse the requested byte range
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);

    if (!match || (!match[1] && !match[2])) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.status(416).end();
      return;
    }

    let start: number;
    let end: number;

    if (!match[1]) {
      // Suffix range, for example bytes=-500
      const suffixLength = Number(match[2]);

      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        res.status(416).end();
        return;
      }

      start = Math.max(fileSize - suffixLength, 0);
      end = fileSize - 1;
    } else {
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : fileSize - 1;
    }

    // 6. Validate requested range
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= fileSize ||
      end < start
    ) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.status(416).end();
      return;
    }

    end = Math.min(end, fileSize - 1);

    // 7. Calculate chunk size
    const chunkSize = end - start + 1;

    // 8. Send partial content response
    res.status(206);

    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);

    res.setHeader('Content-Length', chunkSize);

    // 9. Read only requested bytes
    const videoStream = createReadStream(filePath, {
      start,
      end,
    });

    videoStream.on('error', (error) => {
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(error);
      }
    });

    // 10. Send stream to browser
    videoStream.pipe(res);
  }
}
