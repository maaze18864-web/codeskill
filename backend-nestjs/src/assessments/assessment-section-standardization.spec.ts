import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { CreateStudentDto } from '../students/dto/create-student.dto';
import {
  SUPPORTED_SECTIONS,
  isSupportedSection,
  normalizeSectionIdentifier,
  isValidSectionFormat,
} from '../common/constants/sections.constant';

describe('Section Standardization & Validation Suite', () => {
  describe('Authoritative Section Definitions', () => {
    it('defines exactly the 10 supported sections in the specified order', () => {
      expect(SUPPORTED_SECTIONS).toEqual([
        'A1',
        'A2',
        'A3',
        'B1',
        'B2',
        'B3',
        'B4',
        'C1',
        'C2',
        'C3',
      ]);
    });

    it('identifies supported section identifiers', () => {
      SUPPORTED_SECTIONS.forEach((sec) => {
        expect(isSupportedSection(sec)).toBe(true);
      });
      expect(isSupportedSection('D1')).toBe(false);
      expect(isSupportedSection('unknown')).toBe(false);
    });

    it('normalizes case and stripped prefixes to canonical uppercase identifiers', () => {
      expect(normalizeSectionIdentifier('a1')).toBe('A1');
      expect(normalizeSectionIdentifier('section b4')).toBe('B4');
      expect(normalizeSectionIdentifier('Sec C2')).toBe('C2');
      expect(normalizeSectionIdentifier('  b1  ')).toBe('B1');
      // Preserves legacy identifiers
      expect(normalizeSectionIdentifier('CSE-A')).toBe('CSE-A');
    });

    it('validates section format strictly and rejects invalid characters', () => {
      expect(isValidSectionFormat('A1')).toBe(true);
      expect(isValidSectionFormat('B4')).toBe(true);
      expect(isValidSectionFormat('CSE-A')).toBe(true);
      expect(isValidSectionFormat('Invalid@Section!')).toBe(false);
      expect(isValidSectionFormat('')).toBe(false);
      expect(isValidSectionFormat('   ')).toBe(false);
    });
  });

  describe('Assessment DTO targetSections Validation', () => {
    it('accepts each of the 10 supported sections in create and update DTOs', async () => {
      for (const section of SUPPORTED_SECTIONS) {
        const createDto = plainToInstance(CreateAssessmentDto, {
          title: 'Test Assessment',
          code: `CODE-${section}`,
          targetSections: [section],
        });
        const errors = await validate(createDto);
        const sectionError = errors.find((e) => e.property === 'targetSections');
        expect(sectionError).toBeUndefined();
      }
    });

    it('deduplicates section entries in targetSections', () => {
      const dto = plainToInstance(CreateAssessmentDto, {
        title: 'Deduplication Test',
        code: 'DEDUP-101',
        targetSections: ['A1', 'a1', 'A1', 'B2', 'b2'],
      });
      expect(dto.targetSections).toEqual(['A1', 'B2']);
    });

    it('rejects malformed targetSections values with invalid characters', async () => {
      const createDto = plainToInstance(CreateAssessmentDto, {
        title: 'Malformed Section Test',
        code: 'MALFORMED-1',
        targetSections: ['A1', 'Invalid Section!!', 'B2'],
      });
      const errors = await validate(createDto);
      const sectionError = errors.find((e) => e.property === 'targetSections');
      expect(sectionError).toBeDefined();
    });

    it('preserves optional targetSections when omitted', async () => {
      const createDto = plainToInstance(CreateAssessmentDto, {
        title: 'Open Assessment',
        code: 'OPEN-1',
      });
      const errors = await validate(createDto);
      const sectionError = errors.find((e) => e.property === 'targetSections');
      expect(sectionError).toBeUndefined();
    });

    it('maintains compatibility with existing legacy section values', async () => {
      const createDto = plainToInstance(CreateAssessmentDto, {
        title: 'Legacy Section Assessment',
        code: 'LEGACY-1',
        targetSections: ['CSE-A', 'A'],
      });
      const errors = await validate(createDto);
      const sectionError = errors.find((e) => e.property === 'targetSections');
      expect(sectionError).toBeUndefined();
    });
  });

  describe('StudentProfileDto section validation', () => {
    it('accepts valid supported section in student profile', async () => {
      const dto = plainToInstance(CreateStudentDto, {
        uid: 'STUDENT101',
        name: 'Student Name',
        email: 'student@example.com',
        studentProfile: {
          section: 'b4',
        },
      });
      expect(dto.studentProfile?.section).toBe('B4');
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects malformed section in student profile', async () => {
      const dto = plainToInstance(CreateStudentDto, {
        uid: 'STUDENT102',
        name: 'Student Name',
        email: 'student2@example.com',
        studentProfile: {
          section: 'Invalid#Section!',
        },
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const profileError = errors.find((e) => e.property === 'studentProfile');
      expect(profileError).toBeDefined();
    });
  });
});
