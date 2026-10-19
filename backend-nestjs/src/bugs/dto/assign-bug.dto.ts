import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class AssignBugDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  @Matches(/\S/, { message: 'Assignee name cannot be blank' })
  assigneeName: string;
}
