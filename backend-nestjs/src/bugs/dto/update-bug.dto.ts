import { Transform } from 'class-transformer';
import { IsString, Length, Matches, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateBugDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(3, 180)
  @Matches(/\S/, { message: 'Title cannot be blank' })
  title?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(8, 10000)
  @Matches(/\S/, { message: 'Description cannot be blank' })
  description?: string;
}
