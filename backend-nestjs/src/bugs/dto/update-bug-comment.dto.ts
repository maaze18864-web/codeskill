import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class UpdateBugCommentDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 3000)
  @Matches(/\S/, { message: 'Comment cannot be blank' })
  text: string;
}
