import { ValidationPipe } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateQuestionDto } from './create-question.dto';
import { UpdateQuestionDto } from './update-question.dto';

describe('Question DTOs Constraints Validation & Transformation', () => {
  const baseValidDto = {
    question: 'Sample DSA Problem',
    topic: 'Arrays',
    difficulty: 'medium' as const,
    marks: 5,
    questionType: 'DSA',
  };

  describe('CreateQuestionDto', () => {
    it('should successfully validate when constraints is a valid array of strings', async () => {
      const input = {
        ...baseValidDto,
        constraints: [
          '1 ≤ n ≤ 10^5',
          '-10^9 ≤ nums[i] ≤ 10^9',
          '1 ≤ s.length ≤ 10^4',
        ],
      };

      const dto = plainToInstance(CreateQuestionDto, input);
      const errors = await validate(dto);

      expect(errors.filter((e) => e.property === 'constraints')).toHaveLength(0);
      expect(dto.constraints).toEqual([
        '1 ≤ n ≤ 10^5',
        '-10^9 ≤ nums[i] ≤ 10^9',
        '1 ≤ s.length ≤ 10^4',
      ]);
    });

    it('should transform newline-separated string into an array of strings', async () => {
      const input = {
        ...baseValidDto,
        constraints: '1 ≤ n ≤ 10^5\n-10^9 ≤ nums[i] ≤ 10^9\n1 ≤ s.length ≤ 10^4',
      };

      const dto = plainToInstance(CreateQuestionDto, input);
      const errors = await validate(dto);

      expect(errors.filter((e) => e.property === 'constraints')).toHaveLength(0);
      expect(Array.isArray(dto.constraints)).toBe(true);
      expect(dto.constraints).toEqual([
        '1 ≤ n ≤ 10^5',
        '-10^9 ≤ nums[i] ≤ 10^9',
        '1 ≤ s.length ≤ 10^4',
      ]);
    });

    it('should trim whitespace and filter out empty lines from multiline string input', async () => {
      const input = {
        ...baseValidDto,
        constraints: '   1 ≤ n ≤ 10^5   \n\n   \n   -10^9 ≤ nums[i] ≤ 10^9   \n   \n',
      };

      const dto = plainToInstance(CreateQuestionDto, input);
      const errors = await validate(dto);

      expect(errors.filter((e) => e.property === 'constraints')).toHaveLength(0);
      expect(dto.constraints).toEqual([
        '1 ≤ n ≤ 10^5',
        '-10^9 ≤ nums[i] ≤ 10^9',
      ]);
    });

    it('should handle empty string and whitespace-only string by transforming to empty array', async () => {
      const inputEmpty = {
        ...baseValidDto,
        constraints: '',
      };
      const dtoEmpty = plainToInstance(CreateQuestionDto, inputEmpty);
      const errorsEmpty = await validate(dtoEmpty);

      expect(errorsEmpty.filter((e) => e.property === 'constraints')).toHaveLength(0);
      expect(dtoEmpty.constraints).toEqual([]);

      const inputWhitespace = {
        ...baseValidDto,
        constraints: '   \n  \n\t  ',
      };
      const dtoWhitespace = plainToInstance(CreateQuestionDto, inputWhitespace);
      const errorsWhitespace = await validate(dtoWhitespace);

      expect(errorsWhitespace.filter((e) => e.property === 'constraints')).toHaveLength(0);
      expect(dtoWhitespace.constraints).toEqual([]);
    });

    it('should pass validation when constraints is empty array or undefined (optional)', async () => {
      const inputEmptyArray = {
        ...baseValidDto,
        constraints: [],
      };
      const dtoEmptyArray = plainToInstance(CreateQuestionDto, inputEmptyArray);
      const errorsEmptyArray = await validate(dtoEmptyArray);

      expect(errorsEmptyArray.filter((e) => e.property === 'constraints')).toHaveLength(0);
      expect(dtoEmptyArray.constraints).toEqual([]);

      const inputMissing = {
        ...baseValidDto,
      };
      const dtoMissing = plainToInstance(CreateQuestionDto, inputMissing);
      const errorsMissing = await validate(dtoMissing);

      expect(errorsMissing.filter((e) => e.property === 'constraints')).toHaveLength(0);
      expect(dtoMissing.constraints).toBeUndefined();
    });

    it('should fail validation when constraints is an invalid data type (number or object)', async () => {
      const inputNumber = {
        ...baseValidDto,
        constraints: 12345,
      };
      const dtoNumber = plainToInstance(CreateQuestionDto, inputNumber);
      const errorsNumber = await validate(dtoNumber);

      const constraintError = errorsNumber.find((e) => e.property === 'constraints');
      expect(constraintError).toBeDefined();
      expect(constraintError?.constraints?.isArray).toBeDefined();

      const inputObject = {
        ...baseValidDto,
        constraints: { min: 1, max: 100 },
      };
      const dtoObject = plainToInstance(CreateQuestionDto, inputObject);
      const errorsObject = await validate(dtoObject);

      const constraintErrorObj = errorsObject.find((e) => e.property === 'constraints');
      expect(constraintErrorObj).toBeDefined();
      expect(constraintErrorObj?.constraints?.isArray).toBeDefined();
    });

    it('should fail validation when constraints array contains non-string items', async () => {
      const inputNonStringArray = {
        ...baseValidDto,
        constraints: ['valid constraint', 1234, true],
      };
      const dtoNonString = plainToInstance(CreateQuestionDto, inputNonStringArray);
      const errorsNonString = await validate(dtoNonString);

      const constraintError = errorsNonString.find((e) => e.property === 'constraints');
      expect(constraintError).toBeDefined();
      expect(constraintError?.constraints?.isString).toBeDefined();
    });
  });

  describe('UpdateQuestionDto', () => {
    it('should validate and transform constraints on UpdateQuestionDto as well', async () => {
      const input = {
        constraints: '1 ≤ n ≤ 10^5\n-10^9 ≤ nums[i] ≤ 10^9',
      };

      const dto = plainToInstance(UpdateQuestionDto, input);
      const errors = await validate(dto);

      expect(errors.filter((e) => e.property === 'constraints')).toHaveLength(0);
      expect(dto.constraints).toEqual([
        '1 ≤ n ≤ 10^5',
        '-10^9 ≤ nums[i] ≤ 10^9',
      ]);
    });
  });
  it.each([CreateQuestionDto, UpdateQuestionDto])('keeps topic categories and type as separate whitelisted fields in %p', async (Dto) => {
    const input = { ...baseValidDto, categories: ['Arrays', 'Trees'], questionType: 'CODE_OUTPUT' };
    const dto = plainToInstance<CreateQuestionDto | UpdateQuestionDto, typeof input>(Dto, input);
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto.categories).toEqual(['Arrays', 'Trees']);
    expect(dto.questionType).toBe('CODE_OUTPUT');
  });

  it('rejects non-string topic categories', async () => {
    const dto = plainToInstance(CreateQuestionDto, { ...baseValidDto, categories: ['Arrays', 123] });
    const errors = await validate(dto, { whitelist: true });
    expect(errors.some(error => error.property === 'categories')).toBe(true);
  });

});

// The global pipe runs with `whitelist: true`. Nested shapes declared as inline
// object types lose every property, so test cases were persisted as empty
// records. These tests pin the @ValidateNested wiring that prevents that.
describe.each([CreateQuestionDto, UpdateQuestionDto])('%p nested payloads survive the whitelist pipe', (Dto) => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const base = { topic: 'Arrays', difficulty: 'medium', marks: 5, questionType: 'DSA' };
  const transform = (body: Record<string, unknown>) =>
    pipe.transform({ ...base, ...body }, { type: 'body', metatype: Dto });

  it('keeps test case fields', async () => {
    const dto = await transform({
      question: 'Sum two numbers',
      questionType: 'DSA',
      testCases: [
        { input: '2 3\n', expectedOutput: '5', isHidden: false, explanation: '2 + 3 = 5' },
        { input: '9 1\n', expectedOutput: '10', isHidden: true },
      ],
    });
    expect(JSON.parse(JSON.stringify(dto.testCases))).toEqual([
      { input: '2 3\n', expectedOutput: '5', isHidden: false, explanation: '2 + 3 = 5' },
      { input: '9 1\n', expectedOutput: '10', isHidden: true },
    ]);
  });

  it('keeps per-language starter code and examples', async () => {
    const dto = await transform({
      question: 'Echo',
      questionType: 'DSA',
      starterCode: [
        { language: 'python', code: 'print(1)' },
        { language: 'javascript', code: 'console.log(1)' },
      ],
      examples: [{ input: '1', output: '1', explanation: 'identity' }],
    });
    expect(dto.starterCode).toEqual([
      { language: 'python', code: 'print(1)' },
      { language: 'javascript', code: 'console.log(1)' },
    ]);
    expect(dto.examples).toEqual([{ input: '1', output: '1', explanation: 'identity' }]);
  });

  it('keeps reference solutions', async () => {
    const dto = await transform({
      question: 'Echo',
      questionType: 'DSA',
      referenceSolutions: [{ language: 'python', sourceCode: 'print(input())' }],
    });
    expect(dto.referenceSolutions).toEqual([
      { language: 'python', sourceCode: 'print(input())' },
    ]);
  });

  it('allows clearing nested collections explicitly', async () => {
    const dto = await transform({ testCases: [], examples: [], starterCode: [], referenceSolutions: [] });
    expect(JSON.parse(JSON.stringify(dto))).toMatchObject({
      testCases: [], examples: [], starterCode: [], referenceSolutions: [],
    });
  });

  it('rejects corrupted nested arrays instead of persisting missing fields', async () => {
    await expect(transform({ testCases: [[], []] })).rejects.toThrow();
  });
});
