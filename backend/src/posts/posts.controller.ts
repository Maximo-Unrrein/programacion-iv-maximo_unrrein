import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { imageUploadOptions } from '../common/uploads';
import { CommentsQueryDto, CreatePostDto, FeedQueryDto, ShareDto, TrendsQueryDto } from './posts.dto';
import { MAX_POST_IMAGES } from './post.schema';
import { PostsService } from './posts.service';
import { TrendsService } from './trends.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly trends: TrendsService,
  ) {}

  // ---------- posts ----------

  @Get('posts')
  feed(@CurrentUser() user: JwtPayload, @Query() query: FeedQueryDto) {
    return this.posts.feed(user.sub, query);
  }

  // ---------- guardados y compartidos (antes de posts/:id para que no se tomen como id) ----------

  /** Publicaciones que guardó el usuario del token. */
  @Get('posts/saved')
  saved(@CurrentUser() user: JwtPayload, @Query() query: CommentsQueryDto) {
    return this.posts.saved(user.sub, query.offset, query.limit);
  }

  /** Publicaciones que le compartieron al usuario del token, junto con quién se las compartió. */
  @Get('posts/shared')
  shared(@CurrentUser() user: JwtPayload, @Query() query: CommentsQueryDto) {
    return this.posts.sharedWith(user.sub, query.offset, query.limit);
  }

  /** Guarda la publicación en los guardados del usuario (token). */
  @Post('posts/:id/save')
  @HttpCode(200)
  save(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.posts.save(id, user.sub);
  }

  /** Quita la publicación de los guardados del usuario (token). */
  @Post('posts/:id/unsave')
  @HttpCode(200)
  unsave(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.posts.unsave(id, user.sub);
  }

  /** El usuario del token le comparte la publicación al usuario `to` del body. Responde 201. */
  @Post('posts/:id/share')
  share(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: ShareDto) {
    return this.posts.share(id, user.sub, dto.to);
  }

  @Get('posts/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.posts.findOne(id, user.sub);
  }

  /**
   * multipart/form-data: `title` + `content` (obligatorios) + `images` (opcional, hasta 4, máx. 8 MB c/u).
   * También acepta un único `image`, como antes del carrusel.
   */
  @Post('posts')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        // Se aceptan algunos de más para responder con un mensaje claro (lo valida el servicio)
        { name: 'images', maxCount: MAX_POST_IMAGES + 4 },
        { name: 'image', maxCount: 1 },
      ],
      imageUploadOptions(8, MAX_POST_IMAGES + 5),
    ),
  )
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files: { images?: Express.Multer.File[]; image?: Express.Multer.File[] } = {},
  ) {
    return this.posts.create(user.sub, dto, [...(files.image ?? []), ...(files.images ?? [])]);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.posts.remove(id, user);
  }

  // ---------- me gusta ----------

  /** Un usuario puede dar un solo me gusta por publicación (repetirlo no suma). */
  @Post('posts/:id/like')
  like(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.posts.like(id, user.sub);
  }

  @Delete('posts/:id/like')
  unlike(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.posts.unlike(id, user.sub);
  }

  // ---------- tendencias ----------

  @Get('trends/posts')
  trendingPosts(@CurrentUser() user: JwtPayload, @Query() query: TrendsQueryDto) {
    return this.trends.posts$(user.sub, query);
  }

  @Get('trends/tags')
  trendingTags(@Query() query: TrendsQueryDto) {
    return this.trends.tags(query.window);
  }
}
