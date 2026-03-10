import {
  extractSection,
  extractList,
  extractKeyValuesTable,
  truncateListAtSectionHeaders,
} from '../../handlers/analysis';
import {
  MARKDOWN_HEADING_RESPONSE,
  BOLD_HEADER_RESPONSE,
  PLAIN_HEADER_RESPONSE,
  BOLD_STRUCTURED_FINDINGS,
  EMPTY_RESPONSE,
  RESPONSE_WITHOUT_SECTIONS,
} from '../fixtures/sampleAnalysis';

describe('extractSection', () => {
  describe('markdown heading format (## Header)', () => {
    it('extracts content under a matching ## heading', () => {
      const result = extractSection(MARKDOWN_HEADING_RESPONSE, 'AI Summary');
      expect(result).not.toBeNull();
      expect(result).toContain('53-year-old male');
    });

    it('stops extraction at the next ## heading', () => {
      const result = extractSection(MARKDOWN_HEADING_RESPONSE, 'AI Summary');
      expect(result).not.toContain('Key Findings');
      expect(result).not.toContain('Platelet count');
    });

    it('extracts content using the first matching alias', () => {
      const result = extractSection(MARKDOWN_HEADING_RESPONSE, 'Executive Summary', 'AI Summary');
      expect(result).not.toBeNull();
      expect(result).toContain('53-year-old male');
    });

    it('extracts Clinical Correlations section', () => {
      const result = extractSection(MARKDOWN_HEADING_RESPONSE, 'Clinical Correlations');
      expect(result).not.toBeNull();
      expect(result).toContain('thrombocytopenia');
    });

    it('extracts Uncertainties section', () => {
      const result = extractSection(
        MARKDOWN_HEADING_RESPONSE,
        'Uncertainties and Limitations',
        'Uncertainties'
      );
      expect(result).not.toBeNull();
      expect(result).toContain('bone marrow biopsy');
    });
  });

  describe('bold header format (**Header**:)', () => {
    it('extracts content following a bold header', () => {
      const result = extractSection(BOLD_HEADER_RESPONSE, 'AI Summary');
      expect(result).not.toBeNull();
      expect(result).toContain('multiple comorbidities');
    });
  });

  describe('plain header format (Header:)', () => {
    it('extracts content following a plain header', () => {
      const result = extractSection(PLAIN_HEADER_RESPONSE, 'AI Summary');
      expect(result).not.toBeNull();
      expect(result).toContain('complex multi-system history');
    });
  });

  describe('missing sections', () => {
    it('returns null when header is not found', () => {
      const result = extractSection(MARKDOWN_HEADING_RESPONSE, 'Nonexistent Section');
      expect(result).toBeNull();
    });

    it('returns null for empty input', () => {
      const result = extractSection(EMPTY_RESPONSE, 'AI Summary');
      expect(result).toBeNull();
    });

    it('returns null when text has no matching structure', () => {
      const result = extractSection(RESPONSE_WITHOUT_SECTIONS, 'AI Summary');
      expect(result).toBeNull();
    });
  });
});

describe('extractList', () => {
  describe('numbered list extraction', () => {
    it('extracts numbered items from Key Findings', () => {
      const result = extractList(MARKDOWN_HEADING_RESPONSE, 'Key Findings');
      expect(result.length).toBe(4);
      expect(result[0]).toContain('Platelet count');
      expect(result[1]).toContain('ALT elevated');
    });

    it('extracts numbered Recommendations', () => {
      const result = extractList(MARKDOWN_HEADING_RESPONSE, 'Recommendations');
      expect(result.length).toBe(3);
      expect(result[0]).toContain('hematology');
    });

    it('extracts Questions for Your Doctor', () => {
      const result = extractList(
        MARKDOWN_HEADING_RESPONSE,
        'Questions for Your Doctor',
        'Questions for your doctor'
      );
      expect(result.length).toBe(2);
      expect(result[0]).toContain('aspirin');
    });
  });

  describe('bulleted list extraction', () => {
    it('extracts bullet items when bold header format is used', () => {
      const result = extractList(BOLD_HEADER_RESPONSE, 'Key Findings');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((item) => item.includes('Platelet count'))).toBe(true);
    });

    it('extracts bullet recommendations from bold header format', () => {
      const result = extractList(BOLD_HEADER_RESPONSE, 'Recommendations');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((item) => item.includes('Hematology'))).toBe(true);
    });
  });

  describe('bold structured items (**Label:** content)', () => {
    it('extracts bold-structured findings as combined label+content items', () => {
      const result = extractList(BOLD_STRUCTURED_FINDINGS, 'Key Findings');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((item) => item.includes('Thrombocytopenia'))).toBe(true);
    });
  });

  describe('missing or empty sections', () => {
    it('returns empty array when section is not found', () => {
      const result = extractList(MARKDOWN_HEADING_RESPONSE, 'Nonexistent');
      expect(result).toEqual([]);
    });

    it('returns empty array for empty input', () => {
      const result = extractList(EMPTY_RESPONSE, 'Key Findings');
      expect(result).toEqual([]);
    });
  });
});

describe('extractKeyValuesTable', () => {
  it('parses a standard 4-column table', () => {
    const result = extractKeyValuesTable(MARKDOWN_HEADING_RESPONSE);
    expect(result.length).toBe(4);
  });

  it('maps name, value, unit, and referenceRange correctly', () => {
    const result = extractKeyValuesTable(MARKDOWN_HEADING_RESPONSE);
    const platelets = result.find((r) => r.name === 'Platelets');
    expect(platelets).toBeDefined();
    expect(platelets?.value).toBe('87');
    expect(platelets?.unit).toBe('K/uL');
    expect(platelets?.referenceRange).toBe('150–400');
  });

  it('skips the header row', () => {
    const result = extractKeyValuesTable(MARKDOWN_HEADING_RESPONSE);
    expect(result.every((r) => r.name.toLowerCase() !== 'test')).toBe(true);
  });

  it('skips the separator row (---)', () => {
    const result = extractKeyValuesTable(MARKDOWN_HEADING_RESPONSE);
    expect(result.every((r) => !r.name.includes('---'))).toBe(true);
  });

  it('returns empty array when no table section exists', () => {
    const result = extractKeyValuesTable(BOLD_HEADER_RESPONSE);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    const result = extractKeyValuesTable(EMPTY_RESPONSE);
    expect(result).toEqual([]);
  });

  it('handles a table with only 2 columns (no unit or reference)', () => {
    const minimal = `
## Key Values (Quick Reference)
| Test | Value |
|------|-------|
| Platelets | 87 |
`;
    const result = extractKeyValuesTable(minimal);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Platelets');
    expect(result[0].value).toBe('87');
    expect(result[0].unit).toBeUndefined();
  });
});

describe('truncateListAtSectionHeaders', () => {
  it('returns list unchanged when no stop words are present', () => {
    const items = ['Finding one', 'Finding two', 'Finding three'];
    expect(truncateListAtSectionHeaders(items)).toEqual(items);
  });

  it('truncates at "Recommendations"', () => {
    const items = ['Finding one', 'Finding two', 'Recommendations', 'Finding three'];
    const result = truncateListAtSectionHeaders(items);
    expect(result).toEqual(['Finding one', 'Finding two']);
  });

  it('truncates at "Clinical Correlations"', () => {
    const items = ['Finding one', 'Clinical Correlations', 'Something else'];
    expect(truncateListAtSectionHeaders(items)).toEqual(['Finding one']);
  });

  it('truncates at "Uncertainties and Limitations"', () => {
    const items = ['Finding one', 'Uncertainties and Limitations'];
    expect(truncateListAtSectionHeaders(items)).toEqual(['Finding one']);
  });

  it('truncates at "Questions for Your Doctor"', () => {
    const items = ['Finding one', 'Finding two', 'Questions for Your Doctor'];
    expect(truncateListAtSectionHeaders(items)).toEqual(['Finding one', 'Finding two']);
  });

  it('handles stop word in bold markdown (**Recommendations**)', () => {
    const items = ['Finding one', '**Recommendations**'];
    expect(truncateListAtSectionHeaders(items)).toEqual(['Finding one']);
  });

  it('returns unchanged when stop word is at index 0', () => {
    const items = ['Recommendations', 'Finding one'];
    // index 0 → returns original (no truncation at or before index 0)
    expect(truncateListAtSectionHeaders(items)).toEqual(items);
  });

  it('returns empty array unchanged', () => {
    expect(truncateListAtSectionHeaders([])).toEqual([]);
  });
});
