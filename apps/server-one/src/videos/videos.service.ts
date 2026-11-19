import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { randomUUID } from 'crypto';

export interface Video {
  id: string;
  title: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

@Injectable()
export class VideosService {
  private readonly dataPath = join(process.cwd(), 'data', 'videos.json');
  private readonly uploadPath = join(process.cwd(), 'uploads');

  // Read existing videos
  private async readVideos(): Promise<Video[]> {
    await fs.mkdir(dirname(this.dataPath), {
      recursive: true,
    });

    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');

      return JSON.parse(data) as Video[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.writeFile(this.dataPath, '[]');

        return [];
      }

      throw error;
    }
  }

  // Upload video metadata
  async create(file: Express.Multer.File, title: string) {
    const videos = await this.readVideos();

    const newVideo: Video = {
      id: randomUUID(),
      title: title,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      createdAt: new Date().toISOString(),
    };

    videos.push(newVideo);

    await fs.writeFile(this.dataPath, JSON.stringify(videos, null, 2));

    return {
      message: 'Video uploaded successfully',
      video: newVideo,
    };
  }

  // Get all videos
  async findAll() {
    return this.readVideos();
  }

  async findById(id: string) {
    const videos = await this.readVideos();
    if (!videos) {
      throw new NotFoundException(`No Videos found in the storage`);
    }

    const video = videos?.find((video) => video.id === id);
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    return video;
  }

  async getVideoFile(id: string) {
    const video = await this.findById(id);

    const filePath = join(this.uploadPath, basename(video.filename));

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('Video file not found');
    }

    return {
      video,
      filePath,
    };
  }

  async deleteById(id: string) {
    const videos = await this.readVideos();
    const videoIndex = videos.findIndex((video) => video.id === id);

    if (videoIndex === -1) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    const [video] = videos.splice(videoIndex, 1);
    await fs.writeFile(this.dataPath, JSON.stringify(videos, null, 2));

    // Remove the stored file if it still exists; missing files should not
    // prevent metadata deletion.
    await fs.unlink(join(this.uploadPath, basename(video.filename))).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });

    return { message: 'Video deleted successfully', video };
  }
}
